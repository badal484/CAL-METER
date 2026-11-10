# CAL METER — REST API Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Draft  
**Owner:** Backend Architect  
**Base URL:** `https://api.calmeter.app/api/v1` (Production) / `http://localhost:4000/api/v1` (Local)  
**Last Updated:** November 2026

---

## 1. Global Conventions & Protocol Standards

### 1.1. Transport & Content Negotiation

- **Protocol:** HTTPS / TLS 1.3 only (TLS 1.2 minimum acceptable).
- **Format:** `application/json` for all request bodies and responses.
- **Character Encoding:** UTF-8.
- **Date/Time Representation:** ISO 8601 strings in UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Dates (calendar days):** ISO 8601 Date strings (`YYYY-MM-DD`).

### 1.2. Authentication & Authorization

Every authenticated endpoint requires a Firebase ID Token in the HTTP Authorization header:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

The API server validates the cryptographic signature against Google's public key certificate set, extracts `uid`, looks up the internal PostgreSQL `User` record, and binds the tenant context to `req.user`.

### 1.3. Standard Response Envelopes

#### Success Envelope (`200 OK`, `201 Created`, `202 Accepted`)

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142
  }
}
```

#### Error Envelope (`4xx Client Errors`, `5xx Server Errors`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters provided.",
    "details": [
      {
        "field": "heightCm",
        "issue": "Height must be a positive number greater than 50 cm."
      }
    ]
  }
}
```

### 1.4. Standard Error Code Taxonomy

| HTTP Code | Error Code                 | Description                                          |
| :-------- | :------------------------- | :--------------------------------------------------- |
| `400`     | `VALIDATION_ERROR`         | Request payload failed Zod schema validation.        |
| `401`     | `AUTH_UNAUTHORIZED`        | Missing, malformed, or expired Bearer token.         |
| `403`     | `FORBIDDEN_RESOURCE`       | User attempted to access another tenant's record.    |
| `403`     | `SUBSCRIPTION_REQUIRED`    | Feature gated behind CAL METER Pro entitlement.      |
| `404`     | `RESOURCE_NOT_FOUND`       | Requested entity ID does not exist.                  |
| `429`     | `RATE_LIMIT_EXCEEDED`      | Request threshold breached. Try again later.         |
| `429`     | `DAILY_SCAN_LIMIT_REACHED` | Free tier daily AI scan quota reached (3 scans/day). |
| `500`     | `INTERNAL_SERVER_ERROR`    | Unexpected server failure. Tracked in Sentry.        |

---

## 2. API Endpoints by Module

```mermaid
graph TD
    API["/api/v1"]
    API --> Auth["/auth"]
    API --> Profile["/profile & /goals"]
    API --> Scans["/scans"]
    API --> Foods["/foods"]
    API --> Diary["/diary"]
    API --> Tracking["/tracking"]
    API --> Billing["/subscriptions & /webhooks"]
    API --> Account["/account"]
```

---

### Module 1: Authentication & User Sync (`/auth`)

#### `POST /auth/sync`

Synchronizes the authenticated Firebase identity with the internal PostgreSQL database. Called immediately upon mobile app login/signup.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "email": "user@example.com",
  "name": "Rohan Sharma"
}
```

- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "c1f7a0b5-783a-4db3-98fa-123456789abc",
    "firebaseUid": "vK792xN903M...",
    "email": "user@example.com",
    "name": "Rohan Sharma",
    "isOnboarded": true,
    "role": "USER",
    "createdAt": "2026-11-10T05:30:00.000Z"
  }
}
```

#### `GET /auth/me`

Retrieves current authenticated user session and subscription entitlement status.

---

### Module 2: Profile, Onboarding & Nutrition Goals (`/profile`, `/onboarding`, `/goals`)

#### `GET /profile`

Retrieves the authenticated user's biometric profile and dietary preferences. Returns `404 Not Found` if onboarding has not been completed.

