import {
  IFoodVisionProvider,
  FoodRecognitionRequest,
  FoodRecognitionResponse,
  RecognizedFoodItem,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  MalformedModelOutputError,
} from '../types.js';

export type MockScenario =
  | 'single'
  | 'multi'
  | 'thali'
  | 'low_confidence'
  | 'empty'
  | 'timeout'
  | 'rate_limit'
  | 'outage'
  | 'malformed';

export class MockFoodVisionProvider implements IFoodVisionProvider {
  public readonly providerName = 'mock';
  public readonly defaultModel = 'mock-vision-v1';

  private currentScenario: MockScenario = 'single';
  private customItems: RecognizedFoodItem[] | null = null;

  constructor(initialScenario: MockScenario = 'single') {
    this.currentScenario = initialScenario;
  }

  public setScenario(scenario: MockScenario): void {
    this.currentScenario = scenario;
    this.customItems = null;
  }

  public setCustomItems(items: RecognizedFoodItem[]): void {
    this.customItems = items;
  }

  async recognizeFood(_request: FoodRecognitionRequest): Promise<FoodRecognitionResponse> {
    // Check error scenarios first
    if (this.currentScenario === 'timeout') {
      throw new ProviderTimeoutError('Mock vision provider simulated a 15-second timeout.');
    }

    if (this.currentScenario === 'rate_limit') {
      throw new ProviderRateLimitError(
        'Mock vision provider simulated HTTP 429 Too Many Requests.',
      );
    }

    if (this.currentScenario === 'outage') {
      throw new ProviderUnavailableError(
        'Mock vision provider simulated HTTP 503 Service Unavailable.',
      );
    }

    if (this.currentScenario === 'malformed') {
      throw new MalformedModelOutputError(
        'Mock vision provider simulated invalid JSON truncated payload.',
      );
    }

    // If custom items are set, return them
    if (this.customItems) {
      return {
        provider: this.providerName,
        model: this.defaultModel,
        latencyMs: 120,
        usage: { promptTokens: 450, completionTokens: 180 },
        items: this.customItems,
        sceneContext: {
          plateType: 'CERAMIC_PLATE',
          ambientLighting: 'GOOD',
          itemCount: this.customItems.length,
        },
        uncertaintyNotes: [],
      };
    }

    // Single item scenario
    if (this.currentScenario === 'single') {
      const items: RecognizedFoodItem[] = [
        {
          id: 'cand-1',
          name: 'Whole Wheat Roti / Phulka',
          alternateNames: ['Phulka', 'Chapati', 'Roti'],
          category: 'bread',
          cuisine: 'North Indian',
          preparationMethod: 'Dry roasted on tawa and puffed over open flame',
          rawCookedState: 'COOKED',
          components: ['whole wheat flour', 'water'],
          portion: {
            quantity: 2,
            unit: 'piece',
            estimatedGrams: 70,
            minGrams: 60,
            maxGrams: 80,
            servingDescription: '2 medium phulkas (~35g each)',
            confidence: 0.95,
          },
          confidenceScore: 0.98,
          visualIndicators: {
            oilSheen: 'DRY',
            apparentSizeCm: 16,
          },
        },
      ];

      return {
        provider: this.providerName,
        model: this.defaultModel,
        latencyMs: 145,
        usage: { promptTokens: 380, completionTokens: 120 },
        items,
        sceneContext: {
          plateType: 'CERAMIC_PLATE',
          ambientLighting: 'GOOD',
          itemCount: 1,
        },
        uncertaintyNotes: [
          'Visual portion estimation carries uncertainty (approx. +/- 15%). Confirm portions before logging.',
        ],
      };
    }

    // Multi-item on plate scenario
    if (this.currentScenario === 'multi') {
      const items: RecognizedFoodItem[] = [
        {
          id: 'cand-1',
          name: 'Whole Wheat Roti / Phulka',
          alternateNames: ['Phulka', 'Chapati', 'Roti'],
          category: 'bread',
          cuisine: 'North Indian',
          preparationMethod: 'Dry roasted and brushed lightly with ghee',
          rawCookedState: 'COOKED',
          components: ['whole wheat flour', 'water', 'ghee'],
          portion: {
            quantity: 2,
            unit: 'piece',
            estimatedGrams: 70,
            minGrams: 60,
            maxGrams: 80,
            servingDescription: '2 medium rotis (~35g each)',
            confidence: 0.92,
          },
          confidenceScore: 0.96,
          visualIndicators: { oilSheen: 'MODERATE' },
        },
        {
          id: 'cand-2',
          name: 'Dal Tadka (Home-style)',
          alternateNames: ['Yellow Dal', 'Toor Dal Tadka'],
          category: 'curry',
          cuisine: 'North Indian',
          preparationMethod: 'Tempered with cumin seeds, garlic, and ghee',
          rawCookedState: 'COOKED',
          components: ['toor dal', 'cumin', 'garlic', 'ghee', 'tomato'],
          portion: {
            quantity: 1,
            unit: 'katori',
            estimatedGrams: 200,
            minGrams: 170,
            maxGrams: 230,
            servingDescription: '1 medium katori (~200g)',
            confidence: 0.88,
          },
          confidenceScore: 0.94,
          visualIndicators: { oilSheen: 'MODERATE' },
        },
      ];

      return {
        provider: this.providerName,
        model: this.defaultModel,
        latencyMs: 210,
        usage: { promptTokens: 520, completionTokens: 240 },
        items,
        sceneContext: {
          plateType: 'CERAMIC_PLATE',
          ambientLighting: 'GOOD',
          itemCount: 2,
        },
        uncertaintyNotes: [
          'Two items identified on plate.',
          'Portions estimated using standard Indian culinary serving units (roti, katori).',
        ],
      };
    }

    // Full Indian Thali scenario
    if (this.currentScenario === 'thali') {
      const items: RecognizedFoodItem[] = [
        {
          id: 'cand-1',
          name: 'Dal Tadka (Home-style)',
          alternateNames: ['Yellow Dal', 'Toor Dal Tadka'],
          category: 'curry',
          cuisine: 'North Indian',
          preparationMethod: 'Boiled toor dal with garlic cumin tadka',
          rawCookedState: 'COOKED',
          components: ['toor dal', 'ghee', 'cumin', 'garlic'],
          portion: {
            quantity: 1,
            unit: 'katori',
            estimatedGrams: 200,
            minGrams: 180,
            maxGrams: 220,
            servingDescription: '1 standard thali katori (~200g)',
            confidence: 0.92,
          },
          confidenceScore: 0.95,
        },
        {
          id: 'cand-2',
          name: 'Steamed Basmati Rice',
          alternateNames: ['Plain Rice', 'White Rice'],
          category: 'grain',
          cuisine: 'North Indian',
          preparationMethod: 'Boiled long-grain basmati',
          rawCookedState: 'COOKED',
          components: ['basmati rice', 'water'],
          portion: {
            quantity: 1,
            unit: 'cup',
            estimatedGrams: 150,
            minGrams: 130,
            maxGrams: 170,
            servingDescription: '1 cup cooked rice mound (~150g)',
            confidence: 0.9,
          },
          confidenceScore: 0.96,
        },
        {
          id: 'cand-3',
          name: 'Whole Wheat Roti / Phulka',
          alternateNames: ['Phulka', 'Chapati'],
          category: 'bread',
          cuisine: 'North Indian',
          preparationMethod: 'Dry roasted on tawa',
          rawCookedState: 'COOKED',
          components: ['whole wheat flour'],
          portion: {
            quantity: 2,
            unit: 'piece',
            estimatedGrams: 70,
            minGrams: 60,
            maxGrams: 80,
            servingDescription: '2 medium phulkas (~35g each)',
            confidence: 0.94,
          },
          confidenceScore: 0.97,
        },
        {
          id: 'cand-4',
          name: 'Paneer Butter Masala',
          alternateNames: ['Paneer Makhani'],
          category: 'curry',
          cuisine: 'North Indian',
          preparationMethod: 'Cottage cheese in rich tomato cashew gravy with butter',
          rawCookedState: 'COOKED',
          components: ['paneer', 'butter', 'cream', 'cashew', 'tomato'],
          portion: {
            quantity: 1,
            unit: 'katori',
            estimatedGrams: 150,
            minGrams: 120,
            maxGrams: 180,
            servingDescription: '1 thali katori (~150g)',
            confidence: 0.86,
          },
          confidenceScore: 0.91,
          visualIndicators: { oilSheen: 'HEAVY' },
        },
        {
          id: 'cand-5',
          name: 'Plain Curd / Dahi',
          alternateNames: ['Yogurt', 'Dahi'],
          category: 'dairy',
          cuisine: 'North Indian',
          preparationMethod: 'Fermented whole milk curd',
          rawCookedState: 'FERMENTED',
          components: ['cow milk', 'live cultures'],
          portion: {
            quantity: 1,
            unit: 'katori',
            estimatedGrams: 100,
            minGrams: 90,
            maxGrams: 120,
            servingDescription: '1 small katori (~100g)',
            confidence: 0.92,
          },
          confidenceScore: 0.95,
        },
        {
          id: 'cand-6',
          name: 'Cucumber & Tomato Salad',
          alternateNames: ['Kachumber Salad', 'Green Salad'],
          category: 'salad',
          cuisine: 'North Indian',
          preparationMethod: 'Sliced fresh raw vegetables',
          rawCookedState: 'RAW',
          components: ['cucumber', 'tomato', 'lemon'],
          portion: {
            quantity: 1,
            unit: 'bowl',
            estimatedGrams: 80,
            minGrams: 60,
            maxGrams: 100,
            servingDescription: '1 side portion (~80g)',
            confidence: 0.85,
          },
          confidenceScore: 0.93,
        },
        {
          id: 'cand-7',
          name: 'Mixed Pickle',
          alternateNames: ['Achar', 'Mango Lime Pickle'],
          category: 'condiment',
          cuisine: 'North Indian',
          preparationMethod: 'Oil preserved spiced mango and lime',
          rawCookedState: 'PROCESSED',
          components: ['mango', 'lime', 'mustard oil', 'spices'],
          portion: {
            quantity: 1,
            unit: 'tbsp',
            estimatedGrams: 15,
            minGrams: 10,
            maxGrams: 20,
            servingDescription: '1 condiment spoonful (~15g)',
            confidence: 0.88,
          },
          confidenceScore: 0.89,
        },
        {
          id: 'cand-8',
          name: 'Gulab Jamun',
          alternateNames: ['Kala Jamun'],
          category: 'dessert',
          cuisine: 'North Indian',
          preparationMethod: 'Deep fried milk solids soaked in rose sugar syrup',
          rawCookedState: 'COOKED',
          components: ['khoya', 'sugar syrup', 'cardamom'],
          portion: {
            quantity: 1,
            unit: 'piece',
            estimatedGrams: 50,
            minGrams: 40,
            maxGrams: 60,
            servingDescription: '1 standard piece (~50g)',
            confidence: 0.93,
          },
          confidenceScore: 0.98,
        },
      ];

      return {
        provider: this.providerName,
        model: this.defaultModel,
        latencyMs: 380,
        usage: { promptTokens: 980, completionTokens: 620 },
        items,
        sceneContext: {
          plateType: 'STAINLESS_THALI',
          ambientLighting: 'GOOD',
          itemCount: 8,
        },
        uncertaintyNotes: [
          'Stainless steel North Indian thali detected with 8 distinct components.',
          'Gravy bases differentiated between tomato-lentil (Dal) and rich butter-cream (Paneer Makhani).',
        ],
      };
    }

    // Low confidence scenario
    if (this.currentScenario === 'low_confidence') {
      const items: RecognizedFoodItem[] = [
        {
          id: 'cand-1',
          name: 'Unidentified Yellow Curry / Dal',
          alternateNames: ['Mixed Sabzi', 'Lentil Stew'],
          category: 'curry',
          cuisine: 'Unknown Indian',
          preparationMethod: 'Indeterminate gravy base',
          rawCookedState: 'COOKED',
          components: ['yellow gravy', 'vegetables'],
          portion: {
            quantity: 1,
            unit: 'katori',
            estimatedGrams: 180,
            minGrams: 120,
            maxGrams: 250,
            servingDescription: 'Approx. 1 katori (uncertain)',
            confidence: 0.45,
          },
          confidenceScore: 0.45,
          uncertaintyReason:
            'Liquid curry is partially obscured by glare and garnish. Unable to distinguish Dal Tadka from Sambhar or Kadhi.',
        },
      ];

      return {
        provider: this.providerName,
        model: this.defaultModel,
        latencyMs: 160,
        usage: { promptTokens: 320, completionTokens: 110 },
        items,
        sceneContext: {
          plateType: 'BOWL',
          ambientLighting: 'GLARE',
          itemCount: 1,
        },
        uncertaintyNotes: [
          'High uncertainty detected: Please select the matching food from catalog or adjust portion.',
        ],
      };
    }

    // Empty scenario
    return {
      provider: this.providerName,
      model: this.defaultModel,
      latencyMs: 110,
      usage: { promptTokens: 250, completionTokens: 40 },
      items: [],
      sceneContext: {
        plateType: 'OTHER',
        ambientLighting: 'POOR',
        itemCount: 0,
      },
      uncertaintyNotes: ['No food items could be identified with acceptable confidence.'],
    };
  }
}
