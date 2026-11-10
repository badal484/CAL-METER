# CAL METER — Database Design & Schema Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Draft  
**Owner:** Backend Architect & Database Administrator  
**Last Updated:** November 2026

---

## 1. Relational Model & Entity-Relationship Architecture

CAL METER uses **PostgreSQL 16** managed via **Prisma ORM**. The data model is optimized for multi-tenant isolation, rapid historical lookups, sub-millisecond barcode matches, and deterministic nutritional aggregation.

```mermaid
erDiagram
    User ||--o| UserProfile : "has"
    User ||--o{ NutritionGoal : "defines"
    User ||--o{ MealEntry : "logs"
    User ||--o{ FoodScanLog : "initiates"
    User ||--o{ WeightLog : "records"
    User ||--o{ WaterLog : "tracks"
    User ||--o{ ExerciseLog : "performs"
    User ||--o{ CoachMessage : "converses"
    User ||--o{ CoachInsight : "receives"
    User ||--o| Subscription : "holds"
    User ||--o{ FoodItem : "creates (custom)"

    MealEntry ||--o{ MealFoodItem : "contains"
    FoodItem ||--o{ MealFoodItem : "referenced by"
    FoodItem ||--o{ FoodBarcode : "identifiable by"
    FoodItem ||--o{ ServingUnitConversion : "supports"
    FoodItem ||--o| FoodNutrientProfile : "detailed profile"
    FoodItem ||--o{ FoodAlias : "known as"
    FoodItem ||--o{ FoodIngredient : "recipe composed of"
    FoodCategory ||--o{ FoodItem : "categorizes"
    FoodDataSource ||--o{ FoodItem : "sources"
    FoodDataSource ||--o{ FoodImportBatch : "tracks"
    FoodImportBatch ||--o{ FoodItem : "imports"

    User {
        uuid id PK
        string firebaseUid UK
        string email UK
        string name
        enum role
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }

    UserProfile {
        uuid id PK
        uuid userId FK,UK
        enum gender
        enum biologicalSex
        date dob
        decimal heightCm
        decimal currentWeightKg
        decimal targetWeightKg
        enum activityLevel
        enum dietPreference
        enum primaryGoal
        decimal paceKgPerWeek
        string timezone
        enum preferredUnits
    }

    NutritionGoal {
        uuid id PK
        uuid userId FK
        int dailyCalories
        decimal proteinGrams
        decimal carbsGrams
        decimal fatGrams
        decimal fiberGrams
        int waterMl
        date effectiveDate
        enum status
        enum primaryGoal
        decimal targetWeightKg
        datetime createdAt
        datetime updatedAt
    }

    FoodCategory {
        uuid id PK
        string name UK
        string slug UK
        string description
    }

    FoodDataSource {
        uuid id PK
        enum source UK
        string name
        string license
        string licenseUrl
        string attribution
    }

    FoodImportBatch {
        uuid id PK
        enum source FK
        string batchNumber UK
        enum status
        int totalRecords
        int importedRecords
        int failedRecords
        int skippedRecords
        jsonb errorLog
    }

    FoodItem {
        uuid id PK
        string name
        string[] localNames
        string brand
        string barcode UK
        enum source
        string externalId
        string cuisine
        string state
        string prepMethod
        boolean isCustom
        boolean isVerified
        boolean isArchived
        decimal confidenceScore
        decimal servingSize
        string servingUnit
        decimal standardWeightGrams
        decimal calories
        decimal protein
        decimal carbs
        decimal fat
        decimal fiber
        jsonb micronutrients
        uuid categoryId FK
        uuid dataSourceId FK
        uuid importBatchId FK
        uuid createdByUserId FK
        string imageUrl
        string manufacturer
        string ingredientsText
        string[] allergens
        string[] countries
        decimal netWeightGrams
    }

    FoodBarcode {
        uuid id PK
        uuid foodItemId FK
        string barcode UK
        enum format
        string country
        datetime createdAt
    }

    FoodNutrientProfile {
        uuid id PK
        uuid foodItemId FK,UK
        decimal calories
        decimal protein
        decimal carbs
        decimal fat
        decimal saturatedFat
        decimal transFat
        decimal fiber
        decimal sugar
        decimal addedSugar
        decimal sodium
        decimal cholesterol
        decimal potassium
        decimal calcium
        decimal iron
        decimal vitaminD
        decimal vitaminB12
        jsonb micronutrients
    }

    ServingUnitConversion {
        uuid id PK
        uuid foodItemId FK
        string unitName
        string servingDescription
        decimal gramWeight
        decimal mlVolume
        string provenance
        boolean isDefault
    }

    FoodAlias {
        uuid id PK
        uuid foodItemId FK
        string alias
        string language
        boolean isPrimary
    }

    FoodIngredient {
        uuid id PK
        uuid parentFoodItemId FK
        uuid ingredientFoodItemId FK
        string ingredientName
        decimal gramWeight
        string notes
        int orderIndex
    }

    MealEntry {
        uuid id PK
        uuid userId FK
        date date
        enum mealType
        datetime loggedAt
        string notes
        decimal totalCalories
        decimal totalProtein
        decimal totalCarbs
        decimal totalFat
    }

    MealFoodItem {
        uuid id PK
        uuid mealEntryId FK
        uuid foodItemId FK
        string foodName
        decimal portionAmount
        string servingUnit
        decimal gramWeight
        decimal calories
        decimal protein
        decimal carbs
        decimal fat
        decimal confidenceScore
        enum loggedMethod
    }

    FoodScanLog {
        uuid id PK
        uuid userId FK
        string storageKey
        jsonb rawAiResponse
        jsonb detectedItems
        jsonb matchedFoodIds
        boolean userEdited
        int latencyMs
        enum status
        datetime createdAt
    }

    Subscription {
        uuid id PK
        uuid userId FK,UK
        string revenueCatAppUserId
        enum status
        string planId
        datetime expiresAt
        string cancelReason
    }

    WeightLog {
        uuid id PK
        uuid userId FK
        decimal weightKg
        datetime loggedAt
        string notes
        string source
        datetime updatedAt
    }

    WaterLog {
        uuid id PK
        uuid userId FK
        date date
        int amountMl
        datetime loggedAt
        string source
        datetime updatedAt
    }

    ExerciseLog {
        uuid id PK
        uuid userId FK
        string name
        enum category
        int durationMinutes
        datetime performedAt
        date date
        decimal distanceKm
        enum intensity
        decimal caloriesBurned
        enum calorieSource
        decimal metValue
        string notes
        datetime createdAt
        datetime updatedAt
    }

    CoachMessage {
        uuid id PK
        uuid userId FK
        enum role
        string content
        json metadata
        datetime createdAt
    }

    CoachInsight {
        uuid id PK
        uuid userId FK
        date date
        enum type
        enum category
        string title
        string message
        string actionableTip
        string periodAnalyzed
        json metricData
        datetime generatedAt
        datetime createdAt
    }
```

