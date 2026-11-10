# CAL METER — User Journeys & Interaction Flows

**Document Version:** 1.0.0  
**Status:** Approved Architecture Draft  
**Owner:** Senior React Native Engineer & Product Designer  
**Last Updated:** November 2026  

---

## 1. Journey Overview & Design Philosophy

CAL METER is engineered around a **zero-friction nutrition feedback loop**. The typical calorie tracking app demands 15-20 taps and 60 seconds per meal, resulting in rapid user churn. CAL METER reduces this to **1 tap, 1 photo, and 1 confirmation tap in under 4 seconds**.

```mermaid
flowchart LR
    A[Point & Snap] --> B[AI Analysis < 2s]
    B --> C[Instant Portion Review]
    C --> D[One-Tap Confirm]
    D --> E[Daily Ring Progress]
```

---

## 2. Journey 1: Authentication & Biometric Onboarding

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant App as Mobile App
    participant Auth as Firebase Auth
    participant API as Backend API
    participant Engine as Nutrition Engine

    User->>App: Opens app for the first time
    App->>User: Displays animated value proposition screens
    User->>App: Selects "Sign in with Apple" (or Google / Phone)
    App->>Auth: Request OAuth credential
    Auth-->>App: Returns Firebase ID Token
    App->>API: POST /auth/sync
    API-->>App: User created (isOnboarded: false)

    Note over User,App: Multi-Step Interactive Onboarding
    User->>App: Step 1: Selects Gender (Male / Female / Other)
    User->>App: Step 2: Inputs DOB, Height, Current Weight
    User->>App: Step 3: Selects Baseline Activity Level (Sedentary to Extra Active)
    User->>App: Step 4: Selects Goal (Lose Weight, Maintain, Build Muscle) & Target Weight
    User->>App: Step 5: Selects Dietary Preference (Vegetarian, Vegan, Non-Veg, Jain, etc.)

    App->>Engine: Run Mifflin-St Jeor + TDEE + Macro split formulas
    Engine-->>App: Calculated Calorie Budget (e.g. 1,950 kcal) & Macros
    App->>User: Animated Goal Reveal screen with customized timeline
    User->>App: Taps "Start My Journey"
    App->>API: PUT /profile & PUT /goals
    API-->>App: 200 OK
    App->>User: Transitions to Main Dashboard
```

### Guest Mode Contingency
Users may tap "Explore as Guest". In this state:
- An anonymous Firebase session is created silently.
- Profile and logs are stored locally with cloud backup.
- A subtle persistent banner appears on the Diary: *"Create an account to protect your data across devices."*
- Tapping the banner triggers non-destructive account linking (`linkWithCredential`), preserving all logged history.

---

## 3. Journey 2: AI Food Photo Scanning (The Core Loop)

```mermaid
flowchart TD
    Start[User taps Camera Scanner FAB] --> PermCheck{Camera Permission?}
    PermCheck -- No --> RequestPerm[Show Permission Context Modal]
    RequestPerm -- Granted --> CamView[Open Vision Camera Viewfinder]
    RequestPerm -- Denied --> FallbackManual[Direct to Manual Search / Gallery]
    PermCheck -- Yes --> CamView

    CamView --> ActionCapture[User Taps Shutter Button]
    ActionCapture --> HapticFeedback[Trigger Medium Haptic Feedback]
    HapticFeedback --> FreezePreview[Freeze Camera Frame & Compress JPEG < 250KB]
    FreezePreview --> Presign[API: Get Presigned S3 Upload URL]
    Presign --> DirectUpload[Upload Buffer Direct to S3 Bucket]
    DirectUpload --> TriggerWorker[API: Trigger Asynchronous Analysis Job]

    TriggerWorker --> ShimmerState[Display Scanning Shimmer & Pulse Animation]
    ShimmerState --> PollResult{Worker Job Completed?}
    PollResult -- No / Processing --> Wait[Wait 250ms & Poll Status]
    Wait --> PollResult
    PollResult -- Failed / Non-Food --> ErrorModal[Show 'No Food Detected' Card]
    ErrorModal --> RetryCam[Option to Retake or Search Manually]

    PollResult -- Success --> ReviewSheet[Display Review Bottom Sheet]
    ReviewSheet --> InspectItems[Shows Detected Items, Confidence, Portions]

    InspectItems --> UserEdit{User Edits Portions?}
    UserEdit -- Yes --> AdjustQty[Adjust Katori/Piece/Gram Slider]
    AdjustQty --> RealtimeRecalc[Dynamic Calorie & Macro Recalculation]
    RealtimeRecalc --> ConfirmMeal
    UserEdit -- No --> ConfirmMeal[User Taps 'Log to Lunch']

    ConfirmMeal --> CommitAPI[POST /diary/meals]
    CommitAPI --> SuccessHaptic[Light Haptic & Calorie Ring Animation]
    SuccessHaptic --> ReturnDashboard[Return to Dashboard with Fresh Totals]
