type RateLimitEntry = {
  count: number;
  resetTime: number;
};

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if a request is rate limited.
   * @param key - Unique identifier for the rate limit (e.g., phone number or IP)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns { allowed: boolean, resetTime: number, remaining: number }
   */
  checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
  ): { allowed: boolean; resetTime: number; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, resetTime, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
      // Rate limit exceeded
      return { allowed: false, resetTime: entry.resetTime, remaining: 0 };
    }

    // Increment count
    entry.count += 1;
    this.store.set(key, entry);
    return { allowed: true, resetTime: entry.resetTime, remaining: limit - entry.count };
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimiter();

export type SmsRateLimitOptions = {
  phoneNumber: string;
  /** Maximum SMS messages per phone number per window (default: 3) */
  maxPerPhone?: number;
  /** Time window in minutes (default: 60) */
  windowMinutes?: number;
};

/**
 * Check if SMS sending is rate limited for a phone number.
 */
export const checkSmsRateLimit = (options: SmsRateLimitOptions) => {
  const { phoneNumber, maxPerPhone = 3, windowMinutes = 60 } = options;

  const windowMs = windowMinutes * 60 * 1000;
  const key = `sms:${phoneNumber}`;

  return rateLimiter.checkRateLimit(key, maxPerPhone, windowMs);
};

export const rateLimiterCleanup = () => {
  rateLimiter.destroy();
};

// Export for testing
export { rateLimiter };
