import { Router } from "express";
import path from "path";
import { listObjectKeys } from "../lib/objectStorage";

const router = Router();

/**
 * Categories map to Object Storage key prefixes. These previously listed
 * "pyqs" and "ncert", but nothing was ever written under a "pyqs" prefix — the
 * importer writes to selfstudys/{pyq,sample,marking,exemplar} — so the endpoint
 * silently returned empty arrays for every category.
 */
const CATEGORY_PREFIXES = {
  ncert: ["ncert/"],
  pyq: ["selfstudys/pyq/"],
  // Generated practice papers are written under generated/, not selfstudys/,
  // because they did not come from SelfStudys. Both prefixes feed the same
  // category so a generated paper is still listed.
  sample: ["selfstudys/sample/", "generated/sample/"],
  marking: ["selfstudys/marking/", "generated/marking/"],
  exemplar: ["selfstudys/exemplar/"],
} as const;

type Category = keyof typeof CATEGORY_PREFIXES;

type PdfEntry = { name: string; fileName: string; fileKey: string; url: string };
type PdfList = Record<Category, PdfEntry[]>;

function toEntry(key: string): PdfEntry {
  const fileName = path.basename(key);
  return {
    name: fileName.replace(/\.pdf$/i, ""),
    fileName,
    fileKey: key,
    // Served through our own origin by the library route, never a third-party URL.
    url: `/api/library/files/${key.split("/").map(encodeURIComponent).join("/")}`,
  };
}

async function listCategory(cat: Category): Promise<PdfEntry[]> {
  const results = await Promise.all(
    CATEGORY_PREFIXES[cat].map(async (prefix) => {
      try {
        return await listObjectKeys(prefix);
      } catch {
        // A missing prefix is not an error — nothing has been written there yet.
        return [] as string[];
      }
    }),
  );
  return results
    .flat()
    .sort((a, b) => a.localeCompare(b))
    .map(toEntry);
}

router.get("/pdfs/list", async (_req, res) => {
  const categories = Object.keys(CATEGORY_PREFIXES) as Category[];
  const results = await Promise.all(categories.map((cat) => listCategory(cat)));
  const list = Object.fromEntries(
    categories.map((cat, i) => [cat, results[i] ?? []]),
  ) as PdfList;
  res.json(list);
});

export default router;
