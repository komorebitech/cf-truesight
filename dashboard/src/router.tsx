import { createBrowserRouter } from "react-router";
import { App } from "@/App";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { LoginPage } from "@/pages/LoginPage";
import { ProjectsListPage } from "@/pages/ProjectsListPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { EventExplorerPage } from "@/pages/EventExplorerPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { FunnelsPage } from "@/pages/FunnelsPage";
import { FunnelDetailPage } from "@/pages/FunnelDetailPage";
import { FunnelComparePage } from "@/pages/FunnelComparePage";
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