- **Response (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "id": "7b0d7718-4df2-45e0-8339-4467ecbf4275",
    "userId": "c53d9e03-34e8-4221-a320-141a27e777e5",
    "name": "Badal Kumar",
    "gender": "MALE",
    "biologicalSex": "MALE",
    "dob": "1996-06-15",
    "heightCm": 178.0,
    "currentWeightKg": 80.0,
    "targetWeightKg": 74.0,
    "activityLevel": "MODERATELY_ACTIVE",
    "dietPreference": "VEGETARIAN",
    "primaryGoal": "LOSE_WEIGHT",
    "paceKgPerWeek": 0.5,
    "timezone": "Asia/Kolkata",
    "preferredUnits": "METRIC",
    "createdAt": "2026-11-10T14:00:00.000Z",
    "updatedAt": "2026-11-10T14:00:00.000Z"
  }
}
```

#### `PATCH /profile`

Updates biometric measurements, goals, or preferences. When `currentWeightKg` is updated, a corresponding entry is automatically recorded in `WeightLog`.

- **Request Body (Zod Validated):**

```json
{
  "name": "Badal Kumar",
  "currentWeightKg": 79.5,
  "activityLevel": "VERY_ACTIVE",
  "targetWeightKg": 73.0,
  "paceKgPerWeek": 0.5
}
```

#### `POST /onboarding/complete`

Atomically and idempotently completes the multi-step onboarding journey. Validates biometrics (strictly requiring age $\ge 18$), computes BMR via Mifflin-St Jeor, TDEE, calorie target, and macro distribution, then commits `UserProfile`, active `NutritionGoal`, and baseline `WeightLog` in a single ACID transaction.

- **Request Body (Zod Validated):**

```json
{
  "name": "Badal Kumar",
  "dob": "1996-06-15",
  "gender": "MALE",
  "biologicalSex": "MALE",
  "heightCm": 178,
  "currentWeightKg": 80,
  "targetWeightKg": 74,
  "primaryGoal": "LOSE_WEIGHT",
  "activityLevel": "MODERATELY_ACTIVE",
  "paceKgPerWeek": 0.5,
  "dietPreference": "VEGETARIAN",
  "timezone": "Asia/Kolkata",
  "preferredUnits": "METRIC"
}
```

- **Response (`201 Created`):**

```json
{
  "success": true,
  "data": {
    "profile": { ... },
    "goal": { ... },
    "calculations": {
      "bmr": 1773,
      "tdee": 2748,
      "dailyCalories": 2198,
      "proteinGrams": 145.0,
      "carbsGrams": 242.0,
      "fatGrams": 72.0,
      "fiberGrams": 31.0,
      "dailyDeficitOrSurplus": -550,
      "paceKgPerWeek": 0.5,
      "isBelowBmr": false,
      "warnings": [],
      "disclaimers": [
        "BMR and TDEE are mathematical estimates based on population equations, not clinical measurements."
      ]
    }
  }
}
```

#### `GET /goals/current`

Retrieves the active nutrition goal effective on the specified date (`?date=YYYY-MM-DD`, defaults to today). Resolves using `effectiveDate <= targetDate` ordered by `effectiveDate DESC, createdAt DESC`.

#### `GET /goals`

Retrieves the historical timeline of all nutrition goals for the user.

#### `POST /goals`

Creates a new active nutrition goal with an effective date. Automatically marks prior active goals on or after the effective date as `SUPERSEDED` without altering historical diary logs.

- **Request Body (Zod Validated):**

```json
{
  "dailyCalories": 2200,
  "proteinGrams": 150.0,
  "carbsGrams": 235.0,
  "fatGrams": 70.0,
  "fiberGrams": 32.0,
  "effectiveDate": "2026-12-01",
  "primaryGoal": "MAINTAIN_WEIGHT"
}
```

#### `PATCH /goals/:id`

Updates an existing specific nutrition goal. Enforces multi-tenant ownership (returns `404 Not Found` if goal belongs to another user).

#### `POST /goals/recalculate`

Previews recalculated calorie and macronutrient targets based on updated biometrics, goal, or activity level without persisting changes to the database.

- **Request Body:**

```json
{
  "primaryGoal": "BUILD_MUSCLE",
  "paceKgPerWeek": 0.25,
  "activityLevel": "VERY_ACTIVE"
}
```

---

### Module 3: Food Scans & Vision Engine (`/scans`)

#### `POST /scans`

Initializes a new food scan record and validates the daily scan quota (free users capped at 3 scans/day).

- **Headers:** `Authorization: Bearer <token>`
- **Request Body (optional):**

```json
{
  "mealType": "LUNCH",
  "notes": "Office canteen lunch"
}
```

- **Response `201 Created`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "status": "CREATED",
    "createdAt": "2026-11-10T12:00:00.000Z"
  }
}
```

- **Error `429 Too Many Requests`:**

```json
{
  "success": false,
  "error": {
    "code": "DAILY_SCAN_LIMIT_REACHED",
    "message": "Daily scan limit reached. You have used 3 of 3 scans today. Upgrade to CAL METER Pro for unlimited scans."
  }
}
```

#### `POST /scans/:id/upload-url`

Generates a secure, short-lived presigned upload URL or storage token for direct S3-compatible image upload.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "contentType": "image/jpeg",
  "fileSizeBytes": 204850
}
```

- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "uploadUrl": "https://storage.calmeter.app/scans/8f3b6c20...?token=...",
    "storageKey": "scans/user-uuid/8f3b6c20.jpg",
    "expiresInSeconds": 300
  }
}
```

#### `POST /scans/:id/upload`

Uploads the image file directly to the backend. Validates magic bytes (JPEG/PNG/WebP), strips all EXIF metadata, enforces dimension constraints (100x100 to 8192x8192), stores the image in tenant-isolated storage, and transitions the scan status to `UPLOADED`.

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: image/jpeg` (or `multipart/form-data`)
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "status": "UPLOADED",
    "imageWidth": 1024,
    "imageHeight": 1024,
    "fileSizeBytes": 184320,
    "mimeType": "image/jpeg"
  }
}
```

