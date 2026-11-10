# CAL METER — Multimodal AI Food Recognition Pipeline

**Document Version:** 1.1.0  
**Status:** Approved Architecture Specification  
**Owner:** Technical Lead & AI Systems Architect  
**Last Updated:** November 2026

---

## 1. Architectural Philosophy: The Decoupled Intelligence Pattern

A critical vulnerability in naive AI diet apps is allowing Large Multimodal Models (LMMs) to hallucinate calorie and macronutrient numbers directly from pixel data. LLMs are imprecise calculators, and identical food photos can yield substantial variance in estimated calories.

CAL METER solves this with the **Decoupled Intelligence Pattern**:

1. **Multimodal Vision:** Visual models perform **identification, volumetric estimation, and cooking medium inference**. The model does _not_ calculate calories.
2. **Estimates With Uncertainty:** All visual identification and volumetric estimates are treated explicitly as **statistical estimates with inherent uncertainty**. Confidence tiers (High / Moderate / Review Needed) and transparent disclaimers are communicated to the user.
3. **Deterministic Nutritional Valuation:** The backend matching engine queries verified nutrition tables (USDA FoodData Central, Open Food Facts under ODbL terms, and Indian regional food tables subject to commercial licensing verification) and multiplies standard 100g nutrient profiles by the calculated mass.
4. **Fallback Modeling:** When an item cannot be mapped to certified tables, a bounded model estimate is used as an explicitly tagged fallback (`source: AI_ESTIMATED`) with clear uncertainty markers.

```mermaid
graph LR
    Image[Food Image] --> Vision[Multimodal Vision Provider]
    Vision --> Output[Structured Detection DTO: Items, Portions, Units, Oil Sheen]
    Output --> Matcher[Deterministic Nutrition Matcher]
    Matcher --> Catalog[(Postgres Nutrition Catalog: USDA / Reference / OFF)]
    Catalog --> Calculation[Deterministic Math: grams * nutrient_per_gram]
    Calculation --> Review[User Verification & Correction Screen]
```

---

## 2. Multimodal Provider & Model Selection Process

Rather than hardcoding an assumption of an older model (such as Gemini 1.5 Flash), CAL METER establishes a formal **Provider and Model Selection Process** to be executed prior to production implementation:

### Model Evaluation Criteria:

1. **Official Documentation Verification:** Verify current production status, deprecation timelines, pricing per million tokens, and multimodal latency through the provider's active developer documentation (Google Cloud Vertex AI / Gemini API, Anthropic Claude API, OpenAI Vision API).
2. **Structured JSON Output Support:** Native schema enforcement (e.g. `responseSchema` or tool/function calling) must be guaranteed with zero markdown wrapping.
3. **Multimodal Benchmarks on Food Images:** Evaluate against our 100-image Golden Benchmark Suite (multi-item Indian thalis, packaged goods, complex gravies).
4. **Cost & Latency Thresholds:** Target cost < $0.002 per scan; target provider inference latency < 1.5 seconds.

### Provider Abstraction (`IFoodVisionProvider`)

All AI vision interactions implement a unified interface in `apps/api/src/ai/types.ts` to ensure zero vendor lock-in:

```typescript
export interface IFoodVisionProvider {
  name: string;
  recognizeFood(request: FoodRecognitionRequest): Promise<FoodRecognitionResponse>;
}

export interface FoodRecognitionRequest {
  imageBuffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  options?: {
    maxItems?: number;
    preferredCuisine?: string;
    includeVisualIndicators?: boolean;
    timeoutMs?: number;
  };
}

export interface RecognizedFoodItem {
  id: string;
  canonicalName: string;
  regionalName?: string;
  cuisine?: string;
  cookingMethod?:
    | 'BOILED'
    | 'STEAMED'
    | 'SAUTEED'
    | 'DEEP_FRIED'
    | 'RAW'
    | 'CURRIED_RICH'
    | 'CURRIED_LIGHT'
    | 'ROASTED'
    | 'BAKED'
    | 'OTHER';
  portion: {
    quantity: number;
    unit:
      'katori' | 'piece' | 'roti' | 'cup' | 'tablespoon' | 'gram' | 'bowl' | 'plate' | 'portion';
    estimatedWeightGrams: number;
    confidence: number;
    alternatives?: Array<{
      quantity: number;
      unit: string;
      estimatedWeightGrams: number;
    }>;
  };
  confidence: number;
  visualIndicators?: {
    oilSheen?: 'DRY' | 'MODERATE' | 'HEAVY';
    apparentSizeCm?: number;
  };
}

export interface FoodRecognitionResponse {
  detectedItems: RecognizedFoodItem[];
  sceneContext: {
    plateType?: 'STAINLESS_THALI' | 'CERAMIC_PLATE' | 'BOWL' | 'TAKEAWAY_CONTAINER' | 'UNKNOWN';
    overallConfidence: number;
    ambientLighting?: 'GOOD' | 'POOR' | 'GLARE';
  };
  rawLatencyMs: number;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## 3. Provider-Agnostic System Prompt & Structured Schema

### 3.1. System Instructions

```text
You are an expert culinary AI and clinical nutrition vision specialist with deep knowledge of global cuisines, with particular expertise in Indian regional cooking (North Indian, South Indian, Bengali, Maharashtrian, Gujarati, etc.), home-cooked preparations, and restaurant dishes.

