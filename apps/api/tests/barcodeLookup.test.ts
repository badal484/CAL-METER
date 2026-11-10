import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient, FoodSource as PrismaFoodSource } from '@prisma/client';
import { createApp } from '../src/app.js';
import { validateTestDatabaseUrl } from '../src/lib/testDbGuard.js';
import type { IFirebaseTokenVerifier, FirebaseDecodedToken } from '../src/lib/firebase.js';
import { OpenFoodFactsBarcodeProvider } from '../src/services/barcode/openFoodFactsBarcode.provider.js';
import { BarcodeLookupService } from '../src/services/barcode/barcodeLookup.service.js';
import { createFoodRouter } from '../src/routes/food.routes.js';

class TestAuthVerifier implements IFirebaseTokenVerifier {
  private users: Map<string, FirebaseDecodedToken> = new Map();

  register(token: string, payload: FirebaseDecodedToken) {
    this.users.set(token, payload);
  }

  async verifyIdToken(token: string): Promise<FirebaseDecodedToken> {
    const user = this.users.get(token);
    if (!user) throw new Error('Invalid test token');
    return user;
  }
}

describe('Barcode Scanner & Packaged Food Recognition API', () => {
  let prisma: PrismaClient;
  let verifier: TestAuthVerifier;
  let app: any;

  const TOKEN_USER_A = 'token-barcode-user-a';
  const TOKEN_USER_B = 'token-barcode-user-b';

  let userAId: string;
  let _userBId: string;
  let seededFoodId: string;

  // Track created entities for safe cleanup
  const createdFoodIds: string[] = [];

  beforeAll(async () => {
    const testDbUrl =
      process.env.TEST_DATABASE_URL ||
      'postgresql://calmeter:calmeter@localhost:5432/calmeter_test';
    const nodeEnv = process.env.NODE_ENV || 'test';
    const validatedDb = validateTestDatabaseUrl(testDbUrl, nodeEnv);

    prisma = new PrismaClient({
      datasourceUrl: validatedDb.url,
    });
    await prisma.$connect();

    verifier = new TestAuthVerifier();
    verifier.register(TOKEN_USER_A, {
      uid: 'fb-barcode-user-a',
      email: 'barcode-a@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    verifier.register(TOKEN_USER_B, {
      uid: 'fb-barcode-user-b',
      email: 'barcode-b@test.com',
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const userA = await prisma.user.upsert({
      where: { firebaseUid: 'fb-barcode-user-a' },
      update: {},
      create: {
        firebaseUid: 'fb-barcode-user-a',
        email: 'barcode-a@test.com',
        name: 'Barcode User A',
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.upsert({
      where: { firebaseUid: 'fb-barcode-user-b' },
      update: {},
      create: {
        firebaseUid: 'fb-barcode-user-b',
        email: 'barcode-b@test.com',
        name: 'Barcode User B',
      },
    });
    _userBId = userB.id;

    // Clean up any old test foods with our test barcodes
    await prisma.foodItem.deleteMany({
      where: {
        barcode: {
          in: ['8901030825484', '08901030825484', '737628064502', '5901234123457', '8901491101836'],
        },
      },
    });

    // Seed a canonical verified packaged food into internal database:
    // Parle-G Biscuits (Barcode: 8901030825484)
    const seeded = await prisma.foodItem.create({
      data: {
        name: 'Parle-G Original Gluco Biscuits',
        brand: 'Parle',
        manufacturer: 'Parle Products Pvt. Ltd.',
        barcode: '8901030825484',
        source: PrismaFoodSource.OPEN_FOOD_FACTS,
        cuisine: 'INDIAN',
        servingSize: 30,
        servingUnit: 'g',
        standardWeightGrams: 100,
        calories: 450,
        protein: 7.5,
        carbs: 78,
        fat: 13,
        fiber: 2.5,
        imageUrl: 'https://images.openfoodfacts.org/images/products/parle-g.jpg',
        ingredientsText: 'Wheat flour, sugar, edible vegetable oil, invert sugar syrup, salt.',
        allergens: ['wheat', 'gluten'],
        countries: ['India', 'United States'],
        isVerified: true,
        isCustom: false,
        nutrientProfile: {
          create: {
            calories: 450,
            protein: 7.5,
            carbs: 78,
            fat: 13,
            fiber: 2.5,
            sugar: 26,
            sodium: 280,
            saturatedFat: 6,
            transFat: 0,
            calcium: 40,
            iron: 1.2,
          },
        },
        barcodes: {
          createMany: {
            data: [
              { barcode: '8901030825484', format: 'EAN_13' },
              { barcode: '08901030825484', format: 'UPC_A' }, // Multi-barcode linking!
            ],
          },
        },
        servingConversions: {
          create: {
            unitName: 'biscuit',
            servingDescription: '1 biscuit (~5g)',
            gramWeight: 5,
            isDefault: true,
            provenance: 'MANUFACTURER',
          },
        },
      },
    });
    seededFoodId = seeded.id;
    createdFoodIds.push(seededFoodId);

    app = createApp({ prisma, verifier });
  });

  afterAll(async () => {
    if (createdFoodIds.length > 0) {
      await prisma.foodItem.deleteMany({
        where: { id: { in: createdFoodIds } },
      });
    }
    await prisma.$disconnect();
  });

  describe('1. Barcode Validation & Error Taxonomy', () => {
    it('rejects an invalid EAN-13 check digit with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/foods/barcode/8901030825480'); // check digit is 4, not 0
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('check digit');
    });

    it('rejects an invalid UPC-A check digit with 400 VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/v1/foods/barcode/737628064509'); // check digit is 2, not 9
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unsupported characters or malformed barcodes', async () => {
      const res = await request(app).get('/api/v1/foods/barcode/invalid@barcode');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('normalizes spaces and hyphens in the barcode path parameter', async () => {
      const res = await request(app).get('/api/v1/foods/barcode/ 890-1030-825484 ');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.barcode).toBe('8901030825484');
    });
  });

  describe('2. Internal Database Barcode Match', () => {
    it('retrieves verified packaged food details and per-100g / per-serving nutrition', async () => {
      const res = await request(app).get('/api/v1/foods/barcode/8901030825484');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const product = res.body.data;
      expect(product.id).toBe(seededFoodId);
      expect(product.name).toBe('Parle-G Original Gluco Biscuits');
      expect(product.brand).toBe('Parle');
      expect(product.manufacturer).toBe('Parle Products Pvt. Ltd.');
      expect(product.isVerified).toBe(true);
      expect(product.dataQuality).toBe('VERIFIED');
      expect(product.allergens).toContain('wheat');
      expect(product.allergens).toContain('gluten');
      expect(product.countries).toContain('India');

      // Nutrients per 100g
      expect(product.nutrientsPer100g.calories).toBe(450);
      expect(product.nutrientsPer100g.protein).toBe(7.5);
      expect(product.nutrientsPer100g.carbs).toBe(78);
      expect(product.nutrientsPer100g.fat).toBe(13);
      expect(product.nutrientsPer100g.fiber).toBe(2.5);
      expect(product.nutrientsPer100g.sugar).toBe(26);
      expect(product.nutrientsPer100g.sodium).toBe(280);

      // Nutrients per serving (30g = 0.3 * per 100g)
      expect(product.nutrientsPerServing).toBeDefined();
      expect(product.nutrientsPerServing.calories).toBe(135); // 450 * 0.3
      expect(product.nutrientsPerServing.protein).toBe(2.3); // 7.5 * 0.3 = 2.25 -> rounded to 2.3
      expect(product.nutrientsPerServing.carbs).toBe(23.4); // 78 * 0.3 = 23.4
      expect(product.nutrientsPerServing.fat).toBe(3.9); // 13 * 0.3 = 3.9

      // Serving conversions
      expect(product.servingConversions.length).toBeGreaterThan(0);
      expect(product.servingConversions[0].unit).toBe('biscuit');
      expect(product.servingConversions[0].gramWeight).toBe(5);
    });

    it('resolves product via secondary barcode in food_barcodes table (multi-barcode linking)', async () => {
      // 08901030825484 was registered as a secondary barcode pointing to the same item
      const res = await request(app).get('/api/v1/foods/barcode/08901030825484');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(seededFoodId);
      expect(res.body.data.name).toBe('Parle-G Original Gluco Biscuits');
    });
  });

  describe('3. Multi-Tenant Custom Food Isolation', () => {
    let customFoodId: string;
    const customBarcode = '8909999999994'; // Valid unassigned test EAN-13

    beforeAll(async () => {
      const custom = await prisma.foodItem.create({
        data: {
          name: "User A's Homemade Granola Bar",
          brand: 'Kitchen Crafted',
          barcode: customBarcode,
          source: PrismaFoodSource.CUSTOM_USER,
          isCustom: true,
          isVerified: false,
          createdByUserId: userAId,
          servingSize: 50,
          servingUnit: 'g',
          standardWeightGrams: 100,
          calories: 380,
          protein: 10,
          carbs: 52,
          fat: 14,
          fiber: 6,
        },
      });
      customFoodId = custom.id;
      createdFoodIds.push(customFoodId);
    });

    it('allows User A (creator) to look up their custom food by barcode', async () => {
      const res = await request(app)
        .get(`/api/v1/foods/barcode/${customBarcode}`)
        .set('Authorization', `Bearer ${TOKEN_USER_A}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(customFoodId);
      expect(res.body.data.name).toBe("User A's Homemade Granola Bar");
      expect(res.body.data.dataQuality).toBe('USER_ENTERED');
    });

    it('strictly returns 404 PRODUCT_NOT_FOUND when User B looks up User A custom barcode (anti-enumeration)', async () => {
      const res = await request(app)
        .get(`/api/v1/foods/barcode/${customBarcode}`)
        .set('Authorization', `Bearer ${TOKEN_USER_B}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('strictly returns 404 PRODUCT_NOT_FOUND for unauthenticated caller accessing custom food', async () => {
      const res = await request(app).get(`/api/v1/foods/barcode/${customBarcode}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('4. External Food Provider Integration (Open Food Facts)', () => {
    it('retrieves external product, normalizes nutrients, and persists to local DB with attribution', async () => {
      const offBarcode = '5901234123457'; // Valid EAN-13

      const mockOffResponse = {
        status: 1,
        code: offBarcode,
        product: {
          code: offBarcode,
          product_name: 'Organic Rolled Oats',
          brands: 'Nordic Harvest, Organic Oats',
          manufacturers: 'Nordic Mills Ltd',
          image_url: 'https://images.openfoodfacts.org/images/nordic_oats.jpg',
          categories_tags: ['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:rolled-oats'],
          countries_tags: ['en:poland', 'en:germany', 'en:india'],
          ingredients_text: '100% whole grain rolled oats.',
          allergens_tags: ['en:gluten'],
          serving_size: '40 g (1/2 cup)',
          serving_quantity: 40,
          nutriments: {
            'energy-kcal_100g': 375,
            proteins_100g: 13,
            carbohydrates_100g: 62,
            fat_100g: 7,
            'saturated-fat_100g': 1.2,
            fiber_100g: 10,
            sugars_100g: 1,
            sodium_100g: 0.005, // 0.005g = 5mg
            calcium_100g: 0.054, // 54mg
            iron_100g: 0.0047, // 4.7mg
            // vitaminD and vitaminB12 unmeasured / missing
          },
        },
      };

      const mockFetch: typeof fetch = async (url: any) => {
        if (String(url).includes(offBarcode)) {
          return {
            ok: true,
            status: 200,
            json: async () => mockOffResponse,
          } as Response;
        }
        return { ok: false, status: 404, json: async () => ({ status: 0 }) } as Response;
      };

      const customOffProvider = new OpenFoodFactsBarcodeProvider({ fetchFn: mockFetch });
      const customBarcodeService = new BarcodeLookupService({
        prisma,
        externalProvider: customOffProvider,
      });

      const customApp = createApp({
        prisma,
        verifier,
        foodRouter: createFoodRouter({ prisma, verifier, barcodeService: customBarcodeService }),
      });

      const res = await request(customApp).get(`/api/v1/foods/barcode/${offBarcode}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const product = res.body.data;
      createdFoodIds.push(product.id);

      expect(product.name).toBe('Organic Rolled Oats');
      expect(product.brand).toBe('Nordic Harvest');
      expect(product.manufacturer).toBe('Nordic Mills Ltd');
      expect(product.barcode).toBe(offBarcode);
      expect(product.source).toBe('OPEN_FOOD_FACTS');
      expect(product.attribution).toContain('Open Food Facts');
      expect(product.isVerified).toBe(false);
      expect(product.dataQuality).toBe('EXTERNAL_SOURCE');

      // Nutrients per 100g
      expect(product.nutrientsPer100g.calories).toBe(375);
      expect(product.nutrientsPer100g.protein).toBe(13);
      expect(product.nutrientsPer100g.carbs).toBe(62);
      expect(product.nutrientsPer100g.fat).toBe(7);
      expect(product.nutrientsPer100g.fiber).toBe(10);
      expect(product.nutrientsPer100g.sodium).toBe(5); // converted from 0.005g to 5mg!

      // Strict preservation of null for unmeasured nutrients
      expect(product.nutrientsPer100g.vitaminD).toBeNull();
      expect(product.nutrientsPer100g.vitaminB12).toBeNull();
      expect(product.missingNutrients).toContain('vitaminD');
      expect(product.missingNutrients).toContain('vitaminB12');

      // Nutrients per serving (40g = 0.4 * 100g)
      expect(product.nutrientsPerServing).toBeDefined();
      expect(product.nutrientsPerServing.calories).toBe(150); // 375 * 0.4
      expect(product.nutrientsPerServing.protein).toBe(5.2); // 13 * 0.4

      // Assert persisted into local database for O(1) subsequent lookup
      const inDb = await prisma.foodItem.findUnique({
        where: { barcode: offBarcode },
        include: { barcodes: true },
      });
      expect(inDb).toBeDefined();
      expect(inDb?.name).toBe('Organic Rolled Oats');
      expect(inDb?.barcodes.some(b => b.barcode === offBarcode)).toBe(true);
    });

    it('handles provider timeout gracefully with 504 PROVIDER_TIMEOUT', async () => {
      const timeoutBarcode = '8901491101837'; // Valid EAN-13

      const mockTimeoutFetch: typeof fetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const timeoutProvider = new OpenFoodFactsBarcodeProvider({ fetchFn: mockTimeoutFetch });
      const timeoutService = new BarcodeLookupService({
        prisma,
        externalProvider: timeoutProvider,
      });

      const timeoutApp = createApp({
        prisma,
        verifier,
        foodRouter: createFoodRouter({ prisma, verifier, barcodeService: timeoutService }),
      });

      const res = await request(timeoutApp).get(`/api/v1/foods/barcode/${timeoutBarcode}`);
      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROVIDER_TIMEOUT');
    });

    it('handles provider rate limit gracefully with 429 RATE_LIMIT_EXCEEDED', async () => {
      const rateLimitBarcode = '8901491101837';

      const mockRateLimitFetch: typeof fetch = async () => {
        return {
          ok: false,
          status: 429,
          json: async () => ({}),
        } as Response;
      };

      const rateLimitProvider = new OpenFoodFactsBarcodeProvider({ fetchFn: mockRateLimitFetch });
      const rateLimitService = new BarcodeLookupService({
        prisma,
        externalProvider: rateLimitProvider,
      });

      const rateLimitApp = createApp({
        prisma,
        verifier,
        foodRouter: createFoodRouter({ prisma, verifier, barcodeService: rateLimitService }),
      });

      const res = await request(rateLimitApp).get(`/api/v1/foods/barcode/${rateLimitBarcode}`);
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('handles provider upstream server error gracefully with 503 DEPENDENCY_UNAVAILABLE', async () => {
      const serverErrorBarcode = '8901491101837';

      const mock500Fetch: typeof fetch = async () => {
        return {
          ok: false,
          status: 502,
          json: async () => ({}),
        } as Response;
      };

      const serverErrorProvider = new OpenFoodFactsBarcodeProvider({ fetchFn: mock500Fetch });
      const serverErrorService = new BarcodeLookupService({
        prisma,
        externalProvider: serverErrorProvider,
      });

      const errorApp = createApp({
        prisma,
        verifier,
        foodRouter: createFoodRouter({ prisma, verifier, barcodeService: serverErrorService }),
      });

      const res = await request(errorApp).get(`/api/v1/foods/barcode/${serverErrorBarcode}`);
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    });

    it('returns 404 PRODUCT_NOT_FOUND when product is not found in provider', async () => {
      const notFoundBarcode = '8901491101837';

      const mockNotFoundFetch: typeof fetch = async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 0, status_verbose: 'product not found' }),
        } as Response;
      };

      const notFoundProvider = new OpenFoodFactsBarcodeProvider({ fetchFn: mockNotFoundFetch });
      const notFoundService = new BarcodeLookupService({
        prisma,
        externalProvider: notFoundProvider,
      });

      const notFoundApp = createApp({
        prisma,
        verifier,
        foodRouter: createFoodRouter({ prisma, verifier, barcodeService: notFoundService }),
      });

      const res = await request(notFoundApp).get(`/api/v1/foods/barcode/${notFoundBarcode}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('5. Manual Barcode Lookup Endpoint: POST /api/v1/foods/barcode/lookup', () => {
    it('accepts valid barcode JSON body and returns product', async () => {
      const res = await request(app)
        .post('/api/v1/foods/barcode/lookup')
        .send({ barcode: '8901030825484' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(seededFoodId);
      expect(res.body.data.name).toBe('Parle-G Original Gluco Biscuits');
    });

    it('rejects invalid or missing barcode in POST body with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/foods/barcode/lookup')
        .send({ barcode: '8901030825480' }); // Invalid check digit (ends in 0 instead of 4)

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
