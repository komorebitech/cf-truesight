import { useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import {
  Menu,
  LayoutDashboard,
  LayoutGrid,
  List,
  Lightbulb,
  LineChart,
  Grid3X3,
  GitBranch,
  RotateCcw,
  UsersRound,
  Workflow,
  Users,
  Settings,
  UserCog,
  Terminal,
  ChevronsLeft,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  icon: ReactNode;
  items: NavItem[];
}

function extractProjectId(pathname: string): string | undefined {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1];
}

const PANEL_OPEN_KEY = "truesight_panel_open";

function getPersistedPanelOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Blinking "ts" logo — the dot on the "i" (implied eye) blinks periodically
// ---------------------------------------------------------------------------

function TsLogoBlinking() {
  const [blink, setBlink] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const scheduleBlink = () => {
      // Random interval between 3s and 7s for natural feel
      const delay = 3000 + Math.random() * 4000;
      timeoutRef.current = setTimeout(() => {
        setBlink(true);
        // Blink lasts 150ms
        setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutRef.current);
  }, []);

  return (
    <span className="group/logo inline-flex items-baseline cursor-default select-none">
      <span
        className="font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#2d6a4f] bg-clip-text text-transparent dark:from-[#FEC89A] dark:to-[#e07a6a] text-2xl"
        style={{ fontFamily: "'Chillax', sans-serif" }}
      >
        ts
      </span>
      {/* Blinking dot — sits after "s" like a full stop */}
      <span
        className="ml-[2px] inline-block transition-transform duration-[150ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          transformOrigin: "center bottom",
          transform: blink ? "scaleY(0.15)" : "scaleY(1)",
        }}
      >
        <span className="block h-full w-full rounded-full bg-gradient-to-r from-[#081c15] to-[#2d6a4f] dark:from-[#FEC89A] dark:to-[#e07a6a]" />
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(getPersistedPanelOpen);
  const { isAuthenticated } = useAuth();
  const { environment, setEnvironment } = useEnvironment();

  const projectId = extractProjectId(location.pathname);

  const persistPanelOpen = useCallback((open: boolean) => {
    try {
      localStorage.setItem(PANEL_OPEN_KEY, String(open));
    } catch {
      // ignore
    }
  }, []);

  const isActive = (href: string) => {
    if (href === `/projects/${projectId}`) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  // -- Nav groups --
  const groups: NavGroup[] = projectId
    ? [
        {
          id: "home",
          label: "Home",
          icon: <LayoutDashboard className="h-5 w-5" />,
          items: [
            {
              label: "Overview",
              href: `/projects/${projectId}`,
              icon: <LayoutDashboard className="h-4 w-4" />,
            },
            {
              label: "Boards",
              href: `/projects/${projectId}/boards`,
              icon: <LayoutGrid className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "explore",
          label: "Explore",
          icon: <List className="h-5 w-5" />,
          items: [
            {
              label: "Events",
              href: `/projects/${projectId}/events`,
              icon: <List className="h-4 w-4" />,
            },
            {
              label: "Users",
              href: `/projects/${projectId}/users`,
              icon: <Users className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "insights",
          label: "Insights",
          icon: <Lightbulb className="h-5 w-5" />,
          items: [
{
              label: "Trends",
              href: `/projects/${projectId}/trends`,
              icon: <LineChart className="h-4 w-4" />,
            },
            {
              label: "Insights",
              href: `/projects/${projectId}/insights`,
              icon: <Lightbulb className="h-4 w-4" />,
            },
            {
              label: "Pivots",
              href: `/projects/${projectId}/pivots`,
              icon: <Grid3X3 className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "engage",
          label: "Engage",
          icon: <UsersRound className="h-5 w-5" />,
          items: [
            {
              label: "Funnels",
              href: `/projects/${projectId}/funnels`,
              icon: <GitBranch className="h-4 w-4" />,
            },
            {
              label: "Flows",
              href: `/projects/${projectId}/flows`,
              icon: <Workflow className="h-4 w-4" />,
            },
            {
              label: "Retention",
              href: `/projects/${projectId}/retention`,
              icon: <RotateCcw className="h-4 w-4" />,
            },
            {
              label: "Segments",
              href: `/projects/${projectId}/segments`,
              icon: <UsersRound className="h-4 w-4" />,
            },
          ],
        },
        {
          id: "settings",
          label: "Settings",
          icon: <Settings className="h-5 w-5" />,
          items: [
            {
              label: "Settings",
              href: `/projects/${projectId}/settings`,
              icon: <Settings className="h-4 w-4" />,
            },
            {
              label: "CLI",
              href: `/projects/${projectId}/cli`,
              icon: <Terminal className="h-4 w-4" />,
            },
            {
              label: "Teams",
              href: "/teams",
              icon: <UserCog className="h-4 w-4" />,
            },
          ],
        },
      ]
    : [
        {
          id: "manage",
          label: "Manage",
          icon: <Settings className="h-5 w-5" />,
          items: [
            {
              label: "Teams",
              href: "/teams",
              icon: <UserCog className="h-4 w-4" />,
            },
          ],
        },
      ];

  // Determine active group from current URL
  const activeGroupId = (() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (isActive(item.href)) return group.id;
      }
    }
    return null;
  })();

  const displayGroupId = panelOpen ? activeGroupId : null;
  const displayGroup = groups.find((g) => g.id === displayGroupId);

  const handleRailClick = (groupId: string) => {
    if (panelOpen && activeGroupId === groupId) {
      setPanelOpen(false);
      persistPanelOpen(false);
    } else {
      setPanelOpen(true);
      persistPanelOpen(true);
      if (activeGroupId !== groupId) {
        const group = groups.find((g) => g.id === groupId);
        if (group?.items[0]) navigate(group.items[0].href);
      }
    }
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    persistPanelOpen(false);
  };

  // -- Environment toggle (shared between mobile & detail panel) --
  const envToggle = (
    <div className="flex w-full rounded-lg border border-sidebar-border bg-background/50 p-0.5 dark:bg-sidebar-active">
      <button
        type="button"
        onClick={() => setEnvironment("live")}
        className={cn(
          "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          environment === "live"
            ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
            : "text-sidebar-muted-foreground dark:text-sidebar-foreground/70 hover:text-sidebar-foreground",
        )}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => setEnvironment("test")}
        className={cn(
          "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          environment === "test"
            ? "bg-amber-500 text-white shadow-sm"
            : "text-sidebar-muted-foreground dark:text-sidebar-foreground/70 hover:text-sidebar-foreground",
        )}
      >
        Test
      </button>
    </div>
  );

  // -- Brand mark --
  const brandMark = (size: "sm" | "lg") =>
    size === "sm" ? (
      <TsLogoBlinking />
    ) : (
      <span
        className="font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#2d6a4f] bg-clip-text text-transparent dark:from-[#FEC89A] dark:to-[#e07a6a] text-[1.6rem]"
        style={{ fontFamily: "'Chillax', sans-serif" }}
      >
        truesight
      </span>
    );

  // -- Mobile sidebar (flat list) --
  const mobileSidebar = (closeMobile: () => void) => (
    <>
      <div className="flex justify-center px-4 py-5">
        {brandMark("lg")}
      </div>
      <Separator className="bg-sidebar-border" />

      <div className="px-2 py-2 space-y-1.5">
        <ProjectSwitcher currentProjectId={projectId} />
        {envToggle}
      </div>
      <Separator className="bg-sidebar-border" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 scrollbar-thin">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeMobile}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isActive(item.href)
                    ? "bg-sidebar-active text-sidebar-foreground"
                    : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <Separator className="bg-sidebar-border" />

      <div className="flex justify-center py-2">
        {isAuthenticated ? <UserMenu /> : <ThemeToggle />}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main navigation menu</SheetDescription>
          </SheetHeader>
          {mobileSidebar(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Desktop: icon rail + detail panel */}
      <div className="hidden shrink-0 lg:flex">
        {/* Icon rail — dark green, the anchor of the UI */}
        <div className="flex w-[72px] flex-col border-r border-sidebar-border bg-sidebar">
          {/* Brand */}
          <div className="flex justify-center py-5">
            {brandMark("sm")}
          </div>

          {/* Nav group icons */}
          <nav className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3">
            {groups.map((group) => {
              const isGroupActive = activeGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => handleRailClick(group.id)}
                  aria-current={isGroupActive ? "true" : undefined}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[10px] font-semibold transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    isGroupActive
                      ? "bg-sidebar-active text-sidebar-foreground"
                      : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
                  )}
                >
                  {/* Active indicator */}
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-[height,opacity] duration-200",
                      isGroupActive ? "h-5 opacity-100" : "h-0 opacity-0",
                    )}
                  />
                  {group.icon}
                  <span className="leading-tight tracking-wide">{group.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Theme toggle + User avatar */}
          <div className="flex flex-col items-center gap-2 pb-4 pt-2">
            <ThemeToggle />
            {isAuthenticated && <UserMenu />}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className={cn(
            "flex flex-col border-r border-sidebar-border bg-sidebar overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)]",
            displayGroup ? "w-52" : "w-0",
          )}
        >
          <div className="min-w-52 flex h-full flex-col">
            {displayGroup && (
              <>
                {/* Panel header */}
                <div className="flex items-center justify-between px-3 py-4">
                  <h2 className="font-display text-sm font-semibold tracking-tight text-sidebar-foreground">
                    {displayGroup.label}
                  </h2>
                  <button
                    onClick={handleClosePanel}
                    aria-label="Close panel"
                    className="rounded-md p-1.5 text-sidebar-muted-foreground hover:bg-sidebar-active hover:text-sidebar-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                </div>
                <Separator className="bg-sidebar-border" />

                {/* Project switcher + env */}
                <div className="px-2 py-2 space-y-1.5">
                  <ProjectSwitcher currentProjectId={projectId} />
                  {envToggle}
                </div>
                <Separator className="bg-sidebar-border" />

                {/* Sub-items */}
                <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin">
                  {displayGroup.items.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        isActive(item.href)
                          ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <span className={cn(
                        "shrink-0",
                        isActive(item.href) ? "text-sidebar-foreground" : "text-sidebar-muted-foreground",
                      )}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
