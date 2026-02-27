import { createBrowserRouter } from "react-router";
import { App } from "@/App";
import { ProjectsListPage } from "@/pages/ProjectsListPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { EventExplorerPage } from "@/pages/EventExplorerPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { FunnelsPage } from "@/pages/FunnelsPage";
import { FunnelDetailPage } from "@/pages/FunnelDetailPage";
import { FunnelComparePage } from "@/pages/FunnelComparePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
