import { createBrowserRouter } from "react-router";
import { App } from "@/App";
import { ProjectsListPage } from "@/pages/ProjectsListPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { EventExplorerPage } from "@/pages/EventExplorerPage";
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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
