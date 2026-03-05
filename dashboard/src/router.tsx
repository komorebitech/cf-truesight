import { createBrowserRouter } from "react-router";
import { App } from "@/App";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { LoginPage } from "@/pages/LoginPage";
import { ProjectsListPage } from "@/pages/ProjectsListPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { EventExplorerPage } from "@/pages/EventExplorerPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { InsightsPage } from "@/pages/InsightsPage";
import { FunnelsPage } from "@/pages/FunnelsPage";
import { FunnelDetailPage } from "@/pages/FunnelDetailPage";
import { FunnelComparePage } from "@/pages/FunnelComparePage";
import { UsersPage } from "@/pages/UsersPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { RetentionPage } from "@/pages/RetentionPage";
import { CohortsPage } from "@/pages/CohortsPage";
import { CohortDetailPage } from "@/pages/CohortDetailPage";
import { FlowsPage } from "@/pages/FlowsPage";
import { TeamsListPage } from "@/pages/TeamsListPage";
import { TeamDetailPage } from "@/pages/TeamDetailPage";
import { AcceptInvitationPage } from "@/pages/AcceptInvitationPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/invitations/accept",
    element: <AcceptInvitationPage />,
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
        element: <ProjectsListPage />,
      },
      {
        path: "projects/:id",
        element: <ProjectDetailPage />,
      },
      {
        path: "projects/:id/events",
        element: <EventExplorerPage />,
      },
      {
        path: "projects/:id/analytics",
        element: <AnalyticsPage />,
      },
      {
        path: "projects/:id/funnels",
        element: <FunnelsPage />,
      },
      {
        path: "projects/:id/funnels/compare",
        element: <FunnelComparePage />,
      },
      {
        path: "projects/:id/funnels/:funnelId",
        element: <FunnelDetailPage />,
      },
      {
        path: "projects/:id/insights",
        element: <InsightsPage />,
      },
      {
        path: "projects/:id/users",
        element: <UsersPage />,
      },
      {
        path: "projects/:id/users/:userId",
        element: <UserDetailPage />,
      },
      {
        path: "projects/:id/retention",
        element: <RetentionPage />,
      },
      {
        path: "projects/:id/cohorts",
        element: <CohortsPage />,
      },
      {
        path: "projects/:id/cohorts/:cohortId",
        element: <CohortDetailPage />,
      },
      {
        path: "projects/:id/flows",
        element: <FlowsPage />,
      },
      {
        path: "teams",
        element: <TeamsListPage />,
      },
      {
        path: "teams/:id",
        element: <TeamDetailPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
