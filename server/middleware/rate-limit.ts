import { rateLimit } from "express-rate-limit";
import type { Store, IncrementResponse } from "express-rate-limit";
import type { Request } from "express";
import { pool } from "../db";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 5;

class PostgresRateLimitStore implements Store {
  private initialized = false;

  private async init(): Promise<void> {
    if (this.initialized) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        key VARCHAR PRIMARY KEY,
        hits INTEGER NOT NULL DEFAULT 1,
        reset_time TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    this.initialized = true;
  }

  async increment(key: string): Promise<IncrementResponse> {
    await this.init();
    const windowSecs = WINDOW_MS / 1000;
    const result = await pool.query<{ hits: number; reset_time: Date }>(
      `
      INSERT INTO rate_limit_hits (key, hits, reset_time, updated_at)
      VALUES ($1, 1, NOW() + ($2 || ' seconds')::interval, NOW())
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE
          WHEN rate_limit_hits.reset_time <= NOW() THEN 1
          ELSE rate_limit_hits.hits + 1
        END,
        reset_time = CASE
          WHEN rate_limit_hits.reset_time <= NOW() THEN NOW() + ($2 || ' seconds')::interval
          ELSE rate_limit_hits.reset_time
        END,
        updated_at = NOW()
      RETURNING hits, reset_time
      `,
      [key, windowSecs]
    );
    const row = result.rows[0];
    return {
      totalHits: row.hits,
      resetTime: row.reset_time,
    };
  }

  async decrement(key: string): Promise<void> {
    await this.init();
    await pool.query(
      `UPDATE rate_limit_hits SET hits = GREATEST(0, hits - 1), updated_at = NOW() WHERE key = $1`,
      [key]
    );
  }

  async resetKey(key: string): Promise<void> {
    await this.init();
    await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [key]);
  }
}

function getUserId(req: Request): string {
  const user = (req as any).user;
  return (req.session as any)?.localUserId || user?.claims?.sub || "anonymous";
}

export const aiGenerationRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: new PostgresRateLimitStore(),
  keyGenerator: getUserId,
  skip: (req) => {
    const userId = getUserId(req);
    return userId === "anonymous";
  },
  handler: (_req, res) => {
    const retryAfter = parseInt(String(res.getHeader("Retry-After") ?? "60"), 10) || 60;
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many generation requests. You are limited to ${MAX_REQUESTS} per minute. Please try again in ${retryAfter} second(s).`,
        retryAfter,
      },
    });
  },
});