#### `POST /scans/upload`

Convenience combined endpoint: creates a scan record and uploads the image in a single HTTP transaction. Enforces daily quotas and performs all image sanitization steps.

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: image/jpeg`
- **Response `201 Created`:** Returns scan metadata with status `UPLOADED`.

#### `POST /scans/:id/process`

Executes the AI multimodal recognition pipeline, matches identified candidates against the verified database, and deterministically computes nutrition using `@calmeter/shared` formulas. Transitions scan status to `NEEDS_REVIEW`.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body (optional):**

```json
{
  "async": false
}
```

- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "status": "NEEDS_REVIEW",
    "items": [
      {
        "id": "item-1",
        "name": "Dal Tadka",
        "confidence": 0.94,
        "portion": {
          "amount": 1,
          "unit": "katori",
          "grams": 200,
          "confidence": 0.92
        },
        "selectedMatch": {
          "foodItemId": "7f8b9c0d-1234-4567-89ab-cdef01234567",
          "name": "Yellow Dal Tadka (Home-style)",
          "source": "REFERENCE_INDIAN"
        },
        "matchOptions": [
          {
            "foodItemId": "7f8b9c0d-1234-4567-89ab-cdef01234567",
            "name": "Yellow Dal Tadka (Home-style)",
            "score": 0.96,
            "source": "REFERENCE_INDIAN"
          }
        ],
        "nutrients": {
          "calories": 184.0,
          "protein": 9.2,
          "carbs": 24.5,
          "fat": 5.6,
          "fiber": 4.2
        }
      }
    ],
    "totalNutrients": {
      "calories": 344.0,
      "protein": 14.6,
      "carbs": 56.5,
      "fat": 6.4,
      "fiber": 8.4
    }
  }
}
```

#### `GET /scans/:id`

Retrieves the complete state, detected items, match options, and calculated nutrients of a scan.

- **Headers:** `Authorization: Bearer <token>`
- **Response `200 OK`:** Returns full `ScanDetailResponse`.

#### `PATCH /scans/:id/corrections`

Applies user adjustments to portions, replaces matched food candidates, or removes/adds items on the review sheet. Recomputes all totals deterministically using `@calmeter/shared` formulas.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**

```json
{
  "items": [
    {
      "itemId": "item-1",
      "portionAmount": 1.5,
      "portionUnit": "katori",
      "gramWeight": 300,
      "selectedFoodItemId": "7f8b9c0d-1234-4567-89ab-cdef01234567"
    }
  ]
}
```

- **Response `200 OK`:** Returns updated scan detail with recomputed nutrients.

#### `POST /scans/:id/confirm`

Commits the reviewed food scan into the user's permanent daily diary. Appends items to `meal_food_items` linked to the user's meal entry slot. Operation is idempotent: calling multiple times returns the existing diary meal entry without duplicating items.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body (optional):**

```json
{
  "mealType": "LUNCH",
  "date": "2026-11-10"
}
```

- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "status": "COMPLETED",
    "mealEntryId": "5e1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "confirmedAt": "2026-11-10T12:05:00.000Z"
  }
}
```

#### `POST /scans/:id/cancel`

Discards an unconfirmed scan and transitions the status to `CANCELLED`.

- **Headers:** `Authorization: Bearer <token>`
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "scanId": "8f3b6c20-639a-4c91-a1b4-abcdef012345",
    "status": "CANCELLED"
  }
}
```

---

### Module 4: Food Catalog & Search (`/foods`)

#### `GET /foods`

Searches verified reference foods, regional recipes, and user custom foods using fuzzy trigram matching, brand filtering, barcode lookup, cuisine filters, and alias matching.

- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `q` (string, optional): Text query matching item name, brand, or regional aliases (_e.g. "roti", "phulka", "amul butter"_).
  - `barcode` (string, optional): Exact barcode (EAN-13, EAN-8, UPC-A).
  - `category` (string, optional): Category slug or ID.
  - `cuisine` (string, optional): Regional cuisine (_e.g. "North Indian", "South Indian", "Italian"_).
  - `isVerified` (boolean, optional): Filter by official verification status.
  - `isCustom` (boolean, optional): When `true`, filters to authenticated user's own custom foods.
  - `page` (number, default: 1): 1-indexed pagination.
  - `limit` (number, default: 20, max: 100): Results per page.
  - `sortBy` (string, default: "relevance"): `"relevance" | "name" | "calories" | "createdAt"`.
  - `sortOrder` (string, default: "desc"): `"asc" | "desc"`.
