import React from "react";
import { Link } from "wouter";
import { useSearch } from "wouter";
import { FileQuestion, Layers, NotebookPen, Sparkles } from "lucide-react";
import { SUBJECTS } from "@workspace/cbse-content";
import { PageShell, PageHeader } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/primitives";
import { SeoHead } from "@/components/SeoHead";
import { DepthPicker, ExplainPrompt, ExplainView } from "@/components/study/ExplainView";
import { useScopedRoute } from "@/hooks/use-study-scope";
import { usePreferences } from "@/hooks/use-preferences";
import { useRecordRecent } from "@/hooks/use-recents";
import { scopeToSearch } from "@/lib/scope";
import type { ExplainDepth } from "@/lib/study-content";

/**
 * Explain, as its own place.
 *
 * The old "Explain" was a chip that put the words `Explain clearly:` in front
 * of the question and sent it to the same endpoint as everything else. Here a
 * student picks the chapter once, chooses how deep to go, and gets a result
 * laid out as an explanation rather than as a generic answer card — with the
 * depth control still on screen so "that was too much" is one tap from being
 * fixed rather than a re-typed question.
 */
export default function Explain() {
  const { scope, setScope } = useScopedRoute("/explain");
  const { prefs } = usePreferences();
  const search = useSearch();

  const initialTopic = React.useMemo(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return params.get("topic") ?? "";
  }, [search]);

  const [input, setInput] = React.useState(initialTopic);
  const [topic, setTopic] = React.useState(initialTopic);
  const [depth, setDepth] = React.useState<ExplainDepth>(
    prefs.explanationStyle === "concise" ? "quick" : prefs.explanationStyle === "detailed" ? "deep" : "standard",
  );

  // A link that names a topic should explain it immediately — that is what
  // "tap a weak concept on the quiz result" depends on.
  React.useEffect(() => {
    setInput(initialTopic);
    setTopic(initialTopic);
  }, [initialTopic]);

  useRecordRecent(
    topic
      ? {
          kind: "doubt",
          title: topic,
          subtitle: scope.hasChapter ? scope.chapter!.title : "Explained",
          href: `/explain${scopeToSearch(scope)}${scopeToSearch(scope) ? "&" : "?"}topic=${encodeURIComponent(topic)}`,
          ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
          ...(scope.chapterId ? { chapterId: scope.chapterId } : {}),
        }
      : null,
  );

  const scopeSearch = scopeToSearch(scope);

  return (
    <>
      <SeoHead
        title="Explain a concept — CBSE | StudyFilter"
        description="Get any CBSE Class 10 concept explained at the depth you want: a quick reminder, the full classroom explanation, or an exam-focused breakdown."
        canonical="/explain"
      />
      <PageShell width="content">
        <PageHeader
          icon={Sparkles}
          title="Explain"
          eyebrow={scope.hasChapter ? scope.label : `Class ${scope.classLevel} · CBSE`}
          description="Pick how deep to go. The explanation changes shape, not just length."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTopic(input.trim());
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="A term, a process, a formula — anything"
              aria-label="What should we explain?"
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
            <Button type="submit" disabled={input.trim().length < 2}>
              Explain
            </Button>
          </div>

          <DepthPicker value={depth} onChange={setDepth} />

          <div className="rail py-0.5">
            <Chip active={!scope.subjectId} onClick={() => setScope({ subjectId: null, chapterId: null })}>
              No chapter
            </Chip>
            {SUBJECTS.map((subject) => (
              <Chip
                key={subject.id}
                active={scope.subjectId === subject.id}
                onClick={() => setScope({ subjectId: subject.id, chapterId: null })}
              >
                {subject.shortName}
              </Chip>
            ))}
          </div>

          {scope.subject && (
            <select
              value={scope.chapterId ?? ""}
              onChange={(e) => setScope({ chapterId: e.target.value || null })}
              aria-label="Chapter"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Whole subject</option>
              {scope.subject.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.number}. {chapter.title}
                </option>
              ))}
            </select>
          )}
        </form>

        <div className="mt-6">
          {topic ? (
            <ExplainView
              scope={scope}
              topic={topic}
              depth={depth}
              footer={
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/quiz${scopeSearch}`}>
                      <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />
                      Quiz me on this
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/flashcards${scopeSearch}`}>
                      <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                      Make flashcards
                    </Link>
                  </Button>
                  {scope.hasChapter && (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/revise${scopeSearch}`}>
                        <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                        Revise the chapter
                      </Link>
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <ExplainPrompt>
              {scope.chapter && (
                <Button variant="outline" size="sm" onClick={() => setTopic(scope.chapter!.title)}>
                  Explain {scope.chapter.title}
                </Button>
              )}
            </ExplainPrompt>
          )}
        </div>
      </PageShell>
    </>
  );
}
