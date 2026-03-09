import { useParams, useNavigate, useLocation } from "react-router";
import { PageLayout } from "@/components/PageLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EventExplorerContent } from "@/components/EventExplorerContent";
import { LiveEventsContent } from "@/components/LiveEventsContent";
import { EventCatalogContent } from "@/components/EventCatalogContent";
import { List, Radio, BookOpen } from "lucide-react";

export function EventsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.endsWith("/live")
    ? "live"
    : location.pathname.endsWith("/catalog")
      ? "catalog"
      : "explorer";

  const handleTabChange = (value: string) => {
    if (value === "live") {
      navigate(`/projects/${id}/events/live`);
    } else if (value === "catalog") {
      navigate(`/projects/${id}/events/catalog`);
    } else {
      navigate(`/projects/${id}/events`);
    }
  };

  return (
    <PageLayout title="Events" spacing={false}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="explorer" className="gap-1.5">
              <List className="h-3.5 w-3.5" />
              Explorer
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-1.5">
              <Radio className="h-3.5 w-3.5" />
              Live
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Catalog
            </TabsTrigger>
          </TabsList>

          <TabsContent value="explorer">
            <EventExplorerContent />
          </TabsContent>

          <TabsContent value="live">
            <LiveEventsContent />
          </TabsContent>

          <TabsContent value="catalog">
            <EventCatalogContent />
          </TabsContent>
        </Tabs>
    </PageLayout>
  );
}