---

## 2. Complete Prisma Schema Definition (`schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}

// -------------------------------------------------------------
// ENUMS
// -------------------------------------------------------------

enum UserRole {
  USER
  ADMIN
  NUTRITIONIST
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum ActivityLevel {
  SEDENTARY          // Desk job, little to no exercise
  LIGHTLY_ACTIVE     // Light exercise 1-3 days/week
  MODERATELY_ACTIVE  // Moderate exercise 3-5 days/week
  VERY_ACTIVE        // Hard exercise 6-7 days/week
  EXTRA_ACTIVE       // Very hard exercise or physical job
}

enum PrimaryGoal {
  LOSE_WEIGHT
  MAINTAIN_WEIGHT
  BUILD_MUSCLE
}

enum DietPreference {
  ANY
  VEGETARIAN
  VEGAN
  EGGETARIAN
  JAIN
  KETO
  HALAL
}

enum UnitSystem {
  METRIC   // kg, cm, ml
  IMPERIAL // lbs, feet/inches, fl oz
}

enum FoodSource {
  USDA_FOOD_DATA_CENTRAL
  OPEN_FOOD_FACTS
  INDIAN_FCT_NIN
  CUSTOM_USER
  VERIFIED_COMMUNITY
}

enum MealType {
  BREAKFAST
  LUNCH
  DINNER
  SNACK
}

enum LoggedMethod {
  AI_PHOTO
  GALLERY_PHOTO
  BARCODE
  SEARCH
  MANUAL_ENTRY
  VOICE
}

enum ScanStatus {
  CREATED
  UPLOADED
  QUEUED
  PROCESSING
  NEEDS_REVIEW
  COMPLETED
  FAILED
  CANCELLED
  PENDING
}

enum SubscriptionStatus {
  FREE
  TRIAL
  ACTIVE
  PAST_DUE
  CANCELED
  EXPIRED
}

enum ImportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum ExerciseCategory {
  WALKING
  RUNNING
  CYCLING
  SWIMMING
  GYM_WORKOUT
  STRENGTH_TRAINING
  YOGA
  SPORTS
  OTHER
}

enum ExerciseIntensity {
  LIGHT
  MODERATE
  VIGOROUS
}

enum CalorieEstimateSource {
  MET_FORMULA
  MANUAL_ENTRY
  DEVICE
}

// -------------------------------------------------------------
// MODELS
// -------------------------------------------------------------

model User {
  id           String      @id @default(uuid()) @db.Uuid
  firebaseUid  String      @unique @map("firebase_uid")
  email        String?     @unique
  name         String?
  role         UserRole    @default(USER)
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")
  deletedAt    DateTime?   @map("deleted_at")

  profile      UserProfile?
  goals        NutritionGoal[]
  meals        MealEntry[]
  scans        FoodScanLog[]
  weights      WeightLog[]
  waters       WaterLog[]
  subscription Subscription?
  customFoods  FoodItem[]        @relation("UserCustomFoods")
  deletionReq  DeletionRequest?

  @@index([deletedAt])
  @@map("users")
}

model UserProfile {
  id                String          @id @default(uuid()) @db.Uuid
  userId            String          @unique @map("user_id") @db.Uuid
  gender            Gender          @default(PREFER_NOT_TO_SAY)
  biologicalSex     BiologicalSex?  @map("biological_sex")
  dob               DateTime?       @db.Date
  heightCm          Decimal         @map("height_cm") @db.Decimal(5, 2)
  currentWeightKg   Decimal         @map("current_weight_kg") @db.Decimal(5, 2)
  targetWeightKg    Decimal?        @map("target_weight_kg") @db.Decimal(5, 2)
  activityLevel     ActivityLevel   @default(MODERATELY_ACTIVE) @map("activity_level")
  dietPreference    DietPreference  @default(ANY) @map("diet_preference")
  primaryGoal       PrimaryGoal     @default(LOSE_WEIGHT) @map("primary_goal")
  paceKgPerWeek     Decimal         @default(0.50) @map("pace_kg_per_week") @db.Decimal(3, 2)
  timezone          String          @default("Asia/Kolkata")
  preferredUnits    UnitSystem      @default(METRIC) @map("preferred_units")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")

  user              User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model NutritionGoal {
  id             String       @id @default(uuid()) @db.Uuid
  userId         String       @map("user_id") @db.Uuid
  dailyCalories  Int          @map("daily_calories")
  proteinGrams   Decimal      @map("protein_grams") @db.Decimal(6, 2)
  carbsGrams     Decimal      @map("carbs_grams") @db.Decimal(6, 2)
  fatGrams       Decimal      @map("fat_grams") @db.Decimal(6, 2)
  fiberGrams     Decimal      @default(30.00) @map("fiber_grams") @db.Decimal(6, 2)
  waterMl        Int          @default(2500) @map("water_ml")
  effectiveDate  DateTime     @default(now()) @map("effective_date") @db.Date
  status         GoalStatus   @default(ACTIVE)
  primaryGoal    PrimaryGoal? @map("primary_goal")
  targetWeightKg Decimal?     @map("target_weight_kg") @db.Decimal(5, 2)
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, effectiveDate(sort: Desc)])
  @@index([userId, status])
  @@map("nutrition_goals")
}

