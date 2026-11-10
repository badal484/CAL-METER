import { FoodSource, DataQuality, ServingProvenance, roundTo } from '@calmeter/shared';
import type { PackagedProductDto, PackagedProductNutrients } from '@calmeter/contracts';
import {
  RateLimitError,
  DependencyUnavailableError,
  ProviderTimeoutError,
} from '../../lib/errors.js';
import type { IBarcodeDataProvider } from './barcodeProvider.interface.js';

export interface OpenFoodFactsBarcodeProviderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class OpenFoodFactsBarcodeProvider implements IBarcodeDataProvider {
  readonly providerName = 'Open Food Facts';
  private baseUrl: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options?: OpenFoodFactsBarcodeProviderOptions) {
    this.baseUrl = (options?.baseUrl || 'https://world.openfoodfacts.org').replace(/\/+$/, '');
    this.timeoutMs = options?.timeoutMs || 3500;
    this.fetchFn = options?.fetchFn || globalThis.fetch;
  }

  async lookupBarcode(barcode: string): Promise<PackagedProductDto | null> {
    const cleanBarcode = barcode.replace(/[\s\-_]/g, '').trim();
    const url = `${this.baseUrl}/api/v2/product/${encodeURIComponent(cleanBarcode)}.json?fields=code,product_name,product_name_en,brands,manufacturers,image_url,categories_tags,countries_tags,ingredients_text,allergens_tags,serving_size,serving_quantity,nutriments`;

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'CalMeter/1.0 (contact@calmeter.app) - Nutrition Tracker Android/iOS',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        throw new ProviderTimeoutError('Open Food Facts API lookup timed out.');
      }
      throw new DependencyUnavailableError(
        `Open Food Facts network request failed: ${err?.message || 'Unknown network error'}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 429) {
      throw new RateLimitError('Open Food Facts API rate limit exceeded.');
    }

    if (response.status === 404) {
      return null;
    }

    if (response.status >= 500) {
      throw new DependencyUnavailableError('Open Food Facts upstream server error.');
    }

    if (!response.ok) {
      return null;
    }

    let body: any;
    try {
      body = await response.json();
    } catch {
      return null;
    }

    if (!body || body.status === 0 || !body.product) {
      return null;
    }

    return this.normalizeOffProduct(body.product, cleanBarcode);
  }

  private normalizeOffProduct(p: any, cleanBarcode: string): PackagedProductDto {
    const name = (p.product_name || p.product_name_en || '').trim() || `Product ${cleanBarcode}`;
    const brand = p.brands ? p.brands.split(',')[0]?.trim() || null : null;
    const manufacturer = p.manufacturers ? p.manufacturers.split(',')[0]?.trim() || null : null;
    const imageUrl = p.image_url || null;

    const categories = Array.isArray(p.categories_tags)
      ? p.categories_tags
          .map((c: string) =>
            c
              .replace(/^[a-z]+:/i, '')
              .replace(/-/g, ' ')
              .trim(),
          )
          .filter(Boolean)
      : [];

    const countries = Array.isArray(p.countries_tags)
      ? p.countries_tags
          .map((c: string) =>
            c
              .replace(/^[a-z]+:/i, '')
              .replace(/-/g, ' ')
              .trim(),
          )
          .filter(Boolean)
      : [];

    const ingredientsText = p.ingredients_text ? p.ingredients_text.trim() : null;

    const allergens = Array.isArray(p.allergens_tags)
      ? p.allergens_tags
          .map((a: string) =>
            a
              .replace(/^[a-z]+:/i, '')
              .replace(/-/g, ' ')
              .trim(),
          )
          .filter(Boolean)
      : [];

    // Parse serving size & quantity
    let servingSize = 100;
    let servingUnit = 'g';
    let isLiquid = false;

    if (p.serving_quantity && Number(p.serving_quantity) > 0) {
      servingSize = Number(p.serving_quantity);
    } else if (p.serving_size) {
      const match = String(p.serving_size).match(/([\d.]+)\s*(g|ml|l|oz)?/i);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (Number.isFinite(val) && val > 0) {
          servingSize = val;
        }
        if (match[2]) {
          servingUnit = match[2].toLowerCase();
        }
      }
    }

    if (
      servingUnit === 'ml' ||
      servingUnit === 'l' ||
      categories.some((c: string) => /beverage|drink|juice|soda|milk|water/i.test(c))
    ) {
      isLiquid = true;
      if (servingUnit === 'l') {
        servingSize = servingSize * 1000;
        servingUnit = 'ml';
      }
    }

    const n = p.nutriments || {};

    const calories = Math.max(0, Number(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0));
    const protein = Math.max(0, Number(n.proteins_100g ?? n.proteins ?? 0));
    const carbs = Math.max(0, Number(n.carbohydrates_100g ?? n.carbohydrates ?? 0));
    const fat = Math.max(0, Number(n.fat_100g ?? n.fat ?? 0));

    const saturatedFat =
      n['saturated-fat_100g'] !== undefined && n['saturated-fat_100g'] !== null
        ? Math.max(0, Number(n['saturated-fat_100g']))
        : null;
    const transFat =
      n['trans-fat_100g'] !== undefined && n['trans-fat_100g'] !== null
        ? Math.max(0, Number(n['trans-fat_100g']))
        : null;
    const fiber =
      n.fiber_100g !== undefined && n.fiber_100g !== null
        ? Math.max(0, Number(n.fiber_100g))
        : null;
    const sugar =
      n.sugars_100g !== undefined && n.sugars_100g !== null
        ? Math.max(0, Number(n.sugars_100g))
        : null;
    const addedSugar =
      n['added-sugars_100g'] !== undefined && n['added-sugars_100g'] !== null
        ? Math.max(0, Number(n['added-sugars_100g']))
        : null;

    let sodium: number | null = null;
    if (n.sodium_100g !== undefined && n.sodium_100g !== null) {
      sodium = Math.round(Math.max(0, Number(n.sodium_100g) * 1000));
    } else if (n.salt_100g !== undefined && n.salt_100g !== null) {
      sodium = Math.round(Math.max(0, Number(n.salt_100g) * 387.58));
    }

    const cholesterol =
      n.cholesterol_100g !== undefined && n.cholesterol_100g !== null
        ? Math.round(Math.max(0, Number(n.cholesterol_100g) * 1000))
        : null;
    const potassium =
      n.potassium_100g !== undefined && n.potassium_100g !== null
        ? Math.round(Math.max(0, Number(n.potassium_100g) * 1000))
        : null;
    const calcium =
      n.calcium_100g !== undefined && n.calcium_100g !== null
        ? Math.round(Math.max(0, Number(n.calcium_100g) * 1000))
        : null;
    const iron =
      n.iron_100g !== undefined && n.iron_100g !== null
        ? roundTo(Math.max(0, Number(n.iron_100g) * 1000), 2)
        : null;

    const missingNutrients: string[] = [];
    if (saturatedFat === null) missingNutrients.push('saturatedFat');
    if (transFat === null) missingNutrients.push('transFat');
    if (fiber === null) missingNutrients.push('fiber');
    if (sugar === null) missingNutrients.push('sugar');
    if (addedSugar === null) missingNutrients.push('addedSugar');
    if (sodium === null) missingNutrients.push('sodium');
    if (cholesterol === null) missingNutrients.push('cholesterol');
    if (potassium === null) missingNutrients.push('potassium');
    if (calcium === null) missingNutrients.push('calcium');
    if (iron === null) missingNutrients.push('iron');
    missingNutrients.push('vitaminD', 'vitaminB12');

    const nutrientsPer100g: PackagedProductNutrients = {
      calories,
      protein,
      carbs,
      fat,
      saturatedFat,
      transFat,
      fiber,
      sugar,
      addedSugar,
      sodium,
      cholesterol,
      potassium,
      calcium,
      iron,
      vitaminD: null,
      vitaminB12: null,
      micronutrients: {},
    };

    // Calculate per-serving nutrients
    let nutrientsPerServing: PackagedProductNutrients | null = null;
    if (servingSize > 0 && Math.abs(servingSize - 100) > 0.01) {
      const factor = servingSize / 100;
      nutrientsPerServing = {
        calories: roundTo(calories * factor, 1),
        protein: roundTo(protein * factor, 1),
        carbs: roundTo(carbs * factor, 1),
        fat: roundTo(fat * factor, 1),
        saturatedFat: saturatedFat !== null ? roundTo(saturatedFat * factor, 2) : null,
        transFat: transFat !== null ? roundTo(transFat * factor, 2) : null,
        fiber: fiber !== null ? roundTo(fiber * factor, 2) : null,
        sugar: sugar !== null ? roundTo(sugar * factor, 2) : null,
        addedSugar: addedSugar !== null ? roundTo(addedSugar * factor, 2) : null,
        sodium: sodium !== null ? roundTo(sodium * factor, 1) : null,
        cholesterol: cholesterol !== null ? roundTo(cholesterol * factor, 1) : null,
        potassium: potassium !== null ? roundTo(potassium * factor, 1) : null,
        calcium: calcium !== null ? roundTo(calcium * factor, 1) : null,
        iron: iron !== null ? roundTo(iron * factor, 2) : null,
        vitaminD: null,
        vitaminB12: null,
        micronutrients: {},
      };
    } else {
      nutrientsPerServing = { ...nutrientsPer100g };
    }

    const servingConversions = [];
    if (servingSize > 0 && Math.abs(servingSize - 100) > 0.01) {
      servingConversions.push({
        unit: 'serving',
        gramWeight: servingSize,
        provenance: ServingProvenance.MANUFACTURER,
        isDefault: true,
        notes: p.serving_size || `1 serving (${servingSize}${servingUnit})`,
      });
    }

    const dataQuality =
      calories === 0 && protein === 0 && carbs === 0 && fat === 0
        ? DataQuality.INCOMPLETE
        : DataQuality.EXTERNAL_SOURCE;

    return {
      id: '00000000-0000-0000-0000-000000000000', // Replaced upon persistence or transient response
      barcode: cleanBarcode,
      additionalBarcodes: [],
      name,
      brand,
      manufacturer,
      imageUrl,
      categories,
      countries,
      ingredientsText,
      allergens,
      servingSize,
      servingUnit,
      standardWeightGrams: 100,
      netWeightGrams: null,
      isLiquid,
      nutrientsPer100g,
      nutrientsPerServing,
      servingConversions,
      source: FoodSource.OPEN_FOOD_FACTS,
      attribution: 'Data sourced from Open Food Facts under ODbL 1.0',
      license: 'Open Database License (ODbL) v1.0',
      isVerified: false,
      dataQuality,
      missingNutrients,
    };
  }
}
