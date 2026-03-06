import type { LiveEvent } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function eventTypeBadgeVariant(type: string) {
  switch (type) {
    case "track":
      return "default" as const;
    case "identify":
      return "success" as const;
    case "screen":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

interface LiveEventDetailProps {
  event: LiveEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

export function LiveEventDetail({
  event,
  open,
  onOpenChange,
}: LiveEventDetailProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Event Detail</SheetTitle>
          <SheetDescription>Full event information</SheetDescription>
        </SheetHeader>
        {event && (
          <div
            className="mt-6 overflow-auto"
            style={{ height: "calc(100vh - 140px)" }}
          >
            <dl className="space-y-4">
              <DetailField label="Event Name">
                <span className="font-medium">{event.event_name}</span>
              </DetailField>

              <DetailField label="Type">
                <Badge variant={eventTypeBadgeVariant(event.event_type)}>
                  {event.event_type}
                </Badge>
              </DetailField>

              {event.user_id && (
                <DetailField label="User ID">
                  <span className="text-muted-foreground">{event.user_id}</span>
                </DetailField>
              )}

              <DetailField label="Anonymous ID">
                <span className="font-mono text-xs text-muted-foreground">
                  {event.anonymous_id}
                </span>
              </DetailField>

              {event.email && (
                <DetailField label="Email">
                  <span className="text-muted-foreground">{event.email}</span>
                </DetailField>
              )}

              {event.mobile_number && (
                <DetailField label="Mobile Number">
                  <span className="text-muted-foreground">
                    {event.mobile_number}
                  </span>
                </DetailField>
              )}

              <DetailField label="Client Timestamp">
                <span className="text-muted-foreground">
                  {formatDate(event.client_timestamp)}
                </span>
              </DetailField>

              <DetailField label="Server Timestamp">
                <span className="text-muted-foreground">
                  {formatDate(event.server_timestamp)}
                </span>
              </DetailField>

              {event.os_name && (
                <DetailField label="OS">
                  <span className="text-muted-foreground">{event.os_name}</span>
                </DetailField>
              )}

              {event.device_model && (
                <DetailField label="Device">
                  <span className="text-muted-foreground">
                    {event.device_model}
                  </span>
                </DetailField>
              )}

              {event.sdk_version && (
                <DetailField label="SDK Version">
                  <span className="font-mono text-xs text-muted-foreground">
                    {event.sdk_version}
                  </span>
                </DetailField>
              )}

              <div>
                <dt className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Properties
                </dt>
                <dd>
                  <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">
                    {JSON.stringify(
                      JSON.parse(event.properties || "{}"),
                      null,
                      2,
                    )}
                  </pre>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