model FoodCategory {
  id          String     @id @default(uuid()) @db.Uuid
  name        String     @unique @db.VarChar(100)
  slug        String     @unique @db.VarChar(100)
  description String?    @db.VarChar(500)
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  foods       FoodItem[]

  @@map("food_categories")
}

model FoodDataSource {
  id            String            @id @default(uuid()) @db.Uuid
  source        FoodSource        @unique
  name          String            @db.VarChar(100)
  license       String            @db.VarChar(150)
  licenseUrl    String?           @map("license_url") @db.VarChar(500)
  attribution   String?           @db.VarChar(500)
  description   String?           @db.VarChar(1000)
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  foods         FoodItem[]
  importBatches FoodImportBatch[]

  @@map("food_data_sources")
}

model FoodImportBatch {
  id              String          @id @default(uuid()) @db.Uuid
  source          FoodSource
  batchNumber     String          @unique @map("batch_number") @db.VarChar(100)
  status          ImportStatus    @default(PENDING)
  totalRecords    Int             @default(0) @map("total_records")
  importedRecords Int             @default(0) @map("imported_records")
  failedRecords   Int             @default(0) @map("failed_records")
  skippedRecords  Int             @default(0) @map("skipped_records")
  errorLog        Json            @default("[]") @map("error_log")
  metadata        Json            @default("{}")
  startedAt       DateTime        @default(now()) @map("started_at")
  completedAt     DateTime?       @map("completed_at")

  dataSource      FoodDataSource? @relation(fields: [source], references: [source], onDelete: Cascade)
  foods           FoodItem[]

  @@index([source, status])
  @@map("food_import_batches")
}

