import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReadingModeProvider } from "@/hooks/use-reading-mode";
import { ReadingOverlay } from "@/components/ReadingOverlay";
import NotFound from "@/pages/not-found";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { FocusTimerProvider } from "@/hooks/use-focus-timer";
import { PdfViewerProvider } from "@/components/pdf/PdfViewerProvider";
import { useClaimProgress } from "@/hooks/use-claim-progress";
import { lazy, Suspense } from "react";
import { queryClient } from "@/lib/queryClient";
import { GradeOnboarding } from "@/components/GradeOnboarding";
import { LoadingBlock } from "@/components/ui/primitives";
import { StudyWorkspaceProvider } from "@/components/workspace/StudyWorkspace";
import { useThemeSideEffects } from "@/hooks/use-theme";
import { usePreferenceSideEffects } from "@/hooks/use-preferences";

const Home        = lazy(() => import("@/pages/Home"));
const Chat        = lazy(() => import("@/pages/Chat"));
const Subjects    = lazy(() => import("@/pages/Subjects"));
const SubjectPage = lazy(() => import("@/pages/SubjectPage"));
const ChapterPage = lazy(() => import("@/pages/ChapterPage"));
const Practice    = lazy(() => import("@/pages/Practice"));
const Dashboard   = lazy(() => import("@/pages/Dashboard"));
const Compare     = lazy(() => import("@/pages/Compare"));
const Saved       = lazy(() => import("@/pages/Saved"));
const Library     = lazy(() => import("@/pages/Library"));
const Plan        = lazy(() => import("@/pages/Plan"));
const Focus       = lazy(() => import("@/pages/Focus"));
const Settings    = lazy(() => import("@/pages/Settings"));
const Leaderboard = lazy(() => import("@/pages/Leaderboard"));
// Lazy on purpose: this route bundles ~190 KB of India boundary geometry.
const Maps = lazy(() => import("@/pages/Maps"));
// Also lazy: the 118-element dataset and the table grid are only needed here.
const PeriodicTable = lazy(() => import("@/pages/PeriodicTable"));

/*
 * The five study actions, each its own route.
 *
 * These replace what used to be five prefixes on one text box. Every one is
 * lazily loaded and scope-driven: `/quiz?subject=science&chapter=electricity`
 * is a real location that can be refreshed, bookmarked and shared, which is
 * also what makes "resume the quiz you abandoned" possible.
 */
const Quiz        = lazy(() => import("@/pages/Quiz"));
const Revise      = lazy(() => import("@/pages/Revise"));
const Explain     = lazy(() => import("@/pages/Explain"));
const Solve       = lazy(() => import("@/pages/Solve"));
const Flashcards  = lazy(() => import("@/pages/Flashcards"));

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
    socialButtonsPlacement: "top" as const,
  },
  /*
   * Every colour here reads a theme token rather than a literal.
   *
   * These used to be twenty-odd hardcoded values from an older palette — a
   * teal primary and a cream background — pinned in two places at once:
   * `variables` as `hsl(199, 22%, 34%)` and `elements` as arbitrary
   * `bg-[hsl(40,33%,97%)]` classes. Two consequences. The sign-in card was
   * the only screen in the product still wearing the previous design, and
   * because the values were literal it stayed light even in Study Night mode
   * — a white card thrown up in front of someone studying at midnight.
   *
   * `hsl(var(--x))` resolves in the browser against whichever theme is
   * active, so the auth screens now follow the app.
   */
  variables: {
    colorPrimary: "hsl(var(--primary))",
    colorForeground: "hsl(var(--foreground))",
    colorMutedForeground: "hsl(var(--muted-foreground))",
    colorDanger: "hsl(var(--destructive))",
    colorBackground: "hsl(var(--card))",
    colorInput: "hsl(var(--input))",
    colorInputForeground: "hsl(var(--foreground))",
    colorNeutral: "hsl(var(--border))",
    fontFamily: "'Manrope', 'Inter', sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-card rounded-xl w-[440px] max-w-full overflow-hidden border border-card-border shadow-md",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold tracking-tight",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-success",
    alertText: "text-foreground",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-border hover:bg-muted",
    formButtonPrimary: "bg-primary text-primary-foreground hover:opacity-90",
    formFieldInput: "border-input bg-background text-foreground",
    footerAction: "bg-transparent",
    dividerLine: "bg-border",
    alert: "border-border",
    otpCodeFieldInput: "border-input",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[80dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/chat`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[80dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/chat`}
      />
    </div>
  );
}

