// ---------------------------------------------------------------------------
// TrueSight Admin API client
// ---------------------------------------------------------------------------

const baseURL = import.meta.env.VITE_API_URL ?? "/api/v1";
const configuredToken: string | undefined = import.meta.env.VITE_ADMIN_TOKEN;

// ---------------------------------------------------------------------------
// Types — aligned with backend responses
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
}

export interface UpdateProjectInput {
  name?: string;
  active?: boolean;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiKey {
  id: string;
  project_id: string;
  prefix: string;
  label: string;
  environment: "live" | "test";
  active: boolean;
  created_at: string;
}

export interface GenerateApiKeyInput {
  project_id: string;
  label: string;
  environment: "live" | "test";
}

export interface GenerateApiKeyResponse extends ApiKey {
  key: string; // plaintext key, shown only once
}

export interface EventCountResponse {
  project_id: string;
  from: string;
  to: string;
  total_events: number;
}

export interface ThroughputPoint {
  timestamp: string;
  count: number;
}

export interface ThroughputResponse {
  project_id: string;
  granularity: string;
  data: ThroughputPoint[];
}

export interface EventTypeBreakdownResponse {
  by_type: Record<string, number>;
  top_events: { name: string; count: number }[];
}

export interface TrackedEvent {
  event_id: string;
  project_id: string;
  event_name: string;
  event_type: string;
  anonymous_id: string;
  user_id?: string;
  properties: string;
  client_timestamp: string;
  server_timestamp: string;
  os_name: string;
  device_model: string;
  sdk_version: string;
}

export interface EventsListResponse {
  data: TrackedEvent[];
  meta: { page: number; per_page: number; has_more: boolean };
}

export interface EventFilters {
  from?: string;
  to?: string;
  event_type?: string;
  event_name?: string;
  user_id?: string;
  anonymous_id?: string;
  page?: number;
  per_page?: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
  active?: boolean;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// Generic request helper
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseURL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = configuredToken ?? localStorage.getItem("admin_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Project endpoints
// ---------------------------------------------------------------------------

export function getProjects(params?: PaginationParams) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  if (params?.active !== undefined) qs.set("active", String(params.active));
  const query = qs.toString();
  return request<PaginatedResponse<Project>>(
    "GET",
    `/projects${query ? `?${query}` : ""}`,
  );
}

export function getProject(id: string) {
  return request<Project>("GET", `/projects/${id}`);
}

export function createProject(input: CreateProjectInput) {
  return request<Project>("POST", "/projects", input);
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return request<Project>("PATCH", `/projects/${id}`, input);
}

export function deleteProject(id: string) {
  return request<void>("DELETE", `/projects/${id}`);
}

// ---------------------------------------------------------------------------
// API key endpoints
// ---------------------------------------------------------------------------

export function getApiKeys(projectId: string) {
  return request<ApiKey[]>(
    "GET",
    `/projects/${projectId}/api-keys`,
  );
}

export function generateApiKey(input: GenerateApiKeyInput) {
  return request<GenerateApiKeyResponse>(
    "POST",
    `/projects/${input.project_id}/api-keys`,
    { label: input.label, environment: input.environment },
  );
}

export function revokeApiKey(projectId: string, keyId: string) {
  return request<void>(
    "DELETE",
    `/projects/${projectId}/api-keys/${keyId}`,
  );
}

// ---------------------------------------------------------------------------
// Stats endpoints
// ---------------------------------------------------------------------------

export function getEventCount(projectId: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  return request<EventCountResponse>(
    "GET",
    `/stats/projects/${projectId}/event-count${query ? `?${query}` : ""}`,
  );
}

export function getThroughput(
  projectId: string,
  from?: string,
  to?: string,
  granularity?: string,
) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (granularity) qs.set("granularity", granularity);
  const query = qs.toString();
  return request<ThroughputResponse>(
    "GET",
    `/stats/projects/${projectId}/throughput${query ? `?${query}` : ""}`,
  );
}

export function getEventTypes(projectId: string, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  return request<EventTypeBreakdownResponse>(
    "GET",
    `/stats/projects/${projectId}/event-types${query ? `?${query}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Active users endpoints
// ---------------------------------------------------------------------------

export interface ActiveUsersPoint {
  period: string;
  active_users: number;
  new_users: number;
}

export interface ActiveUsersResponse {
  project_id: string;
  granularity: string;
  data: ActiveUsersPoint[];
}

export function getActiveUsers(
  projectId: string,
  from?: string,
  to?: string,
  granularity?: string,
) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (granularity) qs.set("granularity", granularity);
  const query = qs.toString();
  return request<ActiveUsersResponse>(
    "GET",
    `/stats/projects/${projectId}/active-users${query ? `?${query}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Live users endpoints
// ---------------------------------------------------------------------------

export interface LiveUsersResponse {
  project_id: string;
  active_users_5m: number;
  active_users_30m: number;
}

export function getLiveUsers(projectId: string) {
  return request<LiveUsersResponse>(
    "GET",
    `/stats/projects/${projectId}/live-users`,
  );
}

// ---------------------------------------------------------------------------
// Funnel endpoints
// ---------------------------------------------------------------------------

export interface FunnelStep {
  event_name: string;
  filters?: Record<string, string>;
}

export interface Funnel {
  id: string;
  project_id: string;
  name: string;
  steps: FunnelStep[];
  window_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface CreateFunnelInput {
  name: string;
  steps: FunnelStep[];
  window_seconds?: number;
}

export interface UpdateFunnelInput {
  name?: string;
  steps?: FunnelStep[];
  window_seconds?: number;
}

export interface FunnelStepResult {
  step: number;
  event_name: string;
  users: number;
  conversion_rate: number;
}

export interface FunnelResultsResponse {
  funnel_id: string;
  from: string;
  to: string;
  steps: FunnelStepResult[];
  overall_conversion: number;
}

export interface CompareFunnelsResponse {
  funnels: FunnelResultsResponse[];
}

export function getFunnels(projectId: string) {
  return request<Funnel[]>("GET", `/projects/${projectId}/funnels`);
}

export function getFunnel(projectId: string, funnelId: string) {
  return request<Funnel>("GET", `/projects/${projectId}/funnels/${funnelId}`);
}

export function createFunnel(projectId: string, input: CreateFunnelInput) {
  return request<Funnel>("POST", `/projects/${projectId}/funnels`, input);
}

export function updateFunnel(
  projectId: string,
  funnelId: string,
  input: UpdateFunnelInput,
) {
  return request<Funnel>(
    "PATCH",
    `/projects/${projectId}/funnels/${funnelId}`,
    input,
  );
}

export function deleteFunnel(projectId: string, funnelId: string) {
  return request<void>(
    "DELETE",
    `/projects/${projectId}/funnels/${funnelId}`,
  );
}

export function getFunnelResults(
  projectId: string,
  funnelId: string,
  from?: string,
  to?: string,
) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  return request<FunnelResultsResponse>(
    "GET",
    `/projects/${projectId}/funnels/${funnelId}/results${query ? `?${query}` : ""}`,
  );
}

export function compareFunnels(
  projectId: string,
  funnelIds: string[],
  from?: string,
  to?: string,
) {
  const qs = new URLSearchParams();
  qs.set("funnel_ids", funnelIds.join(","));
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return request<CompareFunnelsResponse>(
    "GET",
    `/projects/${projectId}/funnels/compare?${qs.toString()}`,
  );
}

export function compareFunnelTimeRanges(
  projectId: string,
  funnelId: string,
  fromA: string,
  toA: string,
  fromB: string,
  toB: string,
) {
  const qs = new URLSearchParams();
  qs.set("from_a", fromA);
  qs.set("to_a", toA);
  qs.set("from_b", fromB);
  qs.set("to_b", toB);
  return request<CompareFunnelsResponse>(
    "GET",
    `/projects/${projectId}/funnels/${funnelId}/compare?${qs.toString()}`,
  );
}

// ---------------------------------------------------------------------------
// Event explorer endpoints
// ---------------------------------------------------------------------------

export function getEvents(projectId: string, filters?: EventFilters) {
  const qs = new URLSearchParams();
  if (filters?.from) qs.set("from", filters.from);
  if (filters?.to) qs.set("to", filters.to);
  if (filters?.event_type) qs.set("event_type", filters.event_type);
  if (filters?.event_name) qs.set("event_name", filters.event_name);
  if (filters?.user_id) qs.set("user_id", filters.user_id);
  if (filters?.anonymous_id) qs.set("anonymous_id", filters.anonymous_id);
  if (filters?.page) qs.set("page", String(filters.page));
  if (filters?.per_page) qs.set("per_page", String(filters.per_page));
  const query = qs.toString();
  return request<EventsListResponse>(
    "GET",
    `/stats/projects/${projectId}/events${query ? `?${query}` : ""}`,
  );
}