model FoodItem {
  id                  String                  @id @default(uuid()) @db.Uuid
  name                String                  @db.VarChar(255)
  localNames          String[]                @default([]) @map("local_names")
  brand               String?                 @db.VarChar(255)
  barcode             String?                 @unique @db.VarChar(64)
  source              FoodSource              @default(CUSTOM_USER)
  externalId          String?                 @map("external_id") @db.VarChar(100)
  cuisine             String?                 @db.VarChar(50)
  state               String?                 @db.VarChar(30)
  prepMethod          String?                 @map("prep_method") @db.VarChar(50)
  isCustom            Boolean                 @default(false) @map("is_custom")
  isVerified          Boolean                 @default(false) @map("is_verified")
  isArchived          Boolean                 @default(false) @map("is_archived")
  confidenceScore     Decimal?                @map("confidence_score") @db.Decimal(3, 2)
  servingSize         Decimal                 @default(100.00) @map("serving_size") @db.Decimal(8, 2)
  servingUnit         String                  @default("g") @map("serving_unit") @db.VarChar(50)
  standardWeightGrams Decimal                 @default(100.00) @map("standard_weight_grams") @db.Decimal(8, 2)
  calories            Decimal                 @db.Decimal(8, 2)
  protein             Decimal                 @db.Decimal(8, 2)
  carbs               Decimal                 @db.Decimal(8, 2)
  fat                 Decimal                 @db.Decimal(8, 2)
  fiber               Decimal                 @default(0.00) @db.Decimal(8, 2)
  micronutrients      Json                    @default("{}")
  categoryId          String?                 @map("category_id") @db.Uuid
  dataSourceId        String?                 @map("data_source_id") @db.Uuid
  importBatchId       String?                 @map("import_batch_id") @db.Uuid
  createdByUserId     String?                 @map("created_by_user_id") @db.Uuid
  imageUrl            String?                 @map("image_url") @db.VarChar(1000)
  manufacturer        String?                 @db.VarChar(255)
  ingredientsText     String?                 @map("ingredients_text") @db.Text
  allergens           String[]                @default([]) @map("allergens")
  countries           String[]                @default([]) @map("countries")
  netWeightGrams      Decimal?                @map("net_weight_grams") @db.Decimal(8, 2)
  createdAt           DateTime                @default(now()) @map("created_at")
  updatedAt           DateTime                @updatedAt @map("updated_at")

  createdByUser       User?                   @relation("UserCustomFoods", fields: [createdByUserId], references: [id], onDelete: SetNull)
  category            FoodCategory?           @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  dataSource          FoodDataSource?         @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)
  importBatch         FoodImportBatch?        @relation(fields: [importBatchId], references: [id], onDelete: SetNull)

  nutrientProfile     FoodNutrientProfile?
  servingConversions  ServingUnitConversion[]
  aliases             FoodAlias[]
  barcodes            FoodBarcode[]
  mealFoodItems       MealFoodItem[]
  recipeIngredients   FoodIngredient[]        @relation("ParentRecipe")
  usedAsIngredientIn  FoodIngredient[]        @relation("IngredientItem")

  @@index([name])
  @@index([barcode])
  @@index([source, isVerified])
  @@index([cuisine])
  @@index([categoryId])
  @@index([createdByUserId])
  @@index([externalId])
  @@index([isCustom, isArchived])
  @@map("food_items")
}

model FoodBarcode {
  id         String        @id @default(uuid()) @db.Uuid
  foodItemId String        @map("food_item_id") @db.Uuid
  barcode    String        @unique @db.VarChar(64)
  format     BarcodeFormat @default(EAN_13)
  country    String?       @db.VarChar(10)
  createdAt  DateTime      @default(now()) @map("created_at")

  foodItem   FoodItem      @relation(fields: [foodItemId], references: [id], onDelete: Cascade)

  @@index([foodItemId])
  @@index([barcode, format])
  @@map("food_barcodes")
}

