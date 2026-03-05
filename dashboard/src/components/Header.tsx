import { Link, useLocation, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { useProject } from "@/hooks/use-projects";

interface Crumb {
  label: string;
  href?: string;
}

const sectionNames: Record<string, string> = {
  events: "Events",
  analytics: "Analytics",
  funnels: "Funnels",
  insights: "Insights",
  users: "Users",
  retention: "Retention",
  cohorts: "Cohorts",
  flows: "Flows",
  settings: "Settings",
};

function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const params = useParams();
  const { data: project } = useProject(params.id);

  const crumbs: Crumb[] = [];

  if (params.id) {
    // Find which section we're in
    const segments = location.pathname.split("/").filter(Boolean);
    // segments: ["projects", id, section?, subId?]
    const sectionSlug = segments[2];
    const section = sectionSlug ? sectionNames[sectionSlug] : undefined;

    if (section) {
      crumbs.push({
        label: project?.name ?? "Project",
        href: `/projects/${params.id}`,
      });

      // Sub-pages within a section
      if (params.funnelId) {
        crumbs.push({ label: "Funnels", href: `/projects/${params.id}/funnels` });
        crumbs.push({ label: "Detail" });
      } else if (params.cohortId) {
        crumbs.push({ label: "Cohorts", href: `/projects/${params.id}/cohorts` });
        crumbs.push({ label: "Detail" });
      } else if (params.userId) {
        crumbs.push({ label: "Users", href: `/projects/${params.id}/users` });
        crumbs.push({ label: "Detail" });
      } else if (location.pathname.includes("/funnels/compare")) {
        crumbs.push({ label: "Funnels", href: `/projects/${params.id}/funnels` });
        crumbs.push({ label: "Compare" });
      } else {
        crumbs.push({ label: section });
      }
    } else {
      // Overview page — just the project name, no link
      crumbs.push({ label: project?.name ?? "Project" });
    }
  } else if (location.pathname.startsWith("/teams")) {
    crumbs.push({ label: "Teams" });
  }

  return crumbs;
}

const sectionColors: Record<string, string> = {
  analytics: "bg-blue-500",
  events: "bg-neutral-900 dark:bg-neutral-100",
  insights: "bg-emerald-500",
  funnels: "bg-orange-500",
  retention: "bg-amber-500",
  cohorts: "bg-red-500",
  flows: "bg-purple-500",
  users: "bg-cyan-500",
  settings: "bg-gray-400",
};

export function Header({ title }: { title?: string }) {
  const crumbs = useBreadcrumbs();
  const location = useLocation();
  const params = useParams();
  const segments = location.pathname.split("/").filter(Boolean);
  const sectionSlug = params.id ? segments[2] : undefined;

  return (
    <header className="border-b bg-card">
      <div className="px-6 py-4">
        {/* Breadcrumbs */}
        {crumbs.length > 0 && (
          <nav className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-foreground hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Title */}
        {title && (
          <h1 className="font-heading text-3xl font-extrabold">{title}</h1>
        )}
      </div>

      {/* Section accent bar */}
      {sectionSlug && sectionColors[sectionSlug] && (
        <div className={`h-[3px] ${sectionColors[sectionSlug]}`} />
      )}
    </header>
  );
}
