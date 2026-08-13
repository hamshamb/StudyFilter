import React from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Brain,
  BookOpen,
  LineChart,
  NotebookPen,
  PenLine,
  ShieldCheck,
  Target,
} from "lucide-react";
import { SUBJECTS, GRADE } from "@workspace/cbse-content";
import { Button } from "@/components/ui/button";
import { SubjectCard } from "@/components/study/SubjectCard";
import { PageShell } from "@/components/layout/PageShell";
import { SectionHeading } from "@/components/ui/primitives";

/**
 * The public landing page, for someone who has never used StudyFilter.
 *
 * It sits inside the app shell rather than carrying a marketing nav of its
 * own — the sidebar already lists Subjects, Practice and Library, and a
 * second navigation stacked on top of a working one is clutter, not polish.
 *
 * The centrepiece is a real answer sheet rather than an illustration. It is
 * built from the product's own tokens and structure, so it cannot drift into
 * showing something the app doesn't do — and it is explicitly labelled as an
 * example, because a preview that reads as the visitor's own data would be a
 * lie.
 */

/* ── Product preview ─────────────────────────────────────────────────────── */

/**
 * A static answer sheet. Not wired to the API on purpose: a visitor has no
 * session, and firing a model call to decorate a landing page would cost
 * money and time to show something a fixed example shows just as well.
 */
function AnswerSheetPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
      <div className="px-4 py-4 sm:px-5">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-eyebrow text-muted-foreground">Science</span>
          <span className="text-muted-foreground/50" aria-hidden="true">·</span>
          <span className="text-eyebrow text-muted-foreground">
            The Human Eye and the Colourful World
          </span>
          <span className="text-eyebrow rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
            3 marks
          </span>
        </div>
        <h3 className="text-section">Why does the sky appear blue?</h3>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Verified CBSE notes
        </p>
      </div>

      <div className="border-t border-border bg-muted/40 px-4 py-4 sm:px-5">
        <h4 className="text-eyebrow mb-2 text-muted-foreground">In short</h4>
        <p className="text-sm font-medium leading-relaxed">
          Blue light scatters far more than red light as sunlight passes through the
          atmosphere, so the sky reaching our eyes looks blue.
        </p>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <h4 className="text-eyebrow mb-2.5 text-muted-foreground">Answer</h4>
        <ol className="space-y-2.5">
          {[
            "Sunlight entering the atmosphere is scattered by molecules much smaller than its wavelength.",
            "The amount of scattering is inversely proportional to the fourth power of wavelength.",
            "Blue light has a shorter wavelength than red, so it scatters far more strongly.",
          ].map((point, i) => (
            <li key={i} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold tabular-nums text-primary"
              >
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground/90">{point}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <aside
          className="sf-callout"
          style={{ ["--callout-hue" as string]: "var(--success)" }}
        >
          <p className="text-eyebrow flex items-center gap-1.5 text-success">
            <Target className="h-3.5 w-3.5" aria-hidden="true" />
            Board exam tip
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
            Name the phenomenon — <strong>scattering of light</strong> — in the first line.
            Most of the mark is for the term.
          </p>
        </aside>
      </div>

      <figcaption className="border-t border-border px-4 py-2.5 text-center text-xs text-muted-foreground sm:px-5">
        An example answer. Yours are built from your own syllabus and chapter.
      </figcaption>
    </figure>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

const PILLARS = [
  {
    icon: Brain,
    title: "Understand",
    body: "Ask in your own words. Get the concept, not a wall of text.",
  },
  {
    icon: Target,
    title: "Practise",
    body: "Important questions and quizzes, chapter by chapter.",
  },
  {
    icon: NotebookPen,
    title: "Revise",
    body: "Short notes and summaries built for the night before.",
  },
  {
    icon: LineChart,
    title: "Track",
    body: "See what you have covered and what still needs work.",
  },
];

export function Landing() {
  return (
    <PageShell className="space-y-14 pb-16 sm:space-y-20">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pt-8">
        <div>
          <h1 className="text-display">
            Study smarter.
            <br />
            Not longer.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Your CBSE syllabus, explanations, practice and revision in one place.
            Class {GRADE}, chapter by chapter.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/chat">
                <PenLine className="h-4 w-4" />
                Start studying
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/subjects">
                <BookOpen className="h-4 w-4" />
                Explore subjects
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No account needed to start. Your progress follows you when you sign in.
          </p>
        </div>

        <div className="animate-rise">
          <AnswerSheetPreview />
        </div>
      </section>

      {/* ── What you get ────────────────────────────────────────────────── */}
      <section>
        <SectionHeading>Everything you need to study</SectionHeading>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <dt className="flex items-center gap-2 text-card-title">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {title}
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Subjects ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading description={`The full Class ${GRADE} NCERT syllabus.`}>
          Subjects
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      </section>

      {/* ── The difference ──────────────────────────────────────────────── */}
      <section className="rounded-xl border border-card-border bg-card p-6 sm:p-8">
        <h2 className="text-page-title">Not another chatbot.</h2>
        <p className="measure mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          A chat window gives you a paragraph and moves on. StudyFilter gives you an
          answer sheet — the marks band, the answer in the shape the board expects, the
          diagram to draw, the word the examiner is looking for, and the mistake most
          students make. It is the difference between reading about a topic and being
          ready to write it.
        </p>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="text-center">
        <h2 className="text-page-title">What will you study today?</h2>
        <div className="mt-5 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/chat">
              Start studying
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
