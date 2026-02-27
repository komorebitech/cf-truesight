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

  // Last crumb has no link
  if (crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1]!;
    if (!location.pathname.endsWith("/events") && params.id) {
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
    <header className="border-b border-gray-200 bg-white px-6 py-4">
      {/* Breadcrumbs */}
      <nav className="mb-1 flex items-center gap-1 text-sm text-gray-500">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {crumb.href ? (
              <Link
                to={crumb.href}
                className="hover:text-gray-700 hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-900">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Title */}
      {title && (
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      )}
    </header>
  );
}
