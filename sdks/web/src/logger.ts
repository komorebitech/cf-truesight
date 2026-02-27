export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const PREFIX = '[TrueSight]';

export class Logger {
  private level: number;

  constructor(debug: boolean = false) {
    this.level = debug ? LOG_LEVELS.debug : LOG_LEVELS.warn;
  }

  setDebug(debug: boolean): void {
    this.level = debug ? LOG_LEVELS.debug : LOG_LEVELS.warn;
  }

  debug(...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.debug) {
      console.debug(PREFIX, ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.info) {
      console.info(PREFIX, ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(PREFIX, ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.error) {
      console.error(PREFIX, ...args);
    }
  }
}

export const logger = new Logger();
