import { useState, useCallback, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import {
  Menu,
  LayoutDashboard,
  LayoutGrid,
  TrendingUp,
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
  ChevronsRight,
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
              label: "Analytics",
              href: `/projects/${projectId}/analytics`,
              icon: <TrendingUp className="h-4 w-4" />,
            },
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
    <div className="flex w-full rounded-md border border-sidebar-border bg-sidebar-active/50 p-0.5">
      <button
        type="button"
        onClick={() => setEnvironment("live")}
        className={cn(
          "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
          environment === "live"
            ? "bg-emerald-700 text-white shadow-sm dark:bg-emerald-600"
            : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
        )}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => setEnvironment("test")}
        className={cn(
          "flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
          environment === "test"
            ? "bg-orange-600 text-white shadow-sm dark:bg-orange-500"
            : "text-sidebar-muted-foreground hover:text-sidebar-foreground",
        )}
      >
        Test
      </button>
    </div>
  );

  // -- Mobile sidebar (flat list) --
  const mobileSidebar = (closeMobile: () => void) => (
    <>
      <div className="flex justify-center px-4 py-5">
        <span
          className="text-[1.6rem] font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#52b788] bg-clip-text text-transparent"
          style={{ fontFamily: "'Chillax', sans-serif" }}
        >
          truesight
        </span>
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
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
        <SheetContent side="left" className="flex w-60 flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main navigation menu</SheetDescription>
          </SheetHeader>
          {mobileSidebar(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Desktop: icon rail + detail panel */}
      <div className="hidden shrink-0 lg:flex">
        {/* Icon rail */}
        <div className="flex w-[68px] flex-col border-r border-sidebar-border bg-sidebar">
          {/* Brand */}
          <div className="flex justify-center py-4">
            <span
              className="text-lg font-bold tracking-[0.08em] bg-gradient-to-r from-[#081c15] to-[#52b788] bg-clip-text text-transparent"
              style={{ fontFamily: "'Chillax', sans-serif" }}
            >
              ts
            </span>
          </div>
          <Separator className="bg-sidebar-border" />

          {/* Nav group icons */}
          <nav className="flex-1 flex flex-col items-center gap-1 px-1.5 py-3">
            {groups.map((group) => {
              const isGroupActive = activeGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => handleRailClick(group.id)}
                  className={cn(
                    "flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                    isGroupActive
                      ? "bg-sidebar-active text-sidebar-foreground"
                      : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
                  )}
                >
                  {group.icon}
                  <span className="leading-tight">{group.label}</span>
                </button>
              );
            })}
          </nav>
          <Separator className="bg-sidebar-border" />

          {/* User avatar */}
          <div className="flex justify-center py-3">
            {isAuthenticated ? <UserMenu /> : <ThemeToggle />}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className={cn(
            "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 overflow-hidden",
            displayGroup ? "w-52" : "w-0",
          )}
        >
          <div className="min-w-52 flex h-full flex-col">
            {displayGroup && (
              <>
                {/* Panel header */}
                <div className="flex items-center justify-between px-3 py-3.5">
                  <h2 className="text-sm font-semibold text-sidebar-foreground">
                    {displayGroup.label}
                  </h2>
                  <button
                    onClick={handleClosePanel}
                    className="rounded-md p-1 text-sidebar-muted-foreground hover:bg-sidebar-active hover:text-sidebar-foreground transition-colors"
                  >
                    <ChevronsRight className="h-4 w-4" />
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
                      className={cn(
                        "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                        isActive(item.href)
                          ? "bg-sidebar-active text-sidebar-foreground font-medium"
                          : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
                      )}
                    >
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