model FoodNutrientProfile {
  id             String    @id @default(uuid()) @db.Uuid
  foodItemId     String    @unique @map("food_item_id") @db.Uuid
  calories       Decimal   @db.Decimal(8, 2)
  protein        Decimal   @db.Decimal(8, 2)
  carbs          Decimal   @db.Decimal(8, 2)
  fat            Decimal   @db.Decimal(8, 2)
  saturatedFat   Decimal?  @map("saturated_fat") @db.Decimal(8, 2)
  transFat       Decimal?  @map("trans_fat") @db.Decimal(8, 2)
  fiber          Decimal?  @db.Decimal(8, 2)
  sugar          Decimal?  @db.Decimal(8, 2)
  addedSugar     Decimal?  @map("added_sugar") @db.Decimal(8, 2)
  sodium         Decimal?  @db.Decimal(8, 2)
  cholesterol    Decimal?  @db.Decimal(8, 2)
  potassium      Decimal?  @db.Decimal(8, 2)
  calcium        Decimal?  @db.Decimal(8, 2)
  iron           Decimal?  @db.Decimal(8, 2)
  vitaminD       Decimal?  @map("vitamin_d") @db.Decimal(8, 2)
  vitaminB12     Decimal?  @map("vitamin_b12") @db.Decimal(8, 2)
  micronutrients Json      @default("{}")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  foodItem       FoodItem  @relation(fields: [foodItemId], references: [id], onDelete: Cascade)

  @@map("food_nutrient_profiles")
}

model ServingUnitConversion {
  id                 String   @id @default(uuid()) @db.Uuid
  foodItemId         String   @map("food_item_id") @db.Uuid
  unitName           String   @map("unit_name") @db.VarChar(50)
  servingDescription String?  @map("serving_description") @db.VarChar(100)
  gramWeight         Decimal  @map("gram_weight") @db.Decimal(8, 2)
  mlVolume           Decimal? @map("ml_volume") @db.Decimal(8, 2)
  provenance         String   @default("USER_CONFIGURED") @db.VarChar(50)
  isDefault          Boolean  @default(false) @map("is_default")
  createdAt          DateTime @default(now()) @map("created_at")

  foodItem           FoodItem @relation(fields: [foodItemId], references: [id], onDelete: Cascade)

  @@unique([foodItemId, unitName])
  @@index([foodItemId])
  @@map("serving_unit_conversions")
}

model FoodAlias {
  id         String   @id @default(uuid()) @db.Uuid
  foodItemId String   @map("food_item_id") @db.Uuid
  alias      String   @db.VarChar(255)
  language   String?  @db.VarChar(20)
  isPrimary  Boolean  @default(false) @map("is_primary")
  createdAt  DateTime @default(now()) @map("created_at")

  foodItem   FoodItem @relation(fields: [foodItemId], references: [id], onDelete: Cascade)

  @@unique([foodItemId, alias])
  @@index([alias])
  @@map("food_aliases")
}

model FoodIngredient {
  id                   String    @id @default(uuid()) @db.Uuid
  parentFoodItemId     String    @map("parent_food_item_id") @db.Uuid
  ingredientFoodItemId String?   @map("ingredient_food_item_id") @db.Uuid
  ingredientName       String    @map("ingredient_name") @db.VarChar(255)
  gramWeight           Decimal?  @map("gram_weight") @db.Decimal(8, 2)
  notes                String?   @db.VarChar(255)
  orderIndex           Int       @default(0) @map("order_index")
  createdAt            DateTime  @default(now()) @map("created_at")

  parentFoodItem       FoodItem  @relation("ParentRecipe", fields: [parentFoodItemId], references: [id], onDelete: Cascade)
  ingredientFoodItem   FoodItem? @relation("IngredientItem", fields: [ingredientFoodItemId], references: [id], onDelete: SetNull)

  @@index([parentFoodItemId])
  @@map("food_ingredients")
}