- **Multi-Tenant Scoping:** Authenticated users see public/verified foods, plus their own private custom foods. They never see other users' custom foods.
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "7f8b9c0d-1234-4567-89ab-cdef01234567",
        "name": "Whole Wheat Roti / Phulka",
        "localNames": ["Phulka", "Chapati", "Roti"],
        "brand": null,
        "barcode": null,
        "source": "REFERENCE_INDIAN",
        "cuisine": "North Indian",
        "isCustom": false,
        "isVerified": true,
        "confidenceScore": 0.98,
        "standardWeightGrams": 100.0,
        "servingSize": 35.0,
        "servingUnit": "piece",
        "calories": 264.0,
        "protein": 9.2,
        "carbs": 55.4,
        "fat": 1.2,
        "fiber": 8.6,
        "servings": [
          {
            "id": "srv-1",
            "unitName": "piece",
            "servingDescription": "1 medium phulka (approx. 6 inch)",
            "gramWeight": 35.0,
            "provenance": "REFERENCE_CURATED",
            "isDefault": true
          },
          {
            "id": "srv-2",
            "unitName": "roti",
            "servingDescription": "1 medium roti",
            "gramWeight": 35.0,
            "provenance": "REFERENCE_CURATED",
            "isDefault": false
          }
        ]
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

#### `GET /foods/barcode/:barcode`

Looks up a packaged product by its barcode string (EAN-13, EAN-8, UPC-A, UPC-E, or Code 128). Automatically normalizes whitespace and punctuation, validates the GS1 Modulo-10 checksum, expands UPC-E, queries the local PostgreSQL catalog, falls back to Open Food Facts, and atomically caches results.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameters:**
  - `barcode` (string, required): Clean or unnormalized barcode value (1 to 64 chars).
- **Validation:**
  - Validates checksum using GS1 Modulo-10 rules.
  - Returns `400 Bad Request` if invalid check digit or unsupported symbology.
- **Data Quality & Attribution:**
  - Explicit `dataQuality` indicator (`VERIFIED`, `EXTERNAL_SOURCE`, `USER_ENTERED`).
  - Open Food Facts items include attribution and license (`ODbL 1.0`).
  - Strict preservation of `null` vs `0` for unmeasured micronutrients.
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "f8d38b69-8f4b-4f76-805c-5dc9dc98f822",
    "barcode": "8901030825484",
    "additionalBarcodes": [],
    "name": "Knorr Classic Mixed Vegetable Soup",
    "brand": "Knorr",
    "manufacturer": "Hindustan Unilever Ltd",
    "imageUrl": "https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg",
    "categories": ["Soups", "Packaged Foods"],
    "countries": ["India"],
    "ingredientsText": "Dehydrated vegetables, corn starch, salt, spices.",
    "allergens": ["Gluten", "Celery"],
    "servingSize": 50.0,
    "servingUnit": "packet",
    "standardWeightGrams": 100.0,
    "netWeightGrams": 50.0,
    "isLiquid": false,
    "nutrientsPer100g": {
      "calories": 320.0,
      "protein": 7.5,
      "carbs": 64.0,
      "fat": 3.2,
      "saturatedFat": 1.1,
      "transFat": 0.0,
      "fiber": 4.5,
      "sugar": 12.0,
      "addedSugar": null,
      "sodium": 1250.0,
      "micronutrients": {}
    },
    "nutrientsPerServing": {
      "calories": 160.0,
      "protein": 3.75,
      "carbs": 32.0,
      "fat": 1.6,
      "saturatedFat": 0.55,
      "transFat": 0.0,
      "fiber": 2.25,
      "sugar": 6.0,
      "addedSugar": null,
      "sodium": 625.0,
      "micronutrients": {}
    },
    "servingConversions": [],
    "source": "OPEN_FOOD_FACTS",
    "attribution": "Open Food Facts contributors",
    "license": "ODbL 1.0",
    "isVerified": true,
    "dataQuality": "EXTERNAL_SOURCE",
    "missingNutrients": ["addedSugar", "cholesterol", "vitaminD"]
  }
}
```

#### `POST /foods/barcode/lookup`

Manually looks up a barcode via JSON request body for environments where URL path encoding is restricted or complex search metadata is supplied.

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
- **Request Body:**

```json
{
  "barcode": "8901030825484"
}
```

- **Response `200 OK`:** Same schema as `GET /foods/barcode/:barcode`.

#### `GET /foods/:id`

Retrieves complete nutritional and recipe details for a specific food item, including its full micronutrient profile, serving conversions, recipe ingredients, and aliases.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID)
- **Tenant Protection:** If the requested food is custom and created by another user, returns `404 Not Found` (anti-enumeration protection).
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "id": "7f8b9c0d-1234-4567-89ab-cdef01234567",
    "name": "Dal Tadka (Home-style)",
    "localNames": ["Yellow Dal", "Toor Dal Tadka"],
    "brand": null,
    "barcode": null,
    "source": "REFERENCE_INDIAN",
    "cuisine": "North Indian",
    "state": "Pan-Indian",
    "prepMethod": "Tempered with cumin, garlic, and ghee",
    "isCustom": false,
    "isVerified": true,
    "standardWeightGrams": 100.0,
    "servingSize": 200.0,
    "servingUnit": "katori",
    "calories": 92.0,
    "protein": 4.6,
    "carbs": 12.2,
    "fat": 2.8,
    "fiber": 3.1,
    "nutrientProfile": {
      "calories": 92.0,
      "protein": 4.6,
      "carbs": 12.2,
      "fat": 2.8,
      "saturatedFat": 1.1,
      "transFat": 0.0,
      "fiber": 3.1,
      "sugar": 0.8,
      "addedSugar": 0.0,
      "sodium": 280.0,
      "cholesterol": 3.0,
      "potassium": 190.0,
      "calcium": 24.0,
      "iron": 1.3,
      "vitaminD": null,
      "vitaminB12": null,
      "micronutrients": {
        "magnesium_mg": 28.0,
        "zinc_mg": 0.9
      }
    },
    "servings": [
      {
        "id": "srv-dal-1",
        "unitName": "katori",
        "servingDescription": "1 standard bowl/katori (~200g)",
        "gramWeight": 200.0,
        "provenance": "REFERENCE_CURATED",
        "isDefault": true
      }
    ],
    "aliases": [
      { "id": "al-1", "alias": "yellow dal", "language": "en", "isPrimary": true },
      { "id": "al-2", "alias": "toor dal", "language": "hi", "isPrimary": false }
    ]
  }
}
```

