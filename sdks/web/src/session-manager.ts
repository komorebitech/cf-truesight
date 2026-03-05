const SESSION_ID_KEY = 'truesight_session_id';
const LAST_ACTIVITY_KEY = 'truesight_last_activity';
const SESSION_START_KEY = 'truesight_session_start';

export class SessionManager {
  private sessionTimeout: number;
  private onSessionEvent: (eventName: string, properties: Record<string, unknown>) => void;
  private sessionId: string | null = null;
  private lastActivityTime: number = 0;
  private sessionStartTime: number = 0;

  constructor(
    sessionTimeout: number,
    onSessionEvent: (eventName: string, properties: Record<string, unknown>) => void
  ) {
    this.sessionTimeout = sessionTimeout;
    this.onSessionEvent = onSessionEvent;
    this.restore();
  }

  private restore(): void {
    if (typeof sessionStorage === 'undefined') return;
    const storedId = sessionStorage.getItem(SESSION_ID_KEY);
    const storedActivity = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    const storedStart = sessionStorage.getItem(SESSION_START_KEY);
    if (storedId && storedActivity) {
      const lastActivity = parseInt(storedActivity, 10);
      if (Date.now() - lastActivity < this.sessionTimeout) {
        this.sessionId = storedId;
        this.lastActivityTime = lastActivity;
        const startTs = storedStart ? parseInt(storedStart, 10) : NaN;
        this.sessionStartTime = Number.isFinite(startTs) ? startTs : lastActivity;
        return;
      }
    }
    // No valid session — will start on first getSessionId()
  }

  getSessionId(): string {
    if (!this.sessionId) {
      this.startSession();
    }
    return this.sessionId!;
  }

  startSession(): void {
    this.sessionId = crypto.randomUUID();
    this.lastActivityTime = Date.now();
    this.sessionStartTime = this.lastActivityTime;
    this.persist();
    this.onSessionEvent('$session_start', { session_id: this.sessionId });
  }

  endSession(): void {
    if (!this.sessionId) return;
    const durationSeconds = Math.round((Date.now() - this.sessionStartTime) / 1000);
    this.onSessionEvent('$session_end', {
      session_id: this.sessionId,
      duration_seconds: durationSeconds,
    });
    this.sessionId = null;
    this.lastActivityTime = 0;
    this.sessionStartTime = 0;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_ID_KEY);
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      sessionStorage.removeItem(SESSION_START_KEY);
    }
  }

  touchActivity(): void {
    const now = Date.now();
    if (this.sessionId && now - this.lastActivityTime > this.sessionTimeout) {
      this.endSession();
      this.startSession();
    } else {
      this.lastActivityTime = now;
      this.persist();
    }
  }

  reset(): void {
    this.endSession();
    this.startSession();
  }

  destroy(): void {
    this.endSession();
  }

  private persist(): void {
    if (typeof sessionStorage === 'undefined') return;
    if (this.sessionId) {
      sessionStorage.setItem(SESSION_ID_KEY, this.sessionId);
      sessionStorage.setItem(LAST_ACTIVITY_KEY, this.lastActivityTime.toString());
      sessionStorage.setItem(SESSION_START_KEY, this.sessionStartTime.toString());
    }
  }
}
