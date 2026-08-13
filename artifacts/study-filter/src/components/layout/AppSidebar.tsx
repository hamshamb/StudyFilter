import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  PenLine,
  Target,
  LineChart,
  FolderOpen,
  Bookmark,
  Home,
  CalendarDays,
  Timer,
  Settings,
  Moon,
  Sun,
  LogOut,
  LogIn,
  MessageSquareWarning,
  Trophy,
  MapPin,
  Scale,
  ChevronDown,
  Flame,
  Zap,
  ListChecks,
  NotebookPen,
  Sparkles,
  Calculator,
  Layers,
  Atom,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  sidebarMenuButtonVariants,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/hooks/use-theme";
import { useUser, useClerk } from "@clerk/react";
import { useSession } from "@/hooks/use-session";
import { useGetProgress } from "@workspace/api-client-react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { useAccountSettings } from "@/hooks/use-account-settings";
import { avatarSeedFor } from "@/lib/avatar";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type NavItem = { href: string; label: string; icon: typeof Home };

/**
 * Six destinations, in the order a study session actually runs: land, ask,
 * read, drill, look things up, check on yourself.
 *
 * The previous sidebar had nine items across three groups with no visual
 * hierarchy between them — "Compare Answers" sat at the same weight as
 * "Subjects", so the list read as a feature inventory rather than as a map of
 * the product. These six are the spine; everything else lives one disclosure
 * below, still one click away, but no longer competing.
 */
const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Ask StudyFilter", icon: PenLine },
  { href: "/subjects", label: "Subjects", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Target },
  { href: "/library", label: "Library", icon: FolderOpen },
  { href: "/dashboard", label: "Progress", icon: LineChart },
];

/**
 * Kept, not cut. Every one of these is a working feature with a route, and
 * hiding a feature because it doesn't fit a six-item list would be deleting
 * it. They open automatically when you are inside one.
 */
const SECONDARY: NavItem[] = [
  // The five study actions, now that each is a place rather than a prompt.
  { href: "/quiz", label: "Quiz yourself", icon: ListChecks },
  { href: "/revise", label: "Revise", icon: NotebookPen },
  { href: "/explain", label: "Explain", icon: Sparkles },
  { href: "/solve", label: "Solve", icon: Calculator },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/plan", label: "Study plan", icon: CalendarDays },
  { href: "/focus", label: "Focus room", icon: Timer },
  { href: "/maps", label: "Map work", icon: MapPin },
  { href: "/tools/periodic-table", label: "Periodic table", icon: Atom },
  { href: "/compare", label: "Compare answers", icon: Scale },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

function testId(label: string): string {
  return `link-sidebar-${label.toLowerCase().replace(/\s+/g, "-")}`;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const sessionId = useSession();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { data: account } = useAccountSettings();

  const { data: progress } = useGetProgress(
    { sessionId },
    { query: { enabled: !!sessionId, queryKey: ["/api/progress", { sessionId }] } },
  );

  const inSecondary = SECONDARY.some((i) => i.href === location);
  const [moreOpen, setMoreOpen] = useState(inSecondary);

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : (user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "S");

  const displayName = account?.username
    ? `@${account.username}`
    : (user?.firstName ?? "Your profile");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 pt-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-1 py-1.5"
          aria-label="StudyFilter home"
        >
          <img
            src={`${basePath}/logo.png`}
            alt=""
            className="h-7 w-7 shrink-0 rounded-md bg-primary object-contain p-0.5"
          />
          <span className="text-[0.9375rem] font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            StudyFilter
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={location === href} tooltip={label}>
                    <Link href={href} data-testid={testId(label)}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/*
          Collapsed by default so the sidebar opens as six clear choices, and
          auto-expanded when the current page is one of them so you are never
          looking at a nav that doesn't contain where you are.
        */}
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="group/more">
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            {/*
              SidebarGroupLabel renders a <div>; nesting it *inside* the
              trigger would have produced a div with a click handler and no
              button semantics. This way round the rendered element is
              CollapsibleTrigger's real <button>, wearing the label's styles.
            */}
            <SidebarGroupLabel
              asChild
              className="w-full cursor-pointer justify-between rounded-md hover:bg-sidebar-accent/60"
            >
              <CollapsibleTrigger data-testid="button-sidebar-more">
                More tools
                <ChevronDown
                  className={cn(
                    "transition-transform duration-200",
                    moreOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {SECONDARY.map(({ href, label, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={location === href} tooltip={label}>
                        <Link href={href} data-testid={testId(label)}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/*
          When the sidebar is collapsed to icons the disclosure above is
          hidden, so these would become unreachable on desktop. Rendered flat
          in that state, tooltip-labelled like everything else.
        */}
        <SidebarGroup className="hidden group-data-[collapsible=icon]:block">
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={location === href} tooltip={label}>
                    <Link href={href}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-3">
        {/*
          Streak and XP, as one quiet line. Motivation should be visible, not
          loud — the previous version gave the daily goal its own bordered
          card with a progress bar inside the navigation.
        */}
        {progress && (
          <div className="mb-1 flex items-center gap-3 px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            <span className="inline-flex items-center gap-1.5" data-testid="text-sidebar-streak">
              <Flame className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <span className="tabular-nums">{progress.streak}</span>
              <span className="sr-only">day streak</span>
            </span>
            <span className="inline-flex items-center gap-1.5" data-testid="text-sidebar-xp">
              <Zap className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
              <span className="tabular-nums">{progress.xp.toLocaleString()}</span>
              <span className="sr-only">total XP</span>
            </span>
            <span className="ml-auto tabular-nums" data-testid="text-sidebar-today-progress">
              {progress.questionsToday}/{progress.dailyGoal} today
            </span>
          </div>
        )}

        <SidebarSeparator />

        <SidebarMenu>
          {isLoaded && user ? (
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  data-slot="sidebar-menu-button"
                  data-sidebar="menu-button"
                  data-testid="button-sidebar-account"
                  className={cn(sidebarMenuButtonVariants(), "w-full")}
                >
                  {user.hasImage ? (
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user.imageUrl} alt="" />
                      <AvatarFallback className="bg-primary text-[10px] font-bold text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <ProfileAvatar
                      seed={sessionId ? avatarSeedFor(sessionId) : "studyfilter"}
                      symbol={account?.avatarSymbol}
                      color={account?.avatarColor}
                      size="xs"
                    />
                  )}
                  <span className="truncate">{displayName}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">{displayName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.emailAddresses?.[0]?.emailAddress}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      Profile &amp; settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      Your progress
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onSelect={() => signOut({ redirectUrl: basePath || "/" })}
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          ) : isLoaded ? (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Sign in">
                <Link href="/sign-in" data-testid="link-sidebar-sign-in">
                  <LogIn />
                  <span>Sign in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" isActive={location === "/settings"}>
              <Link href="/settings" data-testid="link-sidebar-settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              tooltip={theme === "dark" ? "Light mode" : "Study night"}
              data-testid="button-sidebar-theme"
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>{theme === "dark" ? "Light mode" : "Study night"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Help & feedback"
              onClick={() => setFeedbackOpen(true)}
              data-testid="button-sidebar-feedback"
            >
              <MessageSquareWarning />
              <span>Help &amp; feedback</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </Sidebar>
  );
}