model MealEntry {
  id            String         @id @default(uuid()) @db.Uuid
  userId        String         @map("user_id") @db.Uuid
  date          DateTime       @db.Date
  mealType      MealType       @map("meal_type")
  loggedAt      DateTime       @default(now()) @map("logged_at")
  notes         String?        @db.VarChar(500)
  totalCalories Decimal        @default(0.00) @map("total_calories") @db.Decimal(8, 2)
  totalProtein  Decimal        @default(0.00) @map("total_protein") @db.Decimal(8, 2)
  totalCarbs    Decimal        @default(0.00) @map("total_carbs") @db.Decimal(8, 2)
  totalFat      Decimal        @default(0.00) @map("total_fat") @db.Decimal(8, 2)
  totalFiber    Decimal        @default(0.00) @map("total_fiber") @db.Decimal(8, 2)
  totalSugar    Decimal        @default(0.00) @map("total_sugar") @db.Decimal(8, 2)
  totalSodium   Decimal        @default(0.00) @map("total_sodium") @db.Decimal(8, 2)
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  items         MealFoodItem[]
  scans         FoodScanLog[]

  @@unique([userId, date, mealType])
  @@index([userId, date])
  @@map("meal_entries")
}

model MealFoodItem {
  id              String       @id @default(uuid()) @db.Uuid
  mealEntryId     String       @map("meal_entry_id") @db.Uuid
  foodItemId      String?      @map("food_item_id") @db.Uuid
  foodName        String       @map("food_name") @db.VarChar(255)
  portionAmount   Decimal      @default(1.00) @map("portion_amount") @db.Decimal(6, 2)
  servingUnit     String       @map("serving_unit") @db.VarChar(50)
  gramWeight      Decimal      @map("gram_weight") @db.Decimal(8, 2)
  calories        Decimal      @db.Decimal(8, 2)
  protein         Decimal      @db.Decimal(8, 2)
  carbs           Decimal      @db.Decimal(8, 2)
  fat             Decimal      @db.Decimal(8, 2)
  fiber           Decimal?     @db.Decimal(8, 2)
  sugar           Decimal?     @db.Decimal(8, 2)
  sodium          Decimal?     @db.Decimal(8, 2)
  micronutrients  Json         @default("{}")
  scanId          String?      @map("scan_id") @db.Uuid
  notes           String?      @db.VarChar(500)
  confidenceScore Decimal?     @map("confidence_score") @db.Decimal(3, 2)
  loggedMethod    LoggedMethod @default(SEARCH) @map("logged_method")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  mealEntry       MealEntry    @relation(fields: [mealEntryId], references: [id], onDelete: Cascade)
  foodItem        FoodItem?    @relation(fields: [foodItemId], references: [id], onDelete: SetNull)
  scan            FoodScanLog? @relation("ScanFoodItems", fields: [scanId], references: [id], onDelete: SetNull)

  @@index([mealEntryId])
  @@index([foodItemId])
  @@index([scanId])
  @@map("meal_food_items")
}

model FoodScanLog {
  id               String      @id @default(uuid()) @db.Uuid
  userId           String      @map("user_id") @db.Uuid
  storageKey       String?     @map("storage_key") @db.VarChar(500)
  mimeType         String?     @map("mime_type") @db.VarChar(50)
  fileSizeBytes    Int?        @map("file_size_bytes")
  imageWidth       Int?        @map("image_width")
  imageHeight      Int?        @map("image_height")
  provider         String?     @db.VarChar(50)
  model            String?     @db.VarChar(100)
  promptTokens     Int?        @map("prompt_tokens")
  completionTokens Int?        @map("completion_tokens")
  rawAiResponse    Json?       @map("raw_ai_response")
  detectedItems    Json?       @map("detected_items")
  matchedFoodIds   Json        @default("[]") @map("matched_food_ids")
  userCorrections  Json?       @map("user_corrections")
  nutritionResult  Json?       @map("nutrition_result")
  errorMessage     String?     @map("error_message") @db.Text
  failureReason    String?     @map("failure_reason") @db.VarChar(100)
  mealEntryId      String?     @map("meal_entry_id") @db.Uuid
  mealType         MealType?   @map("meal_type")
  userEdited       Boolean     @default(false) @map("user_edited")
  latencyMs        Int?        @map("latency_ms")
  status           ScanStatus  @default(PENDING)
  createdAt        DateTime    @default(now()) @map("created_at")
  uploadedAt       DateTime?   @map("uploaded_at")
  processedAt      DateTime?   @map("processed_at")
  confirmedAt      DateTime?   @map("confirmed_at")
  cancelledAt      DateTime?   @map("cancelled_at")

  user             User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  mealEntry        MealEntry?  @relation(fields: [mealEntryId], references: [id], onDelete: SetNull)
  mealItems        MealFoodItem[] @relation("ScanFoodItems")

  @@index([userId, createdAt(sort: Desc)])
  @@index([mealEntryId])
  @@map("food_scan_logs")
}

model WeightLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  weightKg  Decimal  @map("weight_kg") @db.Decimal(5, 2)
  loggedAt  DateTime @default(now()) @map("logged_at")
  notes     String?  @db.VarChar(255)
  source    String   @default("MANUAL") @db.VarChar(50)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, loggedAt(sort: Desc)])
  @@map("weight_logs")
}

model WaterLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  date      DateTime @db.Date
  amountMl  Int      @map("amount_ml")
  loggedAt  DateTime @default(now()) @map("logged_at")
  source    String   @default("MANUAL") @db.VarChar(50)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@map("water_logs")
}

model ExerciseLog {
  id              String                @id @default(uuid()) @db.Uuid
  userId          String                @map("user_id") @db.Uuid
  name            String                @db.VarChar(100)
  category        ExerciseCategory
  durationMinutes Int                   @map("duration_minutes")
  performedAt     DateTime              @default(now()) @map("performed_at")
  date            DateTime              @default(now()) @map("date") @db.Date
  distanceKm      Decimal?              @map("distance_km") @db.Decimal(6, 2)
  intensity       ExerciseIntensity     @default(MODERATE)
  caloriesBurned  Decimal?              @map("calories_burned") @db.Decimal(7, 2)
  calorieSource   CalorieEstimateSource? @map("calorie_source")
  metValue        Decimal?              @map("met_value") @db.Decimal(4, 2)
  notes           String?               @db.VarChar(500)
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @default(now()) @updatedAt @map("updated_at")

  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date(sort: Desc)])
  @@index([userId, performedAt(sort: Desc)])
  @@index([userId, category])
  @@map("exercise_logs")
}

model CoachMessage {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  role      CoachRole @default(USER)
  content   String    @db.Text
  metadata  Json?     @db.JsonB
  createdAt DateTime  @default(now()) @map("created_at")

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@map("coach_messages")
}

model CoachInsight {
  id             String          @id @default(uuid()) @db.Uuid
  userId         String          @map("user_id") @db.Uuid
  date           DateTime        @default(now()) @map("date") @db.Date
  type           InsightType
  category       InsightCategory
  title          String          @db.VarChar(150)
  message        String          @db.Text
  actionableTip  String?         @map("actionable_tip") @db.VarChar(300)
  periodAnalyzed String          @map("period_analyzed") @db.VarChar(50)
  metricData     Json?           @map("metric_data") @db.JsonB
  generatedAt    DateTime        @default(now()) @map("generated_at")
  createdAt      DateTime        @default(now()) @map("created_at")

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date(sort: Desc)])
  @@index([userId, type])
  @@map("coach_insights")
}

model Subscription {
  id                  String             @id @default(uuid()) @db.Uuid
  userId              String             @unique @map("user_id") @db.Uuid
  revenueCatAppUserId String             @unique @map("rc_app_user_id")
  status              SubscriptionStatus @default(FREE)
  planId              String?            @map("plan_id")
  expiresAt           DateTime?          @map("expires_at")
  cancelReason        String?            @map("cancel_reason")
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}

model DeletionRequest {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @unique @map("user_id") @db.Uuid
  requestedAt DateTime @default(now()) @map("requested_at")
  scheduledAt DateTime @map("scheduled_at")
  isProcessed Boolean  @default(false) @map("is_processed")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("deletion_requests")
}
```

---

## 3. Database Constraints, Indexes, & Performance Optimization

### 3.1. Compound Uniqueness & Tenant Protection

- **`MealEntry(userId, date, mealType)`:** Enforces that a user has at most one record per meal slot per day. New items are appended to `MealFoodItem` linked to this canonical slot entry.
- **`ServingUnitConversion(foodItemId, unitName)`:** Disallows duplicate unit definitions for the same food item (`@@unique([foodItemId, unitName])`).
- **`FoodAlias(foodItemId, alias)`:** Disallows duplicate alias text on the same food item (`@@unique([foodItemId, alias])`).
- **`FoodImportBatch(batchNumber)`:** Enforces global batch uniqueness for idempotent ingestion (`@unique`).
- **`FoodDataSource(source)`:** Enforces 1-to-1 mapping for registered authoritative data sources (`@unique`).

### 3.2. Native PostgreSQL CHECK Constraints

CAL METER enforces domain safety directly in PostgreSQL via additive migrations to guarantee numeric validity regardless of the client or direct query execution:

```sql
-- Enforced via migration 20261110120000_food_database_foundation
ALTER TABLE "food_items"
  ADD CONSTRAINT "chk_food_items_calories_non_neg" CHECK ("calories" >= 0),
  ADD CONSTRAINT "chk_food_items_protein_non_neg" CHECK ("protein" >= 0),
  ADD CONSTRAINT "chk_food_items_carbs_non_neg" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "chk_food_items_fat_non_neg" CHECK ("fat" >= 0),
  ADD CONSTRAINT "chk_food_items_confidence_score_range" CHECK (
    "confidence_score" IS NULL OR ("confidence_score" >= 0.00 AND "confidence_score" <= 1.00)
  );

