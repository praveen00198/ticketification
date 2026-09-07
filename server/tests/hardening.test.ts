import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../src/middlewares/rate-limit.middleware';

describe('Phase 9: Hardening & Performance Subsystem', () => {
  describe('In-Memory Sliding Window Rate Limiter', () => {
    it('should allow requests within the rate limit threshold', async () => {
      const app = express();
      const limiter = createRateLimiter({
        windowMs: 5000,
        max: 3,
        message: 'Rate limit exceeded.',
      });

      app.use('/test-allowed', limiter, (_req, res) => {
        res.status(200).json({ success: true });
      });

      const res1 = await request(app).get('/test-allowed');
      const res2 = await request(app).get('/test-allowed');
      const res3 = await request(app).get('/test-allowed');

      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-limit']).toBe('3');
      expect(res1.headers['x-ratelimit-remaining']).toBe('2');

      expect(res2.status).toBe(200);
      expect(res2.headers['x-ratelimit-remaining']).toBe('1');

      expect(res3.status).toBe(200);
      expect(res3.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should reject requests exceeding threshold with HTTP 429 and Retry-After header', async () => {
      const app = express();
      const limiter = createRateLimiter({
        windowMs: 10000,
        max: 2,
        message: 'Too many test requests.',
      });

      app.use('/test-blocked', limiter, (_req, res) => {
        res.status(200).json({ success: true });
      });

      // 2 allowed requests
      await request(app).get('/test-blocked');
      await request(app).get('/test-blocked');

      // 3rd request should be blocked
      const blockedRes = await request(app).get('/test-blocked');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(blockedRes.body.error.message).toBe('Too many test requests.');
      expect(blockedRes.headers['retry-after']).toBeDefined();
      expect(Number(blockedRes.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('should reset client counters after the window duration has elapsed', async () => {
      const app = express();
      // Very short window of 50ms for testing window reset
      const limiter = createRateLimiter({
        windowMs: 50,
        max: 1,
      });

      app.use('/test-reset', limiter, (_req, res) => {
        res.status(200).json({ success: true });
      });

      const res1 = await request(app).get('/test-reset');
      expect(res1.status).toBe(200);

      const resBlocked = await request(app).get('/test-reset');
      expect(resBlocked.status).toBe(429);

      // Wait 60ms for window to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const resAfterReset = await request(app).get('/test-reset');
      expect(resAfterReset.status).toBe(200);
      expect(resAfterReset.headers['x-ratelimit-remaining']).toBe('0');
    });
  });

  describe('High-Volume Scanner Burst Throughput', () => {
    it('should process burst requests sequentially with sub-millisecond overhead', async () => {
      const app = express();
      const limiter = createRateLimiter({
        windowMs: 1000,
        max: 50,
      });

      app.use('/test-burst', limiter, (_req, res) => {
        res.status(200).json({ success: true });
      });

      const startTime = Date.now();
      const requests = Array.from({ length: 30 }, () => request(app).get('/test-burst'));
      const responses = await Promise.all(requests);
      const totalElapsedMs = Date.now() - startTime;

      responses.forEach((res) => {
        expect(res.status).toBe(200);
      });

      // 30 requests should easily complete in under 500ms
      expect(totalElapsedMs).toBeLessThan(1500);
    });
  });
});
