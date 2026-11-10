import {
  IFoodVisionProvider,
  FoodRecognitionRequest,
  FoodRecognitionResponse,
  RecognizedFoodItem,
  ProviderTimeoutError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  MalformedModelOutputError,
  FoodRecognitionError,
} from '../types.js';

export interface GeminiVisionProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}

export class GeminiVisionProvider implements IFoodVisionProvider {
  public readonly providerName = 'gemini';
  public readonly defaultModel: string;

  private apiKey: string | undefined;
  private timeoutMs: number;
  private baseUrl: string;

  constructor(config?: GeminiVisionProviderConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY;
    this.defaultModel = config?.model || process.env.VISION_AI_MODEL || 'gemini-2.0-flash';
    this.timeoutMs = config?.timeoutMs || 15000;
    this.baseUrl = config?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async recognizeFood(request: FoodRecognitionRequest): Promise<FoodRecognitionResponse> {
    if (!this.apiKey) {
      throw new FoodRecognitionError(
        'GEMINI_API_KEY is not configured on the server.',
        'PROVIDER_NOT_CONFIGURED',
        false,
      );
    }

    const startTime = Date.now();
    const model = this.defaultModel;
    const url = `${this.baseUrl}/${model}:generateContent?key=${this.apiKey}`;

    const systemPrompt = `You are a clinical nutrition and computer vision expert specializing in global and Indian cuisine recognition.
Analyze the photograph and identify all distinct food items, side dishes, breads, curries, and condiments present.
For multi-item plates and Indian thalis, break down each individual item (e.g. Dal Tadka, Steamed Rice, Roti, Paneer Sabzi, Curd, Salad, Pickle).
Estimate the portion size using food-specific culturally appropriate serving units (e.g. 'katori', 'piece', 'roti', 'cup', 'bowl', 'tbsp', 'g').
Return ONLY a valid JSON object adhering strictly to the following structure with no markdown code fences:
{
  "items": [
    {
      "id": "cand-1",
      "name": "string (canonical name)",
      "alternateNames": ["string"],
      "category": "string (bread | curry | grain | dairy | salad | snack | dessert | beverage | other)",
      "cuisine": "string (e.g. North Indian, South Indian, Italian, etc.)",
      "preparationMethod": "string",
      "rawCookedState": "RAW | COOKED | FERMENTED | PROCESSED",
      "components": ["string"],
      "portion": {
        "quantity": number,
        "unit": "string",
        "estimatedGrams": number,
        "minGrams": number,
        "maxGrams": number,
        "servingDescription": "string",
        "confidence": number
      },
      "confidenceScore": number (0.0 to 1.0),
      "uncertaintyReason": "string (optional)",
      "visualIndicators": {
        "oilSheen": "DRY | MODERATE | HEAVY"
      }
    }
  ],
  "sceneContext": {
    "plateType": "STAINLESS_THALI | CERAMIC_PLATE | BOWL | TAKEAWAY_CONTAINER | PACKAGING | OTHER",
    "ambientLighting": "GOOD | POOR | GLARE"
  },
  "uncertaintyNotes": ["string"]
}`;

    const base64Image = request.imageBuffer.toString('base64');

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          parts: [
            {
              text: `Please identify all food items in this photograph.${
                request.hintMealType ? ` Meal slot context: ${request.hintMealType}.` : ''
              }${request.hintCuisine ? ` Cuisine hint: ${request.hintCuisine}.` : ''}`,
            },
            {
              inlineData: {
                mimeType: request.mimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutHandle);
      const isAbort =
        (err as Error)?.name === 'AbortError' || (err as { code?: string })?.code === 'ABORT_ERR';
      if (isAbort) {
        throw new ProviderTimeoutError(
          `Gemini vision inference exceeded timeout threshold of ${this.timeoutMs}ms.`,
        );
      }
      throw new ProviderUnavailableError(
        `Failed to reach Gemini vision API endpoint: ${(err as Error)?.message || 'Network error'}`,
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 429) {
        throw new ProviderRateLimitError(
          'Gemini vision API quota or rate limit exceeded (HTTP 429).',
        );
      }
      if (response.status >= 500) {
        throw new ProviderUnavailableError(
          `Gemini vision API service error (HTTP ${response.status}).`,
        );
      }
      throw new FoodRecognitionError(
        `Gemini vision request rejected with HTTP ${response.status}.`,
        `HTTP_${response.status}`,
        false,
      );
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new MalformedModelOutputError('Gemini API returned unparseable JSON HTTP response.');
    }

    const candidateText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText || typeof candidateText !== 'string') {
      throw new MalformedModelOutputError('Gemini response missing candidate parts text.');
    }

    let parsedResult: any;
    try {
      // Strip potential markdown code blocks if present
      const cleanJson = candidateText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      parsedResult = JSON.parse(cleanJson);
    } catch {
      throw new MalformedModelOutputError(
        'Gemini candidate text could not be parsed as valid JSON.',
      );
    }

    if (!Array.isArray(parsedResult?.items)) {
      throw new MalformedModelOutputError(
        "Gemini parsed output is missing required 'items' array.",
      );
    }

    const items: RecognizedFoodItem[] = parsedResult.items.map((item: any, index: number) => ({
      id: String(item.id || `cand-${index + 1}`),
      name: String(item.name || 'Unknown Food Item'),
      alternateNames: Array.isArray(item.alternateNames) ? item.alternateNames : [],
      category: String(item.category || 'other'),
      cuisine: item.cuisine ? String(item.cuisine) : undefined,
      preparationMethod: item.preparationMethod ? String(item.preparationMethod) : undefined,
      rawCookedState: item.rawCookedState,
      components: Array.isArray(item.components) ? item.components : [],
      portion: {
        quantity: Number(item.portion?.quantity) || 1,
        unit: String(item.portion?.unit || 'serving'),
        estimatedGrams: Number(item.portion?.estimatedGrams) || 100,
        minGrams: item.portion?.minGrams ? Number(item.portion.minGrams) : undefined,
        maxGrams: item.portion?.maxGrams ? Number(item.portion.maxGrams) : undefined,
        servingDescription: item.portion?.servingDescription,
        confidence: Number(item.portion?.confidence) || 0.8,
      },
      confidenceScore: Math.max(0, Math.min(1, Number(item.confidenceScore) || 0.7)),
      uncertaintyReason: item.uncertaintyReason,
      visualIndicators: item.visualIndicators,
    }));

    return {
      provider: this.providerName,
      model,
      latencyMs,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount,
        completionTokens: payload.usageMetadata?.candidatesTokenCount,
      },
      items,
      sceneContext: parsedResult.sceneContext,
      uncertaintyNotes: Array.isArray(parsedResult.uncertaintyNotes)
        ? parsedResult.uncertaintyNotes
        : [],
    };
  }
}