Your task is to analyze food photographs and extract an exact inventory of all edible items present.

STRICT RULES:
1. Identify all distinct food items, side dishes, breads, rice, and condiments separately.
2. For mixed dishes (like Biryani, Thali, or Salad), break down the primary components or identify the exact regional preparation.
3. Treat all visual identifications and volume estimations as statistical estimates with inherent uncertainty.
4. Estimate portions using food-specific, culturally appropriate serving units:
   - For Indian curries, dal, and yogurt: use "katori" (note food-specific density: dal ~200g, dry sabzi ~140g).
   - For flatbreads: use "piece" / "roti" (note if dry phulka or brushed with ghee/butter).
   - For rice/grains: use "cup" (~150g cooked) or "ladle".
   - For international/western items: use standard pieces, cups, or estimated grams.
5. Distinguish gravy bases:
   - Tomato-onion light gravy (e.g. homestyle chicken curry or rajma).
   - Cream/cashew/butter rich gravy (e.g. Paneer Butter Masala, Dal Makhani).
   - Coconut-based gravy (e.g. South Indian vegetable kurma).
6. Assign a realistic confidence score between 0.00 and 1.00 for each item.
7. Return ONLY valid JSON adhering strictly to the provided JSON Schema. Do NOT include markdown code blocks or explanatory text.
```

### 3.2. Response JSON Schema

The schema enforces required fields, strict string enums, and numerical bounds to prevent runtime parsing failures.

---

## 4. Indian Food Disambiguation Rules

Indian meals pose specific recognition edge cases. The vision pipeline applies heuristic rules to disambiguate:

| Visual Ambiguity                       | Resolution Heuristic                                                                      | Default Assumption                                                              |
| :------------------------------------- | :---------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Dal Tadka vs. Dal Makhani**          | Yellow pulse vs. black urad lentil with heavy cream swirl.                                | Yellow = Toor Dal Tadka. Black/Brown = Dal Makhani.                             |
| **Phulka vs. Paratha**                 | Thin, puffed, flour-dusted vs. layered, flaky, golden oil/ghee patches.                   | Thin/matte = Phulka (~35g). Layered/golden = Plain Paratha (~70g).              |
| **Steamed Rice vs. Pulao vs. Biryani** | White single grain vs. spiced/colored with cumin/peas vs. layered with marinated protein. | White = Steamed Basmati. Spiced = Vegetable Pulao. Multi-color/meat = Biryani.  |
| **Paneer vs. Tofu**                    | Texture opacity, soft curd edges vs. firm pressed block edges.                            | Indian context defaults to Dairy Paneer; option pill provided on review screen. |

---

## 5. Deterministic Matching Algorithm

Once the vision worker receives `detectedItems`, it executes the matching pipeline against the Part 5 Food Database Foundation:

```mermaid
flowchart TD
    Item[Detected Item DTO] --> QueryDB[Search PostgreSQL food_items + food_aliases]
    QueryDB --> MatchCheck{Exact or Trigram Match > 0.82?}

    MatchCheck -- Yes --> UnitCheck{Does matching serving_unit_conversion exist?}
    UnitCheck -- Yes --> CalcStandard[Compute exact grams from food-specific conversion table]
    UnitCheck -- No --> CalcDensity[Use AI estimated gram weight with uncertainty marker]
    CalcStandard --> FetchProfile[Join food_nutrient_profiles per 100g]
    CalcDensity --> FetchProfile
    FetchProfile --> FinalNutrients[Nutrients = gramWeight / 100 * baseNutrients via @calmeter/shared]
    FinalNutrients --> FlagVerified[Preserve verified source: REFERENCE_INDIAN / USDA / OFF]

    MatchCheck -- No --> FallbackAI[Query external reference or use bounded baseline]
    FallbackAI --> FlagAI[Set source = AI_ESTIMATED]

    FlagVerified --> Result[Return Matched Item to Client with Confidence Tier]
    FlagAI --> Result
