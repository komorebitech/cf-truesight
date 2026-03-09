import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { App } from "@/App";
import { ProtectedLayout } from "@/components/ProtectedLayout";

// Eager-loaded (small, always needed)
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Lazy-loaded pages
const ProjectsListPage = lazy(() =>
  import("@/pages/ProjectsListPage").then((m) => ({
    default: m.ProjectsListPage,
  })),
);
const ProjectDetailPage = lazy(() =>
  import("@/pages/ProjectDetailPage").then((m) => ({
    default: m.ProjectDetailPage,
  })),
);
const ProjectSettingsPage = lazy(() =>
  import("@/pages/ProjectSettingsPage").then((m) => ({
    default: m.ProjectSettingsPage,
  })),
);
const EventsPage = lazy(() =>
  import("@/pages/EventsPage").then((m) => ({ default: m.EventsPage })),
);
const AnalyticsPage = lazy(() =>
  import("@/pages/AnalyticsPage").then((m) => ({
    default: m.AnalyticsPage,
  })),
);
const InsightsPage = lazy(() =>
  import("@/pages/InsightsPage").then((m) => ({ default: m.InsightsPage })),
);
const FunnelsPage = lazy(() =>
  import("@/pages/FunnelsPage").then((m) => ({ default: m.FunnelsPage })),
);
const FunnelDetailPage = lazy(() =>
  import("@/pages/FunnelDetailPage").then((m) => ({
    default: m.FunnelDetailPage,
  })),
);
const FunnelComparePage = lazy(() =>
  import("@/pages/FunnelComparePage").then((m) => ({
    default: m.FunnelComparePage,
  })),
);
const UsersPage = lazy(() =>
  import("@/pages/UsersPage").then((m) => ({ default: m.UsersPage })),
);
const UserDetailPage = lazy(() =>
  import("@/pages/UserDetailPage").then((m) => ({
    default: m.UserDetailPage,
  })),
);
const RetentionPage = lazy(() =>
  import("@/pages/RetentionPage").then((m) => ({
    default: m.RetentionPage,
  })),
);
const CohortDetailPage = lazy(() =>
  import("@/pages/CohortDetailPage").then((m) => ({
    default: m.CohortDetailPage,
  })),
);
const SegmentsPage = lazy(() =>
  import("@/pages/SegmentsPage").then((m) => ({ default: m.SegmentsPage })),
);
const SegmentDetailPage = lazy(() =>
  import("@/pages/SegmentDetailPage").then((m) => ({
    default: m.SegmentDetailPage,
  })),
);
const FlowsPage = lazy(() =>
  import("@/pages/FlowsPage").then((m) => ({ default: m.FlowsPage })),
);
const PivotsPage = lazy(() =>
  import("@/pages/PivotsPage").then((m) => ({ default: m.PivotsPage })),
);
const TrendsPage = lazy(() =>
  import("@/pages/TrendsPage").then((m) => ({ default: m.TrendsPage })),
);
const BoardsPage = lazy(() =>
  import("@/pages/BoardsPage").then((m) => ({ default: m.BoardsPage })),
);
const BoardDetailPage = lazy(() =>
  import("@/pages/BoardDetailPage").then((m) => ({
    default: m.BoardDetailPage,
  })),
);
const TeamsListPage = lazy(() =>
  import("@/pages/TeamsListPage").then((m) => ({
    default: m.TeamsListPage,
  })),
);
const TeamDetailPage = lazy(() =>
  import("@/pages/TeamDetailPage").then((m) => ({
    default: m.TeamDetailPage,
  })),
);
const AcceptInvitationPage = lazy(() =>
  import("@/pages/AcceptInvitationPage").then((m) => ({
    default: m.AcceptInvitationPage,
  })),
);
const CliAuthPage = lazy(() =>
  import("@/pages/CliAuthPage").then((m) => ({ default: m.CliAuthPage })),
);
const CliPage = lazy(() =>
  import("@/pages/CliPage").then((m) => ({ default: m.CliPage })),
);

// Minimal loading fallback
function PageSkeleton() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

const STORAGE_KEY = "truesight_last_project";

function LastProjectRedirect() {
  const lastProjectId = (() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  if (lastProjectId) {
    return <Navigate to={`/projects/${lastProjectId}`} replace />;
  }

  return (
    <SuspenseWrapper>
      <ProjectsListPage />
    </SuspenseWrapper>
  );
}

function lazy$(element: React.ReactNode) {
  return <SuspenseWrapper>{element}</SuspenseWrapper>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/invitations/accept",
    element: lazy$(<AcceptInvitationPage />),
  },
  {
    path: "/cli/auth",
    element: lazy$(<CliAuthPage />),
  },
  {
    path: "/",
    element: (
      <ProtectedLayout>
        <App />
      </ProtectedLayout>
    ),
    children: [
      {
        index: true,
        element: <LastProjectRedirect />,
      },
      {
        path: "projects",
        element: lazy$(<ProjectsListPage />),
      },
      {
        path: "projects/:id",
        element: lazy$(<ProjectDetailPage />),
      },
      {
        path: "projects/:id/settings",
        element: lazy$(<ProjectSettingsPage />),
      },
      {
        path: "projects/:id/cli",
        element: lazy$(<CliPage />),
      },
      {
        path: "projects/:id/events",
        element: lazy$(<EventsPage />),
      },
      {
        path: "projects/:id/events/live",
        element: lazy$(<EventsPage />),
      },
      {
        path: "projects/:id/events/catalog",
        element: lazy$(<EventsPage />),
      },
      {
        path: "projects/:id/event-catalog",
        element: <Navigate to="../events/catalog" replace />,
      },
      {
        path: "projects/:id/analytics",
        element: lazy$(<AnalyticsPage />),
      },
      {
        path: "projects/:id/funnels",
        element: lazy$(<FunnelsPage />),
      },
      {
        path: "projects/:id/funnels/compare",
        element: lazy$(<FunnelComparePage />),
      },
      {
        path: "projects/:id/funnels/:funnelId",
        element: lazy$(<FunnelDetailPage />),
      },
      {
        path: "projects/:id/insights",
        element: lazy$(<InsightsPage />),
      },
      {
        path: "projects/:id/trends",
        element: lazy$(<TrendsPage />),
      },
      {
        path: "projects/:id/pivots",
        element: lazy$(<PivotsPage />),
      },
      {
        path: "projects/:id/users",
        element: lazy$(<UsersPage />),
      },
      {
        path: "projects/:id/users/:userId",
        element: lazy$(<UserDetailPage />),
      },
      {
        path: "projects/:id/retention",
        element: lazy$(<RetentionPage />),
      },
      {
        path: "projects/:id/segments",
        element: lazy$(<SegmentsPage />),
      },
      {
        path: "projects/:id/segments/:segmentId",
        element: lazy$(<SegmentDetailPage />),
      },
      {
        path: "projects/:id/cohorts",
        element: <Navigate to="../segments" replace />,
      },
      {
        path: "projects/:id/cohorts/:cohortId",
        element: lazy$(<CohortDetailPage />),
      },
      {
        path: "projects/:id/boards",
        element: lazy$(<BoardsPage />),
      },
      {
        path: "projects/:id/boards/:boardId",
        element: lazy$(<BoardDetailPage />),
      },
      {
        path: "projects/:id/flows",
        element: lazy$(<FlowsPage />),
      },
      {
        path: "teams",
        element: lazy$(<TeamsListPage />),
      },
      {
        path: "teams/:id",
        element: lazy$(<TeamDetailPage />),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