#### `GET /foods/:id/servings`

Retrieves all configured serving unit conversions for a food item.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID)
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "id": "srv-1",
      "foodItemId": "7f8b9c0d-1234-4567-89ab-cdef01234567",
      "unitName": "katori",
      "servingDescription": "1 standard bowl/katori (~200g)",
      "gramWeight": 200.0,
      "mlVolume": 200.0,
      "provenance": "REFERENCE_CURATED",
      "isDefault": true
    }
  ]
}
```

#### `POST /foods`

Creates a private custom food item for the authenticated user with validated nutritional macros and custom serving units.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body (Zod Validated):**

```json
{
  "name": "Mom's Special Paneer Bhurji",
  "brand": "Homemade",
  "cuisine": "North Indian",
  "servingSize": 150.0,
  "servingUnit": "katori",
  "standardWeightGrams": 100.0,
  "calories": 185.0,
  "protein": 11.2,
  "carbs": 4.5,
  "fat": 13.8,
  "fiber": 1.5,
  "nutrientProfile": {
    "saturatedFat": 6.8,
    "sodium": 340.0,
    "calcium": 180.0
  },
  "servings": [
    {
      "unitName": "katori",
      "servingDescription": "1 medium bowl",
      "gramWeight": 150.0,
      "isDefault": true
    }
  ],
  "aliases": ["Paneer Bhurji", "Scrambled Cottage Cheese"]
}
```

- **Response `201 Created`:** Returns complete `FoodItemDetail` with `isCustom: true`, `isVerified: false`, and `createdByUserId` set to the caller.

#### `PATCH /foods/:id`

Updates fields on a user's own custom food item.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID)
- **Tenant & Ownership Security:**
  - Cannot modify verified global catalog foods (`403 Forbidden` / `404 Not Found`).
  - Cannot modify custom foods belonging to other users (`404 Not Found` anti-enumeration).
- **Request Body:** Partial `UpdateCustomFoodSchema` (e.g. update calories, protein, or brand).
- **Response `200 OK`:** Returns updated `FoodItemDetail`.

#### `DELETE /foods/:id`

Soft-deletes a user's own custom food item by marking `isArchived = true`.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID)
- **Data Integrity:** Historical diary entries (`meal_food_items`) referencing this food item are preserved intact.
- **Tenant & Ownership Security:** Returns `404 Not Found` if the item is not a custom food owned by the caller.
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": { "message": "Custom food item archived successfully." }
}
```

---

### Module 5: Food Diary & Meal Entries (`/diary`)

#### `GET /diary/:date`

