/**
 * Activity Tracker
 * Monitors user activity to determine if the session should timeout
 */

const ACTIVITY_KEY = 'lastUserActivity';
const ACTIVITY_THROTTLE = 5000; // Only update every 5 seconds to avoid performance issues

class ActivityTracker {
  private lastActivityTime: number;
  private throttleTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.lastActivityTime = Date.now();
    this.loadLastActivity();
  }

  /**
   * Initialize activity tracking
   */
  public init(): void {
    if (typeof window === 'undefined') return;

    // Track various user activities
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    events.forEach(event => {
      window.addEventListener(event, this.handleActivity, { passive: true });
    });

    // Also track page visibility changes
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Track route changes (for Next.js)
    if (typeof window !== 'undefined') {
      const originalPushState = history.pushState;
      history.pushState = (...args) => {
        this.updateActivity();
        return originalPushState.apply(history, args);
      };
    }

    console.log('🔍 Activity tracker initialized');
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    if (typeof window === 'undefined') return;

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    events.forEach(event => {
      window.removeEventListener(event, this.handleActivity);
    });

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
    }
  }

  /**
   * Handle user activity
   */
  private handleActivity = (): void => {
    // Throttle activity updates to avoid performance issues
    if (this.throttleTimeout) return;

    this.throttleTimeout = setTimeout(() => {
      this.throttleTimeout = null;
    }, ACTIVITY_THROTTLE);

    this.updateActivity();
  };

  /**
   * Handle visibility changes
   */
  private handleVisibilityChange = (): void => {
    if (!document.hidden) {
      // User returned to the page
      this.updateActivity();
    }
  };

  /**
   * Update last activity timestamp
   */
  public updateActivity(): void {
    this.lastActivityTime = Date.now();
    this.saveLastActivity();
    this.notifyListeners();
  }

  /**
   * Get time since last activity in milliseconds
   */
  public getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  /**
   * Get last activity timestamp
   */
  public getLastActivityTime(): number {
    return this.lastActivityTime;
  }

  /**
   * Check if user has been inactive for specified duration
   */
  public isInactive(durationMs: number): boolean {
    return this.getTimeSinceLastActivity() >= durationMs;
  }

  /**
   * Save last activity to localStorage
   */
  private saveLastActivity(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(this.lastActivityTime));
    } catch (error) {
      console.error('Failed to save activity timestamp:', error);
    }
  }

  /**
   * Load last activity from localStorage
   */
  private loadLastActivity(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(ACTIVITY_KEY);
      if (stored) {
        const timestamp = parseInt(stored, 10);
        if (!isNaN(timestamp)) {
          this.lastActivityTime = timestamp;
        }
      }
    } catch (error) {
      console.error('Failed to load activity timestamp:', error);
    }
  }

  /**
   * Reset activity tracking
   */
  public reset(): void {
    this.lastActivityTime = Date.now();
    this.saveLastActivity();
    this.notifyListeners();
    console.log('🔄 Activity tracker reset');
  }

  /**
   * Add listener for activity updates
   */
  public addListener(callback: () => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove listener
   */
  public removeListener(callback: () => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of activity update
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Format time since last activity for display
   */
  public getFormattedInactivityTime(): string {
    const ms = this.getTimeSinceLastActivity();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    }
  }
}

// Create singleton instance
const activityTracker = new ActivityTracker();

export default activityTracker;
export { ActivityTracker };