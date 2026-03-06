import { useState, useCallback, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import {
  Eye,
  Menu,
  LayoutDashboard,
  TrendingUp,
  List,
  BookOpen,
  Lightbulb,
  GitBranch,
  RotateCcw,
  UsersRound,
  Workflow,
  Users,
  Settings,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { useAuth } from "@/contexts/AuthContext";
import { useEnvironment } from "@/contexts/EnvironmentContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function extractProjectId(pathname: string): string | undefined {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match?.[1];
}

const COLLAPSED_KEY = "truesight_sidebar_collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

export function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const { isAuthenticated } = useAuth();
  const { environment, setEnvironment } = useEnvironment();

  const projectId = extractProjectId(location.pathname);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const isActive = (href: string) => {
    if (href === `/projects/${projectId}`) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  // -- Analysis nav (only when project is selected) --
  const analysisItems: NavItem[] = projectId
    ? [
        {
          label: "Overview",
          href: `/projects/${projectId}`,
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Analytics",
          href: `/projects/${projectId}/analytics`,
          icon: <TrendingUp className="h-4 w-4" />,
        },
        {
          label: "Events",
          href: `/projects/${projectId}/events`,
          icon: <List className="h-4 w-4" />,
        },
        {
          label: "Event Catalog",
          href: `/projects/${projectId}/event-catalog`,
          icon: <BookOpen className="h-4 w-4" />,
        },
        {
          label: "Insights",
          href: `/projects/${projectId}/insights`,
          icon: <Lightbulb className="h-4 w-4" />,
        },
        {
          label: "Funnels",
          href: `/projects/${projectId}/funnels`,
          icon: <GitBranch className="h-4 w-4" />,
        },
        {
          label: "Retention",
          href: `/projects/${projectId}/retention`,
          icon: <RotateCcw className="h-4 w-4" />,
        },
        {
          label: "Cohorts",
          href: `/projects/${projectId}/cohorts`,
          icon: <UsersRound className="h-4 w-4" />,
        },
        {
          label: "Flows",
          href: `/projects/${projectId}/flows`,
          icon: <Workflow className="h-4 w-4" />,
        },
        {
          label: "Users",
          href: `/projects/${projectId}/users`,
          icon: <Users className="h-4 w-4" />,
        },
      ]
    : [];

  // -- Manage nav --
  const manageItems: NavItem[] = [
    ...(projectId
      ? [
          {
            label: "Settings",
            href: `/projects/${projectId}/settings`,
            icon: <Settings className="h-4 w-4" />,
          },
        ]
      : []),
    {
      label: "Teams",
      href: "/teams",
      icon: <UserCog className="h-4 w-4" />,
    },
  ];

  // -- Render a single nav link --
  const renderNavItem = (item: NavItem, closeMobile?: () => void) => {
    const active = isActive(item.href);
    const link = (
      <Link
        to={item.href}
        onClick={closeMobile}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-active text-sidebar-foreground"
            : "text-sidebar-muted-foreground hover:bg-sidebar-active/50 hover:text-sidebar-foreground",
          collapsed && "justify-center px-2",
        )}
      >
        {item.icon}
        {!collapsed && item.label}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{link}</div>;
  };

  // -- Section label --
  const sectionLabel = (text: string) =>
    !collapsed ? (
      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground">
        {text}
      </p>
    ) : (
      <Separator className="my-2 bg-sidebar-border" />
    );

  // -- Full sidebar content --
  const sidebarContent = (closeMobile?: () => void) => (
    <>
      {/* Brand */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-5",
          collapsed && "justify-center px-2",
        )}
      >
        <Eye className="h-6 w-6 text-sidebar-foreground" />
        {!collapsed && (
          <span className="font-heading text-lg font-bold text-sidebar-foreground">TrueSight</span>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Project Switcher + Environment */}
      <div className="px-2 py-2 space-y-1.5">
        <ProjectSwitcher
          currentProjectId={projectId}
          collapsed={collapsed}
        />
        {/* Environment toggle */}
        <div
          className={cn(
            "flex items-center rounded-md",
            collapsed && "justify-center",
          )}
        >
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-full px-2 text-[11px] font-semibold uppercase",
                    environment === "live"
                      ? "text-green-700 dark:text-green-400"
                      : "text-amber-700 dark:text-amber-400",
                  )}
                  onClick={() =>
                    setEnvironment(environment === "live" ? "test" : "live")
                  }
                >
                  {environment === "live" ? "L" : "T"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {environment === "live" ? "Live" : "Test"} — click to switch
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2 scrollbar-thin">
        {analysisItems.length > 0 && (
          <>
            {sectionLabel("Analysis")}
            {analysisItems.map((item) => renderNavItem(item, closeMobile))}
          </>
        )}

        {sectionLabel("Manage")}
        {manageItems.map((item) => renderNavItem(item, closeMobile))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="px-2 py-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <UserMenu />
            </div>
            {!collapsed && (
              <ThemeToggle />
            )}
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-between px-2",
              collapsed && "justify-center",
            )}
          >
            <p
              className={cn(
                "text-xs text-sidebar-muted-foreground",
                collapsed && "hidden",
              )}
            >
              TrueSight v0.1.0
            </p>
            <ThemeToggle />
          </div>
        )}
        {/* Collapse toggle (desktop only, rendered in both states) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapsed}
          className="mt-1 w-full justify-center text-sidebar-muted-foreground hover:text-sidebar-foreground lg:flex hidden"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
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

      {/* Mobile sidebar - Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-60 flex-col p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main navigation menu</SheetDescription>
          </SheetHeader>
          {sidebarContent(() => setMobileOpen(false))}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col transition-all duration-200",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {sidebarContent()}
      </aside>
    </>
  );
}
