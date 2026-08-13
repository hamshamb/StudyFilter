import React from "react";
import {
  CheckCircle2,
  Eye,
  PenLine,
  ClipboardCheck,
  Zap,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePdfViewer } from "@/components/pdf/PdfViewerProvider";
import { useXpEvent } from "@/hooks/use-xp-event";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import type { BoardPaper } from "@workspace/cbse-content";

// The server prices practice sessions; the UI reports what it awarded rather
// than promising an amount that could drift out of sync with the rules.

interface Props {
  paper: BoardPaper | null;
  onClose: () => void;
}

export function PracticeSessionOverlay({ paper, onClose }: Props) {
  const sessionId = useSession();
  const recordXp = useXpEvent();
  const { toast } = useToast();

  const [checkedPaper, setCheckedPaper] = React.useState(false);
  const [checkedScheme, setCheckedScheme] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [awardedXp, setAwardedXp] = React.useState<number | null>(null);
  const rewardedRef = React.useRef(false);

  React.useEffect(() => {
    setCheckedPaper(false);
    setCheckedScheme(false);
    setDone(false);
    rewardedRef.current = false;
  }, [paper?.year, paper?.subjectId]);

  if (!paper) return null;

  const hasScheme = !!paper.markingSchemeUrl;
  const subjectName = paper.subjectName;
  const bothReady = checkedPaper && (!hasScheme || checkedScheme);

  function markDone() {
    if (rewardedRef.current || !sessionId) return;
    rewardedRef.current = true;
    void recordXp({ type: "practice_session", subject: subjectName }).then((r) => {
      if (r) setAwardedXp(r.xpAwarded);
    });
    setDone(true);
    toast({ title: "Practice session recorded" });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PenLine className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold leading-none">Practice Session</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {paper.subjectName} · {paper.year}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5 py-10">
        {done ? (
          <div className="w-full max-w-md animate-in fade-in space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-soft">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Practice Complete!</h2>
              <p className="mt-2 text-muted-foreground">
                {awardedXp !== null ? (
                  <>
                    You earned{" "}
                    <span className="font-bold text-primary">+{awardedXp} XP</span> for
                    completing a self-check session.
                  </>
                ) : (
                  "Your self-check session has been recorded."
                )}
              </p>
            </div>
            <Button onClick={onClose} size="lg" className="w-full rounded-xl">
              Close
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                {paper.subjectName} · {paper.year}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Open the question paper and marking scheme side by side (or alternate
                between tabs). Work through the paper at your own pace, then check each
                answer against the scheme.
              </p>
            </div>

            <div className="space-y-3">
              <StepCard
                icon={BookOpen}
                number={1}
                title="Open the question paper"
                description={
                  paper.questionPaperKind === "board"
                    ? "Contains all sets (Set 1, 2, 3) — work from any one."
                    : "Official CBSE sample paper — same format as the real exam."
                }
                url={paper.questionPaperUrl}
                linkLabel={paper.questionPaperKind === "board" ? "Download ZIP" : "Open PDF"}
                checked={checkedPaper}
                onCheck={() => setCheckedPaper(true)}
              />

              <StepCard
                icon={ClipboardCheck}
                number={2}
                title="Open the marking scheme"
                description={
                  hasScheme
                    ? "Use it to check your answers section by section after you attempt them."
                    : "CBSE does not publish marking schemes for real board papers. Use reference textbooks to verify your answers."
                }
                url={paper.markingSchemeUrl}
                linkLabel="Open PDF"
                checked={checkedScheme}
                onCheck={() => setCheckedScheme(true)}
                unavailable={!hasScheme}
              />
            </div>

            <Button
              onClick={markDone}
              disabled={!bothReady}
              size="lg"
              className="w-full rounded-xl gap-2"
            >
              <Zap className="h-5 w-5" />
              {bothReady ? "Mark as Done" : "Open both resources above first"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              XP is awarded once you have opened both resources and marked the session complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  icon: Icon,
  number,
  title,
  description,
  url,
  linkLabel,
  checked,
  onCheck,
  unavailable = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  number: number;
  title: string;
  description: string;
  url: string | null;
  linkLabel: string;
  checked: boolean;
  onCheck: () => void;
  unavailable?: boolean;
}) {
  const { openPdf } = usePdfViewer();
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked
          ? "border-success/30 bg-success-soft"
          : "bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            checked
              ? "bg-success text-white"
              : "bg-primary/10 text-primary"
          }`}
        >
          {checked ? <CheckCircle2 className="h-4 w-4" /> : number}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>

          {!unavailable && url ? (
            <button
              type="button"
              onClick={() => {
                openPdf(url, linkLabel);
                onCheck();
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Eye className="h-3.5 w-3.5" />
              {linkLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onCheck}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark as acknowledged
            </button>
          )}
        </div>
        {checked && (
          <Icon className="h-5 w-5 shrink-0 text-success" />
        )}
      </div>
    </div>
  );
}