```

### 5.1. Integration with Food Database Foundation

1. **Multi-Field Matching:** Searches canonical `name`, `local_names` array, and dedicated `food_aliases` (e.g. mapping detected _"phulka"_ to _"Whole Wheat Roti / Phulka"_).
2. **Multi-Tenant Scoping:** Strictly scopes custom food lookups to the authenticated user (`createdByUserId = userId`). Private custom foods from other users are completely invisible.
3. **Serving Unit Resolution:** Uses `ServingUnitConversion` with food-specific density (e.g. _katori_ for Dal Tadka = 200g, whereas _katori_ for dry Bhindi Masala = 140g).
4. **Deterministic Nutrient Calculation:** Employs `@calmeter/shared` `scaleNutrients` and `convertServingToGrams` with rounding overflow guards and NaN/Infinity rejections.
5. **Preservation of Nulls:** Unmeasured micronutrients in `food_nutrient_profiles` remain `null` rather than falsely asserting zero.

---

## 6. Scan Lifecycle & State Machine

Every food photograph flows through a strict state machine persisted in PostgreSQL `food_scan_logs`:

```mermaid
stateDiagram-v2
    [*] --> CREATED: POST /scans (Quota Check Passed)
    CREATED --> UPLOADED: POST /scans/:id/upload (Validated & Stripped)
    UPLOADED --> QUEUED: Enqueued in BullMQ
    QUEUED --> PROCESSING: Worker Picks Up Job
    PROCESSING --> NEEDS_REVIEW: AI Detection & Matching Successful
    PROCESSING --> FAILED: Provider Failure or Malformed Image
    NEEDS_REVIEW --> NEEDS_REVIEW: PATCH /scans/:id/corrections (Recalculate)
    NEEDS_REVIEW --> COMPLETED: POST /scans/:id/confirm (Idempotent Diary Log)
    NEEDS_REVIEW --> CANCELLED: POST /scans/:id/cancel
    FAILED --> [*]
    CANCELLED --> [*]
    COMPLETED --> [*]
```

### State Definitions:

- `CREATED`: Scan metadata generated; presigned upload URL or upload session initialized.
- `UPLOADED`: Image received, magic bytes verified, EXIF stripped, stored in safe tenant path `scans/{userId}/{scanId}.jpg`.
- `QUEUED`: Analysis job placed into Redis-backed BullMQ queue.
- `PROCESSING`: Multimodal vision provider analyzing pixels; matching service querying database.
- `NEEDS_REVIEW`: Food items recognized, matched to catalog, and deterministic nutrients computed. Awaiting user review/adjustment.
- `COMPLETED`: User confirmed meal; items appended to diary `meal_food_items`.
- `FAILED`: Unrecoverable error during vision analysis or database matching.
- `CANCELLED`: User discarded scan before confirming.

---

## 7. Image Ingestion Security & Validation

All uploaded images pass through server-side gatekeepers before being processed:

1. **Magic Bytes Validation:** Inspects raw file header bytes:
   - JPEG: `0xFF, 0xD8, 0xFF`
   - PNG: `0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A`
   - WebP: `RIFF....WEBP`
2. **Dimension Constraints:** Validates actual pixel dimensions from headers. Must be within **100x100** to **8192x8192** pixels. Rejects micro-payloads and decompression bombs.
3. **EXIF Metadata Stripping:** Automatically removes GPS coordinates, camera serial numbers, and device timestamps before saving to disk or object storage.
4. **File Size Bounds:** Maximum allowed image size is **10 MB** (minimum 100 bytes).

---

## 8. Error Taxonomy & Resilient Fallbacks

AI provider exceptions are mapped to normalized application errors:

| Internal Provider Error      | Cause                                             | User-Facing Behavior                                         |
| :--------------------------- | :------------------------------------------------ | :----------------------------------------------------------- |
| `ProviderTimeoutError`       | Gemini API latency exceeded timeout (default 15s) | Returns retryable failure; suggests manual food search.      |
| `ProviderRateLimitError`     | Upstream 429 quota exhaustion                     | Automatic exponential backoff retry in worker queue.         |
| `ProviderUnavailableError`   | Upstream 500/503 service outage                   | Graceful degradation; prompts user to log meal manually.     |
| `MalformedModelOutputError`  | Response failed JSON Schema validation            | Logged with raw telemetry; returns fallback empty detection. |
| `DailyScanLimitReachedError` | Free tier limit exceeded (> 3 scans/day)          | HTTP 429 `DAILY_SCAN_LIMIT_REACHED` with upgrade CTA.        |

---

## 9. Performance, Latency, and Cost Targets

_Note: Latency and throughput figures represent unverified engineering design targets until benchmarked in production._

| Metric                        | Unverified Design Target  | Engineering Strategy                                                |
| :---------------------------- | :------------------------ | :------------------------------------------------------------------ |
| **Client Upload Latency**     | Target: < 600 ms          | Compression to 1024x1024 JPEG @ 0.8 quality (~180 KB).              |
| **Vision Model Inference**    | Target: < 1,400 ms        | Efficient multimodal model selection verified against current docs. |
| **Database Match & Response** | Target: < 150 ms          | Trigram indexes and in-memory Redis catalog lookups.                |
| **Total End-to-End Latency**  | **Target: < 2.5 seconds** | Unverified target for responsive user feel.                         |
| **Cost Per Scan Target**      | **Target: < $0.002 USD**  | Model token economy optimization and prompt efficiency.             |