Fetches the complete daily log for the specified date (`YYYY-MM-DD`), including daily nutrient totals, all four meal slots (`BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`), and individual food items with their immutable historical nutrient snapshots.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `date` (ISO date `YYYY-MM-DD`)
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-10",
    "dailyTotals": {
      "calories": 550.0,
      "protein": 35.0,
      "carbs": 75.0,
      "fat": 12.0,
      "fiber": 9.5,
      "sugar": 3.8,
      "sodium": 420.0,
      "micronutrients": {
        "calcium_mg": 140.0,
        "iron_mg": 3.2
      }
    },
    "meals": [
      {
        "id": "meal-entry-uuid-1",
        "mealType": "BREAKFAST",
        "date": "2026-11-10",
        "notes": null,
        "totalCalories": 240.0,
        "totalProtein": 8.0,
        "totalCarbs": 48.0,
        "totalFat": 2.0,
        "totalFiber": 6.0,
        "totalSugar": 1.0,
        "totalSodium": 180.0,
        "items": [
          {
            "id": "mfi-uuid-1",
            "foodItemId": "fd-roti-001",
            "foodName": "Whole Wheat Roti",
            "portionAmount": 2.0,
            "servingUnit": "piece",
            "gramWeight": 70.0,
            "calories": 240.0,
            "protein": 8.0,
            "carbs": 48.0,
            "fat": 2.0,
            "fiber": 6.0,
            "sugar": 1.0,
            "sodium": 180.0,
            "micronutrients": {},
            "scanId": null,
            "notes": null,
            "loggedMethod": "SEARCH",
            "createdAt": "2026-11-10T08:30:00.000Z",
            "updatedAt": "2026-11-10T08:30:00.000Z"
          }
        ]
      }
    ]
  }
}
```

#### `GET /diary/summary/:date`

Calculates consumed nutrients against the user's active `NutritionGoal` on the specified date, deriving consumed vs target values and remaining calories/macros.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `date` (ISO date `YYYY-MM-DD`)
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-10",
    "calorieGoal": 2100,
    "caloriesConsumed": 550.0,
    "caloriesRemaining": 1550.0,
    "macros": {
      "protein": { "consumed": 35.0, "target": 140.0, "remaining": 105.0 },
      "carbs": { "consumed": 75.0, "target": 220.0, "remaining": 145.0 },
      "fat": { "consumed": 12.0, "target": 65.0, "remaining": 53.0 },
      "fiber": { "consumed": 9.5, "target": 35.0, "remaining": 25.5 }
    }
  }
}
```

#### `POST /diary/entries`

Logs one or more food items into a meal slot for a specific date. Food items can be linked to catalog items (`foodItemId`), AI scan records (`scanId`), or logged manually with custom macros. Servings are deterministically resolved against database conversion factors, nutrients are scaled via `@calmeter/shared`, immutable historical snapshots are saved, and meal totals are atomically re-computed.

- **Headers:** `Authorization: Bearer <token>`
- **Request Body (Zod Validated):**

```json
{
  "date": "2026-11-10",
  "mealType": "LUNCH",
  "notes": "Post-workout lunch",
  "items": [
    {
      "foodItemId": "7f8b9c0d-1234-4567-89ab-cdef01234567",
      "foodName": "Yellow Dal Tadka",
      "portionAmount": 1.5,
      "servingUnit": "katori",
      "loggedMethod": "SEARCH"
    }
  ]
}
```

- **Response `201 Created`:** Returns complete `MealEntryResponseDto` including created food item snapshots and updated meal totals.

#### `GET /diary/entries/:id`

Retrieves a single logged food item by ID with multi-tenant ownership enforcement.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID of `MealFoodItem`)
- **Tenant Protection:** Returns `404 Not Found` if item does not exist or belongs to another user.
- **Response `200 OK`:** Returns `MealFoodItemDto`.

#### `PATCH /diary/entries/:id`

Updates the portion amount, serving unit, meal slot, or food item of an existing logged item. Re-converts weights, scales nutrients, and atomically recalculates the parent meal's total calories and macros.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID of `MealFoodItem`)
- **Request Body:** Partial `UpdateMealFoodItemRequestSchema` (e.g. `{ "portionAmount": 2.0, "servingUnit": "katori" }`).
- **Response `200 OK`:** Returns updated `MealFoodItemDto`.

#### `DELETE /diary/entries/:id`

Deletes a logged food item and atomically recalculates the parent meal's totals. If no items remain in the meal slot, the meal totals are safely reset to zero.

- **Headers:** `Authorization: Bearer <token>`
- **Path Parameter:** `id` (UUID of `MealFoodItem`)
- **Response `200 OK`:**

```json
{
  "success": true,
  "data": { "message": "Meal food item deleted successfully." }
}
```

---

### Module 6: Tracking (`/tracking`)

#### 1. Weight Tracking Endpoints

##### `POST /tracking/weight`

Records a new body weight measurement in `WeightLog` and automatically synchronizes `UserProfile.currentWeightKg`. Includes 10-second idempotency deduplication window against rapid retry submissions.

- **Request Body:**

```json
{
  "weightKg": 79.5,
  "notes": "Morning weigh-in before breakfast",
  "source": "MANUAL",
  "loggedAt": "2026-11-10T07:30:00.000Z"
}
```

- **Response (`201 Created`):**

```json
{
  "success": true,
  "data": {
    "id": "2c62c2f8-d4f1-4db8-9e66-7e3fba537b01",
    "userId": "c53d9e03-34e8-4221-a320-141a27e777e5",
    "weightKg": 79.5,
    "loggedAt": "2026-11-10T07:30:00.000Z",
    "notes": "Morning weigh-in before breakfast",
    "source": "MANUAL"
  }
}
```

##### `GET /tracking/weight`

Retrieves historical weight logs ordered by `loggedAt DESC`. Supports `limit`, `startDate`, and `endDate` query parameters.

##### `GET /tracking/weight/summary`

Calculates comprehensive weight progress statistics comparing starting weight, previous weight, current weight, target weight, net delta, progress percentage, and trend (`LOSING`, `GAINING`, `MAINTAINING`, `INSUFFICIENT_DATA`).

