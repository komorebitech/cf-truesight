export interface Config {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  maxBatchSize: number;
  maxQueueSize: number;
  maxQueueHard: number;
  maxEventSize: number;
  debug: boolean;
}

export const DEFAULT_CONFIG: Omit<Config, 'apiKey' | 'endpoint'> = {
  flushInterval: 30000,
  maxBatchSize: 20,
  maxQueueSize: 1000,
  maxQueueHard: 5000,
  maxEventSize: 32768,
  debug: false,
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
