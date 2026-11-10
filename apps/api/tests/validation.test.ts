import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../src/middleware/validate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { UpdateNutritionGoalSchema, LogWeightSchema } from '@calmeter/contracts';

describe('Zod Validation Middleware with @calmeter/contracts', () => {
  const createValidationApp = () => {
    const app = express();
    app.use(express.json());

    // Route using UpdateNutritionGoalSchema from contracts
    app.post('/goals', validateBody(UpdateNutritionGoalSchema), (req: Request, res: Response) => {
      res.status(200).json({ success: true, data: req.body });
    });

    // Route using LogWeightSchema
    app.post('/weight', validateBody(LogWeightSchema), (req: Request, res: Response) => {
      res.status(200).json({ success: true, data: req.body });
    });

    // Route with Query validation
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD date format'),
    });
    app.get('/history', validateQuery(querySchema), (req: Request, res: Response) => {
      res.status(200).json({ success: true, data: req.query });
    });

    // Route with Params validation
    const paramsSchema = z.object({
      itemId: z.string().uuid('Item ID must be a valid UUID'),
    });
    app.get('/items/:itemId', validateParams(paramsSchema), (req: Request, res: Response) => {
      res.status(200).json({ success: true, data: req.params });
    });

    app.use(errorHandler);
    return app;
  };

  describe('validateBody', () => {
    it('accepts valid NutritionGoal payload and returns 200', async () => {
      const app = createValidationApp();
      const validPayload = {
        dailyCalories: 2200,
        proteinGrams: 150,
        carbsGrams: 220,
        fatGrams: 65,
        fiberGrams: 30,
        waterMl: 2500,
      };

      const res = await request(app).post('/goals').send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dailyCalories).toBe(2200);
    });

    it('rejects invalid body returning 400 VALIDATION_ERROR with field-level details', async () => {
      const app = createValidationApp();
      const invalidPayload = {
        dailyCalories: -100, // Invalid: must be positive
        proteinGrams: 'not-a-number', // Invalid type
        carbsGrams: 220,
        fatGrams: -10, // Invalid: must be non-negative
      };

      const res = await request(app).post('/goals').send(invalidPayload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Invalid request body.');
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);

      const fields = res.body.error.details.map((d: { field?: string }) => d.field);
      expect(fields).toContain('dailyCalories');
      expect(fields).toContain('proteinGrams');
    });

    it('rejects out-of-range weight reading using LogWeightSchema', async () => {
      const app = createValidationApp();
      const outOfRange = { weightKg: 10 }; // Contracts reject weight < 30 kg

      const res = await request(app).post('/weight').send(outOfRange);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'weightKg' })]),
      );
    });
  });

  describe('validateQuery', () => {
    it('accepts valid query parameters and coerces numbers', async () => {
      const app = createValidationApp();
      const res = await request(app).get('/history?limit=25&date=2026-11-10');

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(25);
      expect(res.body.data.date).toBe('2026-11-10');
    });

    it('rejects malformed query parameter with 400 VALIDATION_ERROR', async () => {
      const app = createValidationApp();
      const res = await request(app).get('/history?limit=999&date=invalid-date');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'limit' }),
          expect.objectContaining({ field: 'date' }),
        ]),
      );
    });
  });

  describe('validateParams', () => {
    it('accepts valid UUID route parameter', async () => {
      const app = createValidationApp();
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/items/${validUuid}`);

      expect(res.status).toBe(200);
      expect(res.body.data.itemId).toBe(validUuid);
    });

    it('rejects non-UUID route parameter with 400 VALIDATION_ERROR', async () => {
      const app = createValidationApp();
      const res = await request(app).get('/items/non-uuid-string');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'itemId' })]),
      );
    });
  });
});
