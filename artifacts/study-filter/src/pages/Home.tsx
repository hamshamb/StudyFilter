import React from "react";
import { useUser } from "@clerk/react";
import { useGetProgress } from "@workspace/api-client-react";
import { useSession } from "@/hooks/use-session";
import { useChapterProgress } from "@/hooks/use-chapter-progress";
import { StudentHome } from "@/components/home/StudentHome";
import { Landing } from "@/components/home/Landing";
import { Footer } from "@/components/layout/Footer";
import { SeoHead } from "@/components/SeoHead";
import { PageShell } from "@/components/layout/PageShell";
import { SkeletonCard, Skeleton } from "@/components/ui/primitives";

const HOME_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "StudyFilter",
  description:
    "Distraction-free CBSE study help for Class 8–12. Ask one question, get one clear exam-ready answer.",
  url: "https://studyfilter.online/",
  potentialAction: {
    "@type": "SearchAction",
    // Points at /chat, which genuinely reads ?q= and answers the question.
    // The previous target was /subjects?q=, a parameter that page never read,
    // so every search-engine-driven query landed on the generic subject list.
    target: "https://studyfilter.online/chat?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

/**
 * `/` is two different pages.
 *
 * A first-time visitor needs to be told what this is; a student who was
 * revising Electricity last night needs their desk. Serving one page to both
 * meant the returning student got a marketing headline above a stat grid, and
 * the visitor got a dashboard full of zeroes.
 *
 * The split is *not* on sign-in state alone. Guests are first-class here —
 * anonymous progress is real and gets claimed when they eventually sign up —
 * so someone who has been studying for a week without an account would
 * otherwise still be shown the sales pitch. Any evidence of study counts.
 */
function hasStudied(
  progress: { questionsSolved?: number; xp?: number; streak?: number } | undefined,
  recentChapters: number,
): boolean {
  if (recentChapters > 0) return true;
  if (!progress) return false;
  return (
    (progress.questionsSolved ?? 0) > 0 ||
    (progress.xp ?? 0) > 0 ||
    (progress.streak ?? 0) > 0
  );
}

function HomeSkeleton() {
  return (
    <PageShell className="space-y-8">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-5 h-[3.25rem] w-full rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </PageShell>
  );
}

export default function Home() {
  const sessionId = useSession();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { records } = useChapterProgress();

  const { data: progress, isLoading: progressLoading } = useGetProgress(
    { sessionId: sessionId ?? "" },
    { query: { enabled: !!sessionId, queryKey: ["/api/progress", { sessionId }] } },
  );

  /*
   * Deciding before the data lands would flash the wrong page — a returning
   * student would see the landing hero for a moment and then have it replaced,
   * which is worse than a beat of skeleton. Once a session exists but its
   * progress hasn't arrived, wait.
   */
  const deciding = !userLoaded || (!!sessionId && progressLoading);
  const showDashboard = isSignedIn || hasStudied(progress, records.length);

  return (
    <div className="flex min-h-viewport flex-col bg-background">
      <SeoHead
        title="StudyFilter — CBSE Study Help for Class 8–12"
        description="Get clear, exam-ready answers to CBSE questions for Class 8–12. Study Maths, Science, Social Science and English with answers drawn from local CBSE notes and AI."
        canonical="/"
        jsonLd={HOME_JSONLD}
      />
      <div className="flex-1">
        {deciding ? <HomeSkeleton /> : showDashboard ? <StudentHome /> : <Landing />}
      </div>
      <Footer />
    </div>
  );
}
