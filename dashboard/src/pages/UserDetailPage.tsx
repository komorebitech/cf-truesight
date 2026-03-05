import { useState, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router";
import { useUser, useUserEvents } from "@/hooks/use-users-ch";
import { Header } from "@/components/Header";
import { EnvironmentSelector } from "@/components/EnvironmentSelector";
import {
  TimeRangeSelector,
  type TimeRange,
  getPresetRange,
} from "@/components/TimeRangeSelector";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Mail,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { motion } from "motion/react";

function EventTypeColor(type: string) {
  switch (type) {
    case "track":
      return "default" as const;
    case "identify":
      return "success" as const;
    case "page":
      return "warning" as const;
    case "screen":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

const EVENT_PAGE_SIZE = 25;

export function UserDetailPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const environment = (searchParams.get("env") as "live" | "test") || "live";
  const setEnvironment = (env: "live" | "test") => {
    setSearchParams((prev) => {
      if (env === "live") { prev.delete("env"); } else { prev.set("env", env); }
      return prev;
    });
  };

  const [timeRange, setTimeRange] = useState<TimeRange>(() => getPresetRange("30d"));
  const [eventPage, setEventPage] = useState(1);

  const decodedUserId = userId ? decodeURIComponent(userId) : undefined;

  const { data: user, isLoading: userLoading } = useUser(id, decodedUserId, environment);
  const { data: eventsData, isLoading: eventsLoading } = useUserEvents(id, decodedUserId, {
    page: eventPage,
    per_page: EVENT_PAGE_SIZE,
    from: timeRange.from,
    to: timeRange.to,
    environment,
  });

  const properties = useMemo(() => {
    if (!user?.properties) return null;
    try {
      const parsed = JSON.parse(user.properties);
      if (typeof parsed === "object" && parsed !== null && Object.keys(parsed).length > 0) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }, [user?.properties]);

  const events = eventsData?.data;
  const hasMore = eventsData?.meta?.has_more ?? false;

  if (userLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex-1 space-y-6 p-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            variant="search"
            title="User not found"
            description="The user you are looking for does not exist or has been removed."
            action={{
              label: "Back to Users",
              onClick: () => window.history.back(),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header title={user.name || user.user_uid} />

      <div className="flex-1 space-y-6 p-6">
        {/* Back link */}
        <Link
          to={`/projects/${id}/users`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>

        {/* Profile and Properties cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-medium uppercase text-muted-foreground">
                        User ID
                      </dt>
                      <dd className="mt-0.5 break-all font-mono text-sm">
                        {user.user_uid}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-medium uppercase text-muted-foreground">
                        Email
                      </dt>
                      <dd className="mt-0.5 text-sm">
                        {user.email || <span className="text-muted-foreground">-</span>}
                      </dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Name
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      {user.name || <span className="text-muted-foreground">-</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Mobile Number
                    </dt>
                    <dd className="mt-0.5 text-sm">
                      {user.mobile_number || <span className="text-muted-foreground">-</span>}
                    </dd>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            First Seen
                          </dt>
                          <dd className="mt-0.5 text-sm">
                            {formatDate(user.first_seen)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase text-muted-foreground">
                            Last Seen
                          </dt>
                          <dd className="mt-0.5 text-sm">
                            {formatDate(user.last_seen)}
                          </dd>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">
                      Total Events
                    </dt>
                    <dd className="mt-0.5 text-lg font-bold">
                      {formatNumber(user.event_count)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </motion.div>

          {/* Properties card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Properties</CardTitle>
              </CardHeader>
              <CardContent>
                {properties ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(properties).map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell className="font-mono text-xs font-medium">
                            {key}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No custom properties set
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Event Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Event Timeline</CardTitle>
                <div className="flex items-center gap-3">
                  <EnvironmentSelector value={environment} onChange={setEnvironment} />
                  <TimeRangeSelector value={timeRange} onChange={(range) => {
                    setTimeRange(range);
                    setEventPage(1);
                  }} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Properties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsLoading ? (
                    <SkeletonTable columns={Array.from({ length: 4 })} rows={5} />
                  ) : !events || events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <EmptyState
                          variant="data"
                          title="No events"
                          description="No events found for this user in the selected time range"
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event, i) => (
                      <motion.tr
                        key={event.event_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.02 }}
                        className="border-b border-border/50 transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">
                          {event.event_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={EventTypeColor(event.event_type)}>
                            {event.event_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(event.client_timestamp)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                          {event.properties && event.properties !== "{}"
                            ? event.properties
                            : "-"}
                        </TableCell>
                      </motion.tr>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {events && events.length > 0 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {eventPage} &middot; {events.length} event{events.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventPage <= 1}
                      onClick={() => setEventPage(eventPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {eventPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setEventPage(eventPage + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
