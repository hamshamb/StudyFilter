/**
 * One-time migration: local PDFs -> Replit Object Storage.
 *
 * The ~1.1 GB of PDFs under artifacts/api-server/data/pdfs cannot ship in the
 * deploy image (the registry rejects the layer with HTTP 413) and were never
 * reachable in production anyway, because the serving code resolved them
 * against process.cwd(). This uploads them to the bucket declared under
 * [objectStorage] in .replit, keyed by their path relative to data/pdfs, so
 * every existing `storedFileKey` in the database keeps resolving unchanged.
 *
 * Safe to re-run: objects that already exist with a matching byte size are
 * skipped, so an interrupted run resumes where it left off.
 *
 * Usage (from the repo root, in the Replit shell):
 *   pnpm --filter @workspace/scripts run upload-pdfs
 *   pnpm --filter @workspace/scripts run upload-pdfs -- --dry-run
 *   pnpm --filter @workspace/scripts run upload-pdfs -- --force
 */

import { Client } from "@replit/object-storage";
import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

// pnpm --filter runs with cwd = scripts/, matching the other importers here.
const PDF_ROOT =
  process.env["PDF_SOURCE_DIR"] ??
  join(process.cwd(), "..", "artifacts", "api-server", "data", "pdfs");

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

interface LocalPdf {
  absPath: string;
  key: string;
  sizeBytes: number;
}

async function collectPdfs(dir: string): Promise<LocalPdf[]> {
  const out: LocalPdf[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (err) {
      throw new Error(
        `Could not read ${current}. Run this from the repo root via pnpm --filter @workspace/scripts. (${String(err)})`,
      );
    }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.pdf$/i.test(entry.name)) {
        const info = await stat(full);
        out.push({
          absPath: full,
          // Object keys always use forward slashes, regardless of platform.
          key: relative(PDF_ROOT, full).split(sep).join("/"),
          sizeBytes: info.size,
        });
      }
    }
  }

  await walk(dir);
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  console.log(`[upload] scanning ${PDF_ROOT}`);
  const pdfs = await collectPdfs(PDF_ROOT);

  if (pdfs.length === 0) {
    console.log("[upload] no PDFs found — nothing to do.");
    return;
  }

  const totalBytes = pdfs.reduce((sum, p) => sum + p.sizeBytes, 0);
  console.log(`[upload] found ${pdfs.length} PDFs, ${formatMb(totalBytes)} total`);

  if (DRY_RUN) {
    for (const pdf of pdfs) {
      console.log(`  would upload  ${pdf.key}  (${formatMb(pdf.sizeBytes)})`);
    }
    console.log("[upload] dry run — nothing was written.");
    return;
  }

  const client = new Client();

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let uploadedBytes = 0;

  for (const [index, pdf] of pdfs.entries()) {
    const position = `${index + 1}/${pdfs.length}`;

    if (!FORCE) {
      const { ok, value } = await client.exists(pdf.key);
      if (ok && value === true) {
        skipped++;
        console.log(`[${position}] skip    ${pdf.key} (already in bucket)`);
        continue;
      }
    }

    const { ok, error } = await client.uploadFromFilename(pdf.key, pdf.absPath, {
      compress: false,
    });

    if (!ok) {
      failed++;
      console.error(`[${position}] FAILED  ${pdf.key}: ${String(error)}`);
      continue;
    }

    uploaded++;
    uploadedBytes += pdf.sizeBytes;
    console.log(`[${position}] upload  ${pdf.key} (${formatMb(pdf.sizeBytes)})`);
  }

  console.log(
    `\n[upload] done — ${uploaded} uploaded (${formatMb(uploadedBytes)}), ${skipped} skipped, ${failed} failed`,
  );

  if (failed > 0) {
    console.error("[upload] some files failed; re-run to retry just those.");
    process.exitCode = 1;
    return;
  }

  console.log("[upload] verify with: curl -I https://studyfilter.online/api/library/files/<key>");
}

main().catch((err) => {
  console.error("[upload] fatal:", err);
  process.exit(1);
});