/**
 * Runs inside ClerkProvider + QueryClientProvider so it can see the signed-in
 * user and refresh queries once their anonymous progress has been claimed.
 */
function ClaimProgressOnSignIn() {
  useClaimProgress();
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/**
 * Document-level preferences, applied once.
 *
 * Theme and the two accessibility preferences (reduced motion, density) are
 * attributes on <html>, so they belong at the root rather than in whichever
 * component happens to read them. Rendering this inside the router means a
 * theme change repaints the app without a reload.
 */
function DocumentPreferences() {
  useThemeSideEffects();
  usePreferenceSideEffects();
  return null;
}

function Router() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-screen bg-background">
        <WorkspaceHeader />
        {/*
          The bottom padding reserves exactly the fixed mobile nav's height —
          the same --nav-h that .min-h-viewport subtracts, so the two can't
          drift. It was a hardcoded pb-24 (96px) against a ~60px bar, which
          left a band of dead space under every page on a phone.
        */}
        <main className="flex-1 pb-[var(--nav-h)]">
          <Suspense fallback={<LoadingBlock full />}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/chat" component={Chat} />
            <Route path="/subjects" component={Subjects} />
            <Route path="/subjects/:subjectId" component={SubjectPage} />
            <Route path="/subjects/:subjectId/:chapterId" component={ChapterPage} />
            <Route path="/practice" component={Practice} />
            <Route path="/quiz" component={Quiz} />
            <Route path="/revise" component={Revise} />
            <Route path="/explain" component={Explain} />
            <Route path="/solve" component={Solve} />
            <Route path="/flashcards" component={Flashcards} />
            {/*
              Compare was fully built — page, form, and a working
              POST /api/study/compare endpoint — but had no <Route>, so it
              was lazy-imported and then unreachable. Nothing in the app
              linked to it either; the only surviving trace was its entry
              in the workspace header's title map.
            */}
            <Route path="/compare" component={Compare} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/saved" component={Saved} />
            <Route path="/library" component={Library} />
            <Route path="/library/:section" component={Library} />
            <Route path="/library/:section/:subject" component={Library} />
            <Route path="/plan" component={Plan} />
            <Route path="/focus" component={Focus} />
            <Route path="/settings" component={Settings} />
            <Route path="/leaderboard" component={Leaderboard} />
            <Route path="/maps" component={Maps} />
            {/*
              The old map-practice URL still works and now lands on the same
              page — practice is one of its three modes, so nobody's bookmark
              breaks and nobody is sent somewhere that no longer exists.
            */}
            <Route path="/map-practice" component={Maps} />
            <Route path="/tools/periodic-table" component={PeriodicTable} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </main>
        <MobileNavigation />
      </SidebarInset>
      <GradeOnboarding />
    </SidebarProvider>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to continue studying",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start your CBSE study journey",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ClaimProgressOnSignIn />
        <ReadingModeProvider>
          <TooltipProvider>
            <FocusTimerProvider>
              <PdfViewerProvider>
                <CommandPaletteProvider>
                  {/*
                    The Study Workspace wraps the router rather than sitting
                    inside a page, because its whole purpose is to stay open
                    across navigation — you can read a chapter, open its
                    summary in the panel, and move around the app without the
                    panel closing.
                  */}
                  <StudyWorkspaceProvider>
                    <DocumentPreferences />
                    <Router />
                  </StudyWorkspaceProvider>
                </CommandPaletteProvider>
              </PdfViewerProvider>
            </FocusTimerProvider>
            <ReadingOverlay />
            <Toaster />
          </TooltipProvider>
        </ReadingModeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
