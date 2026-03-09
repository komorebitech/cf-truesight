import { Link, useLocation, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { useProject } from "@/hooks/use-projects";

interface Crumb {
  label: string;
  href?: string;
}

const sectionNames: Record<string, string> = {
  events: "Events",
  catalog: "Catalog",
  live: "Live Events",
  funnels: "Funnels",
  insights: "Insights",
  users: "Users",
  retention: "Retention",
  cohorts: "Cohorts",
  flows: "Flows",
  settings: "Settings",
  cli: "CLI",
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

export function Header({ title }: { title?: string }) {
  const crumbs = useBreadcrumbs();

  return (
    <header className="sticky top-0 z-10 bg-background backdrop-blur-sm">
      <div className="px-8 pb-4 pt-8">
        {/* Breadcrumbs */}
        {crumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground">
            {crumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="hover:text-foreground transition-colors"
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

        {/* Title — Chillax display font, big and confident */}
        {title && (
          <h1 className="font-display text-[2rem] font-semibold tracking-tight text-foreground leading-none">
            {title}
          </h1>
        )}
      </div>
    </header>
  );
}
