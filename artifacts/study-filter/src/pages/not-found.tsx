import { Link } from "wouter";
import { Compass, Home, BookOpen, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, EmptyState } from "@/components/layout/PageShell";

/**
 * This page used to be the untouched scaffold: a `bg-gray-50` card with
 * hardcoded `text-gray-900` / `text-gray-600` (unreadable in dark mode)
 * reading "Did you forget to add the page to the router?" — a message
 * addressed to the developer, shipped live to students on a mistyped URL.
 */
export default function NotFound() {
  return (
    <PageShell width="narrow" className="flex min-h-[70dvh] flex-col justify-center">
      <EmptyState
        icon={Compass}
        titleAs="h1"
        title="This page doesn't exist"
        description="The link may be out of date, or the address mistyped. Everything below still works."
        action={
          <>
            <Button asChild>
              <Link href="/">
                <Home className="mr-1.5 h-4 w-4" />
                Go home
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/subjects">
                <BookOpen className="mr-1.5 h-4 w-4" />
                Browse subjects
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/practice">
                <Target className="mr-1.5 h-4 w-4" />
                Practise
              </Link>
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
