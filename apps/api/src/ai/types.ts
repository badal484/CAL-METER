export interface FoodRecognitionRequest {
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  scanId: string;
  userId: string;
  hintCuisine?: string;
  hintMealType?: string;
}

export interface RecognizedFoodPortion {
  quantity: number;
  unit: string;
  estimatedGrams: number;
  minGrams?: number;
  maxGrams?: number;
  servingDescription?: string;
  confidence: number;
}

export interface RecognizedFoodItem {
  id: string; // Candidate ID (e.g. "cand-1")
  name: string; // Recognized canonical/display name
  alternateNames: string[]; // Aliases or transliterations
  category: string; // Food category slug or description
  cuisine?: string; // Regional cuisine (e.g. "North Indian", "South Indian")
  preparationMethod?: string; // e.g. "Tempered with ghee and cumin"
  rawCookedState?: 'RAW' | 'COOKED' | 'FERMENTED' | 'PROCESSED';
  components: string[]; // Visual components / ingredients
  isCompoundDish?: boolean; // True for thalis, platters, biryanis
  portion: RecognizedFoodPortion;
  confidenceScore: number; // 0.0 to 1.0 visual identification confidence
  uncertaintyReason?: string; // Reason if confidence is low
  visualIndicators?: {
    oilSheen?: 'DRY' | 'MODERATE' | 'HEAVY';
    apparentSizeCm?: number;
  };
}

export interface FoodRecognitionResponse {
  provider: string; // e.g. "gemini" | "mock"
  model: string; // e.g. "gemini-2.0-flash" | "mock-vision-v1"
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  rawOutput?: unknown;
  items: RecognizedFoodItem[];
  sceneContext?: {
    plateType?:
      'STAINLESS_THALI' | 'CERAMIC_PLATE' | 'BOWL' | 'TAKEAWAY_CONTAINER' | 'PACKAGING' | 'OTHER';
    ambientLighting?: 'GOOD' | 'POOR' | 'GLARE';
    itemCount: number;
  };
  uncertaintyNotes: string[];
}

export interface IFoodVisionProvider {
  readonly providerName: string;
  readonly defaultModel: string;
  recognizeFood(request: FoodRecognitionRequest): Promise<FoodRecognitionResponse>;
}

// -------------------------------------------------------------
// Provider Error Taxonomy
// -------------------------------------------------------------

export class FoodRecognitionError extends Error {
  public readonly code: string;
  public readonly isRetryable: boolean;

  constructor(message: string, code = 'RECOGNITION_ERROR', isRetryable = false) {
    super(message);
    this.name = 'FoodRecognitionError';
    this.code = code;
    this.isRetryable = isRetryable;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderTimeoutError extends FoodRecognitionError {
  constructor(message = 'AI vision provider request timed out.') {
    super(message, 'PROVIDER_TIMEOUT', true);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRateLimitError extends FoodRecognitionError {
  constructor(message = 'AI vision provider rate limit exceeded.') {
    super(message, 'PROVIDER_RATE_LIMIT', true);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderUnavailableError extends FoodRecognitionError {
  constructor(message = 'AI vision provider is currently unavailable or returning 5xx errors.') {
    super(message, 'PROVIDER_UNAVAILABLE', true);
    this.name = 'ProviderUnavailableError';
  }
}

export class MalformedModelOutputError extends FoodRecognitionError {
  constructor(message = 'AI vision model returned malformed or unparseable output.') {
    super(message, 'MALFORMED_MODEL_OUTPUT', false);
    this.name = 'MalformedModelOutputError';
  }
}
