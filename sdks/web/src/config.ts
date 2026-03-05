export interface AutoTrackConfig {
  pageViews: boolean;
  clicks: boolean;
  formSubmits: boolean;
  rageClicks: boolean;
  deadClicks: boolean;
  scrollDepth: boolean;
  timeOnPage: boolean;
  pageLoadTiming: boolean;
}

export interface Config {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  maxBatchSize: number;
  maxQueueSize: number;
  maxQueueHard: number;
  maxEventSize: number;
  debug: boolean;
  sessionTimeout: number;
  autoTrack: AutoTrackConfig;
}

export const DEFAULT_AUTO_TRACK: AutoTrackConfig = {
  pageViews: true,
  clicks: true,
  formSubmits: true,
  rageClicks: true,
  deadClicks: true,
  scrollDepth: true,
  timeOnPage: true,
  pageLoadTiming: true,
};

export const DEFAULT_CONFIG: Omit<Config, 'apiKey' | 'endpoint'> = {
  flushInterval: 30000,
  maxBatchSize: 20,
  maxQueueSize: 1000,
  maxQueueHard: 5000,
  maxEventSize: 32768,
  debug: false,
  sessionTimeout: 1_800_000,
  autoTrack: DEFAULT_AUTO_TRACK,
};

export function buildConfig(init: {
  apiKey: string;
  endpoint: string;
  options?: Partial<Config>;
}): Config {
  return {
    apiKey: init.apiKey,
    endpoint: init.endpoint,
    ...DEFAULT_CONFIG,
    ...init.options,
  };
}
