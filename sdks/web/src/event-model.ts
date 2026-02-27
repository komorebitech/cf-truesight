export type EventType = 'track' | 'identify' | 'screen';

export interface DeviceContext {
  app_version: string;
  os_name: string;
  os_version: string;
  device_model: string;
  device_id: string;
  network_type: string;
  locale: string;
  timezone: string;
  sdk_version: string;
  screen_width: number;
  screen_height: number;
}

export interface TrueSightEvent {
  event_id: string;
  event_name: string;
  event_type: EventType;
  user_id: string | null;
  anonymous_id: string;
  mobile_number: string | null;
  email: string | null;
  client_timestamp: string;
  properties: Record<string, unknown>;
  context: DeviceContext;
}

export interface BatchPayload {
  batch: TrueSightEvent[];
  sent_at: string;
}