##### `PATCH /tracking/weight/:id`

Updates an existing weight reading and synchronizes active profile current weight if the updated record is the latest measurement.

##### `DELETE /tracking/weight/:id`

Deletes a weight log entry and restores `UserProfile.currentWeightKg` to the remaining latest entry.

---

#### 2. Water Tracking Endpoints

##### `POST /tracking/water`

Logs a water intake increment in milliliters.

- **Request Body:**

```json
{
  "amountMl": 500,
  "date": "2026-11-10",
  "source": "QUICK_ADD"
}
```

##### `GET /tracking/water/summary/:date`

Returns daily water summary for the specified date (`YYYY-MM-DD`), resolving the target against the active `NutritionGoal.waterMl` and calculating completion percentage with non-medical lifestyle disclaimers.

##### `GET /tracking/water/:date`

Retrieves all individual water log entries recorded for the specified date.

##### `PATCH /tracking/water/:id`

Updates an existing water log volume or date.

##### `DELETE /tracking/water/:id`

Deletes an individual water log entry.

---

#### 3. Exercise Tracking Endpoints

##### `POST /tracking/exercise`

Logs physical exercise activity. Supports optional automated MET-based calorie burn estimation based on the Compendium of Physical Activities and the user's current profile weight.

- **Request Body:**

```json
{
  "name": "Brisk Morning Jog",
  "category": "RUNNING",
  "durationMinutes": 35,
  "intensity": "MODERATE",
  "distanceKm": 4.5,
  "estimateCalories": true,
  "notes": "Outdoor park run"
}
```

- **Response (`201 Created`):**

```json
{
  "success": true,
  "data": {
    "id": "e44c6809-5c91-4dcb-9263-df6a3cc4601c",
    "userId": "c53d9e03-34e8-4221-a320-141a27e777e5",
    "name": "Brisk Morning Jog",
    "category": "RUNNING",
    "durationMinutes": 35,
    "intensity": "MODERATE",
    "distanceKm": 4.5,
    "caloriesBurned": 343,
    "calorieSource": "MET_FORMULA",
    "metValue": 9.8,
    "performedAt": "2026-11-10T07:00:00.000Z",
    "date": "2026-11-10"
  }
}
```

##### `GET /tracking/exercise`

Retrieves physical activities with optional filtering by `date`, `startDate`, `endDate`, and `limit`.

##### `PATCH /tracking/exercise/:id`

Updates activity parameters (e.g., duration, distance, intensity, manual calories).

##### `DELETE /tracking/exercise/:id`

Removes an exercise activity record.

---

#### 4. Progress Reporting Endpoint

##### `GET /tracking/progress`

Aggregates multi-metric progress reports over customizable timeframes (`days=7|30|90|365` or explicit `startDate` & `endDate`). Combines weight trend series, hydration adherence rate, and physical activity distributions by category.

Includes non-diet-credit and non-medical wellness notices confirming exercise calories are not credited to daily food budgets.

---

### Module 7: Subscriptions & Webhooks (`/subscriptions`, `/webhooks`)

