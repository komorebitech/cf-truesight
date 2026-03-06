import { useParams, useNavigate, useLocation } from "react-router";
import { Header } from "@/components/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EventExplorerContent } from "@/components/EventExplorerContent";
import { LiveEventsContent } from "@/components/LiveEventsContent";
import { List, Radio } from "lucide-react";

export function EventsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isLive = location.pathname.endsWith("/live");
  const activeTab = isLive ? "live" : "explorer";

  const handleTabChange = (value: string) => {
    if (value === "live") {
      navigate(`/projects/${id}/events/live`);
    } else {
      navigate(`/projects/${id}/events`);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Events" />

      <div className="flex-1 p-6">
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
          </TabsList>

          <TabsContent value="explorer">
            <EventExplorerContent />
          </TabsContent>

          <TabsContent value="live">
            <LiveEventsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