ALTER TABLE "food_nutrient_profiles"
  ADD CONSTRAINT "chk_food_nutrient_profiles_calories_non_neg" CHECK ("calories" >= 0),
  ADD CONSTRAINT "chk_food_nutrient_profiles_protein_non_neg" CHECK ("protein" >= 0),
  ADD CONSTRAINT "chk_food_nutrient_profiles_carbs_non_neg" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "chk_food_nutrient_profiles_fat_non_neg" CHECK ("fat" >= 0);

-- Enforced via migration 20261110140000_food_diary_foundation
ALTER TABLE "meal_entries"
  ADD CONSTRAINT "chk_meal_entries_total_calories_non_neg" CHECK ("total_calories" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_protein_non_neg" CHECK ("total_protein" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_carbs_non_neg" CHECK ("total_carbs" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_fat_non_neg" CHECK ("total_fat" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_fiber_non_neg" CHECK ("total_fiber" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_sugar_non_neg" CHECK ("total_sugar" >= 0),
  ADD CONSTRAINT "chk_meal_entries_total_sodium_non_neg" CHECK ("total_sodium" >= 0);

ALTER TABLE "meal_food_items"
  ADD CONSTRAINT "chk_meal_food_items_portion_positive" CHECK ("portion_amount" > 0),
  ADD CONSTRAINT "chk_meal_food_items_gram_weight_positive" CHECK ("gram_weight" > 0),
  ADD CONSTRAINT "chk_meal_food_items_calories_non_neg" CHECK ("calories" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_protein_non_neg" CHECK ("protein" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_carbs_non_neg" CHECK ("carbs" >= 0),
  ADD CONSTRAINT "chk_meal_food_items_fat_non_neg" CHECK ("fat" >= 0);
```

### 3.3. Indexing Strategy

- **`B-Tree on (userId, date)`:** Eliminates table scans when querying the daily nutrition dashboard or historical weekly views.
- **`B-Tree on FoodItem(barcode)`:** Guarantees instantaneous $O(1)$ lookups during barcode scanning.
- **`B-Tree on FoodItem(cuisine)` & `FoodItem(categoryId)`:** Rapid category and regional cuisine filtering.
- **`B-Tree on FoodItem(createdByUserId)`:** Scoped tenant isolation queries for custom foods.
- **`B-Tree on FoodItem(isCustom, isArchived)`:** Eliminates soft-deleted and archived records from the active search index.
- **`B-Tree on FoodAlias(alias)`:** Accelerates regional synonym lookups (_phulka_, _chapati_, _roti_).
- **`GIN Index on FoodItem(name, localNames)`:** Built using PostgreSQL `pg_trgm` (trigram) extension for fuzzy substring matching across regional Indian and English dishes.

```sql
-- Trigram Index for Fuzzy Food Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_food_items_name_trgm
ON food_items USING gin (name gin_trgm_ops);
```

---

## 4. Migration & Seeding Strategy

1. **Initial Baseline Migration:** Executed via `prisma migrate dev --name init_core_schema`.
2. **Seed Pipeline (`prisma/seed.ts`):**
   - Populates essential conversion matrices (_katori_, _roti_, _cup_, _scoop_, _piece_).
   - Ingests canonical reference datasets:
     - Top 500 common Indian regional recipes (from Indian Food Composition Tables / ICMR-NIN).
     - Top 1,000 standard whole foods from USDA FoodData Central (fruits, vegetables, meats, grains).
3. **Database Maintenance:** Nightly automated vacuuming and index re-indexing scheduled during low-traffic windows (03:00 UTC).
