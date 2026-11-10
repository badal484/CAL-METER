import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { seedFoodDatabase } from '../src/services/foodSeed.service.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';

describe('Food Search API & Discovery Engine', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    // Strictly validate test database URL before any test connection
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    const nodeEnv = process.env.NODE_ENV || 'test';
    const validatedDb = validateTestDatabaseUrl(testDbUrl, nodeEnv);

    prisma = new PrismaClient({
      datasourceUrl: validatedDb.url,
    });

    // Populate catalog
    await seedFoodDatabase(prisma);

    app = createApp({ prisma });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('searches foods by exact and partial canonical name', async () => {
    const res = await request(app).get('/api/v1/foods?q=roti');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const names = res.body.data.map((f: { name: string }) => f.name.toLowerCase());
    expect(names.some((n: string) => n.includes('roti'))).toBe(true);
  });

  it('performs case-insensitive search with leading and trailing whitespaces', async () => {
    const res = await request(app).get('/api/v1/foods?q=%20%20rOTi%20%20');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name.toLowerCase()).toContain('roti');
  });

  it('searches foods by regional and transliterated aliases', async () => {
    // "phulka" is an alias for "Whole Wheat Roti / Phulka"
    const res = await request(app).get('/api/v1/foods?q=phulka');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toContain('Phulka');

    // "maa ki dal" is an alias for "Dal Makhani"
    const resDal = await request(app).get('/api/v1/foods?q=maa%20ki%20dal');
    expect(resDal.status).toBe(200);
    expect(resDal.body.data.length).toBeGreaterThan(0);
    expect(resDal.body.data[0].name).toContain('Dal Makhani');
  });

  it('searches packaged foods by brand name', async () => {
    const res = await request(app).get('/api/v1/foods?q=Amul');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].brand).toBe('Amul');
  });

  it('searches packaged foods by exact barcode', async () => {
    const res = await request(app).get('/api/v1/foods?barcode=8901262010053');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].barcode).toBe('8901262010053');
    expect(res.body.data[0].name).toBe('Amul Pasteurized Butter');
  });

  it('filters foods by cuisine', async () => {
    const res = await request(app).get('/api/v1/foods?cuisine=INDIAN_SOUTH');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(item.cuisine).toBe('INDIAN_SOUTH');
    }
  });

  it('respects pagination limit and page offsets', async () => {
    const resPage1 = await request(app).get('/api/v1/foods?page=1&limit=5');
    expect(resPage1.status).toBe(200);
    expect(resPage1.body.data).toHaveLength(5);
    expect(resPage1.body.meta.page).toBe(1);
    expect(resPage1.body.meta.limit).toBe(5);

    const resPage2 = await request(app).get('/api/v1/foods?page=2&limit=5');
    expect(resPage2.status).toBe(200);
    expect(resPage2.body.data).toHaveLength(5);
    expect(resPage2.body.meta.page).toBe(2);

    // Verify disjoint pages
    const idsPage1 = new Set(resPage1.body.data.map((f: { id: string }) => f.id));
    for (const item of resPage2.body.data) {
      expect(idsPage1.has(item.id)).toBe(false);
    }
  });

  it('rejects unbounded page size exceeding 100', async () => {
    const res = await request(app).get('/api/v1/foods?limit=500');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sorts foods by protein descending', async () => {
    const res = await request(app).get('/api/v1/foods?sortBy=protein&sortOrder=desc&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(1);

    for (let i = 0; i < res.body.data.length - 1; i++) {
      expect(res.body.data[i].protein).toBeGreaterThanOrEqual(res.body.data[i + 1].protein);
    }
  });

  it('ranks exact and prefix matches highest in relevance sorting', async () => {
    const res = await request(app).get('/api/v1/foods?q=Idli');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Exact match "Idli" must be first
    expect(res.body.data[0].name).toBe('Idli');
  });
});