```

### Interaction Details on the Review Screen:
- **Visual Confidence Pills:**
  - `High Confidence` (Green dot): Item identified with > 85% certainty.
  - `Estimated Portion` (Amber dot): Multi-unit items where volume is estimated.
- **Serving Switcher:** User can tap "1 katori" and switch directly to "150g" or "1.5 katori" with an intuitive scroll wheel.
- **Oil/Richness Modifier:** One-tap toggle: `[Dry / Light Oil] | [Standard] | [Rich / Restaurant]`.

---

## 4. Journey 3: Barcode Scanning (Packaged Foods)

```mermaid
flowchart TD
    OpenBarcode[User switches to Barcode Mode] --> FrameGuide[Display Barcode Viewfinder Reticle]
    FrameGuide --> DetectCode[On-Device MLKit scans EAN-13 / UPC-A]
    DetectCode --> BeepHaptic[Audio Chime + Strong Haptic Pulse]
    DetectCode --> QueryAPI[GET /foods/barcode/:barcode]

    QueryAPI --> CacheCheck{Found in Redis / DB / Open Food Facts?}
    CacheCheck -- Yes --> ProductSheet[Slide up Verified Product Card]
    ProductSheet --> SelectServing[User selects 1 pack / 50g / 2 servings]
    SelectServing --> TapLog[User taps 'Log Item']
    TapLog --> Saved[Item committed to selected meal slot]

    CacheCheck -- No --> NotFoundSheet[Show 'Product Not Found' Sheet]
    NotFoundSheet --> OptionA[Option 1: Scan Nutrition Label OCR]
    NotFoundSheet --> OptionB[Option 2: Enter Nutrition Manually]
```

---

## 5. Journey 4: Historical Diary & Meal Adjustments

```mermaid
flowchart LR
    Dashboard[Dashboard] --> TapMeal[Tap on Lunch Card]
    TapMeal --> MealDetails[Expand Meal Details Modal]
    MealDetails --> EditItem[Tap Specific Food Item]
    EditItem --> ChangePortion[Change 1 Roti to 2 Rotis]
    ChangePortion --> AutoSave[Auto-Save & Re-calculate Meal Macros]
    MealDetails --> SwipeDelete[Swipe Left on Item]
    SwipeDelete --> ConfirmDelete[Delete Item & Update Day Ring]
```

- **Date Switching:** Swipe left/right anywhere on the top calendar header to jump backward in time.
- **Copying Meals:** Tap the three-dot menu on "Yesterday's Breakfast" -> "Copy to Today's Breakfast" for repeat meal routines.

---

## 6. Journey 5: Paywall & Subscription Entitlement Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Free Tier)
    participant Client as React Native App
    participant RC as RevenueCat SDK
    participant API as Backend API
    participant Store as Apple / Google In-App Purchase

    User->>Client: Captures 4th food photo of the day
    Client->>API: POST /scans/presign-upload
    API-->>Client: 429 DAILY_SCAN_LIMIT_REACHED { scansUsed: 3, limit: 3 }
    Client->>Client: Intercepts 429 & surfaces Pro Paywall Modal

    Note over Client,User: High-converting, transparent paywall
    Client->>User: Displays "Unlock CAL METER Pro" (Unlimited Scans, Regional Precision)
    User->>Client: Selects Annual Plan (Free 7-Day Trial)
    Client->>RC: purchasePackage(annualPackage)
    RC->>Store: Launch native platform billing sheet
    User->>Store: Confirms FaceID / Fingerprint Purchase
    Store-->>RC: Transaction Success & Encrypted Receipt
    RC-->>Client: Entitlement "pro" active

    RC->>API: Server-to-server Webhook (INITIAL_PURCHASE)
    API->>API: Synchronize Subscription status = ACTIVE in PostgreSQL
    Client->>API: Re-dispatch scan upload request
    API-->>Client: Presigned URL issued successfully
    Client->>User: Seamlessly resumes photo scan without restarting
```