- `GET /subscriptions/status`: Retrieves real-time subscription status, expiration date, and active entitlements.
- `POST /webhooks/revenuecat`: Receives signed RevenueCat server-to-server webhook events (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`). Validates authorization bearer token and synchronizes internal `Subscription` table.

---

### Module 8: Privacy & Data Sovereignty (`/account`)

- `POST /account/export`: Enqueues full GDPR data export bundle generation. User receives email with encrypted download link.
- `DELETE /account`: Enforces Apple App Store Guideline 5.1.1(v). Immediately revokes auth tokens, deletes S3 image assets, cascades deletes all user database records, and triggers RevenueCat/PostHog deletion events.

---

### Module 9: AI Nutrition Coach & Personalized Insights (`/coach`)

Endpoints powering conversational nutrition guidance, deterministic habit insights, and tailored meal suggestions based on authentic user logs.

#### 1. Conversational Nutrition Coach

##### `POST /coach/message`

Sends a query to the AI Nutrition Coach. The backend aggregates anonymized user physiological metrics (height, weight, biological sex, goals, consumed vs remaining calories/macros, logged meals, hydration status, recent activities) without exposing PII (names, emails, user IDs).

- **Headers:** `Authorization: Bearer <Firebase_ID_Token>`
- **Request Body (`SendCoachMessageDto`):**

```json
{
  "message": "What should I eat for dinner to stay on track for my 2,000 calorie target?"
}
```

- **Response (`200 OK`, `CoachMessageResponseDto`):**

```json
{
  "success": true,
  "data": {
    "reply": "You have consumed 1,200 kcal today, leaving 800 kcal remaining. A balanced option would be 2 whole wheat rotis with a katori of Moong Dal Tadka and a cucumber salad.",
    "messageId": "d8213b19-f9c3-4d76-9d33-40a2c03fb242",
    "suggestedPrompts": ["How is my protein intake today?", "Suggest a high-protein snack"],
    "disclaimers": [
      "CAL METER provides lifestyle nutrition guidance and does not provide clinical medical diagnosis or treatment."
    ]
  }
}
```

##### `GET /coach/history`

Retrieves conversation history chronologically.

- **Query Parameters:** `limit` (default: 50, max: 100)
- **Response (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "c13d9e03-34e8-4221-a320-141a27e777e5",
        "userId": "c53d9e03-34e8-4221-a320-141a27e777e5",
        "role": "USER",
        "content": "What should I eat for dinner?",
        "createdAt": "2026-11-10T18:00:00.000Z"
      },
      {
        "id": "d8213b19-f9c3-4d76-9d33-40a2c03fb242",
        "userId": "c53d9e03-34e8-4221-a320-141a27e777e5",
        "role": "ASSISTANT",
        "content": "You have consumed 1,200 kcal today...",
        "createdAt": "2026-11-10T18:00:02.000Z"
      }
    ],
    "totalCount": 2
  }
}
```

##### `DELETE /coach/history`

Clears conversation history for the authenticated user.

- **Response (`200 OK`):**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Coach conversation history cleared."
  }
}
```

#### 2. Deterministic Personalized Insights

##### `GET /coach/insights`

Evaluates deterministic nutrition metrics (calorie pacing, protein pacing, fiber intake, hydration adherence, weight trajectory with $\ge 2$ readings, exercise consistency). Explains patterns in objective natural language without fabricating numbers.

- **Query Parameters:** `forceRefresh` (boolean, optional)
- **Response (`200 OK`, `InsightsResponseDto`):**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-10",
    "insights": [
      {
        "type": "CALORIE_PROGRESS",
        "category": "OBSERVATION",
        "title": "Calorie Pacing On Track",
        "message": "You have logged 800 kcal out of your 2,000 kcal target (40%).",
        "actionableTip": "Include complex carbohydrates and lean protein in your evening meal.",
        "periodAnalyzed": "TODAY",
        "metricData": {
          "current": 800,
          "target": 2000,
          "unit": "kcal",
          "percentage": 40
        }
      },
      {
        "type": "WEIGHT_TRAJECTORY",
        "category": "CELEBRATION",
        "title": "Steady Weight Progress",
        "message": "Your weight has decreased by 1.5 kg across your last 5 tracked days toward your 72 kg goal.",
        "actionableTip": "Remember that day-to-day fluctuations of ±0.5–1.5 kg reflect fluid balance rather than fat tissue changes.",
        "periodAnalyzed": "PAST_5_DAYS",
        "metricData": {
          "current": 78.0,
          "target": 72.0,
          "unit": "kg",
          "percentage": 92.3,
          "delta": -1.5
        }
      }
    ],
    "disclaimer": "Personalized insights are derived deterministically from your actual logged food and tracking data. They are designed for educational habit guidance and do not constitute clinical diagnosis."
  }
}
```

#### 3. Tailored Meal Recommendations

##### `GET /coach/recommendations`

Returns tailored meal suggestions based on verified food database entries, respecting dietary preferences (`VEGETARIAN`, `VEGAN`, `JAIN`, `HALAL`, etc.) and scaling portions to fit remaining calories and macros.

- **Query Parameters:** `mealType` (optional: `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`), `date` (optional: `YYYY-MM-DD`)
- **Response (`200 OK`, `MealRecommendationsResponseDto`):**

```json
{
  "success": true,
  "data": {
    "date": "2026-11-10",
    "remainingCalories": 800,
    "remainingProtein": 45,
    "remainingCarbs": 95,
    "remainingFat": 22,
    "recommendations": [
      {
        "id": "rec-1",
        "mealType": "DINNER",
        "title": "Phulkas with Moong Dal Tadka & Salad",
        "description": "Traditional home-cooked dinner with whole wheat flatbreads and yellow lentil soup.",
        "cuisine": "North Indian",
        "totalCalories": 410,
        "totalProtein": 16.5,
        "totalCarbs": 72.0,
        "totalFat": 3.5,
        "fitsRemainingBudget": true,
        "dietaryTags": ["VEGETARIAN", "HIGH_FIBER", "HALAL"],
        "items": [
          {
            "foodName": "Whole Wheat Roti",
            "portionAmount": 2,
            "servingUnit": "piece",
            "gramWeight": 70,
            "calories": 208,
            "protein": 6.8,
            "carbs": 44.0,
            "fat": 0.8,
            "isVerified": true
          },
          {
            "foodName": "Yellow Moong Dal Tadka",
            "portionAmount": 1,
            "servingUnit": "katori",
            "gramWeight": 200,
            "calories": 190,
            "protein": 10.8,
            "carbs": 29.0,
            "fat": 4.2,
            "isVerified": true
          }
        ]
      }
    ],
    "disclaimer": "Tailored recommendations are suggestions scaled to your remaining budget."
  }
}
```
