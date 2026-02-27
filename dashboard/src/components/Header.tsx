import { Link, useLocation, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import { useProject } from "@/hooks/use-projects";

interface Crumb {
  label: string;
  href?: string;
}

function useBreadcrumbs(): Crumb[] {
  const location = useLocation();
  const params = useParams();
  const { data: project } = useProject(params.id);

  const crumbs: Crumb[] = [{ label: "Projects", href: "/" }];

  if (params.id) {
    crumbs.push({
      label: project?.name ?? "Project",
      href: `/projects/${params.id}`,
    });
  }

  if (location.pathname.endsWith("/events") && params.id) {
    crumbs.push({ label: "Events" });
  }

  if (location.pathname.includes("/analytics") && params.id) {
    crumbs.push({ label: "Analytics" });
  }

  if (location.pathname.includes("/funnels") && params.id) {
    if (params.funnelId) {
      crumbs.push({ label: "Funnels", href: `/projects/${params.id}/funnels` });
      crumbs.push({ label: "Detail" });
    } else if (location.pathname.includes("/compare")) {
      crumbs.push({ label: "Funnels", href: `/projects/${params.id}/funnels` });
      crumbs.push({ label: "Compare" });
    } else {
      crumbs.push({ label: "Funnels" });
    }
  }

  // Last crumb has no link
  if (crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1]!;
    if (!location.pathname.endsWith("/events") && !location.pathname.includes("/analytics") && !location.pathname.includes("/funnels") && params.id) {
      delete last.href;
    }
    if (location.pathname === "/") {
      delete crumbs[0]!.href;
    }
  }

  return crumbs;
}

export function Header({ title }: { title?: string }) {
  const crumbs = useBreadcrumbs();

  return (
    <header className="border-b bg-card px-6 py-4">
      {/* Breadcrumbs */}
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
              <span className="text-foreground">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Title */}
      {title && (
        <h1 className="font-serif text-2xl font-bold">
          {title}
        </h1>
      )}
    </header>
  );
}
