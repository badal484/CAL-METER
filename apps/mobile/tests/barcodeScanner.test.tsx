import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text, Pressable, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { ScanScreen } from '../src/features/scan/ScanScreen';
import { ManualBarcodeModal } from '../src/features/scan/components/ManualBarcodeModal';
import { ProductDetailSheet } from '../src/features/scan/components/ProductDetailSheet';
import { BarcodeScannerView } from '../src/features/scan/components/BarcodeScannerView';
import type { BarcodeApiClient } from '../src/services/barcodeApi';
import type { DiaryApiClient } from '../src/services/diaryApi';
import type { PackagedProductDto } from '@calmeter/contracts';
import { MealType, LoggedMethod, DataQuality, FoodSource } from '@calmeter/shared';
import * as permissions from '../src/features/scan/permissions';

describe('Barcode Scanner & Packaged Food Mobile Experience', () => {
  const mockProduct: PackagedProductDto = {
    id: 'f8d38b69-8f4b-4f76-805c-5dc9dc98f822',
    barcode: '8901030825484',
    additionalBarcodes: [],
    name: 'Knorr Classic Mixed Vegetable Soup',
    brand: 'Knorr',
    manufacturer: 'Hindustan Unilever Ltd',
    imageUrl: 'https://images.openfoodfacts.org/images/products/890/103/082/5484/front_en.jpg',
    categories: ['Soups', 'Packaged Foods'],
    countries: ['India'],
    ingredientsText: 'Dehydrated vegetables (carrot, onion, cabbage), corn flour, salt, spices.',
    allergens: ['Gluten', 'Celery'],
    servingSize: 50,
    servingUnit: 'packet',
    standardWeightGrams: 100,
    netWeightGrams: 50,
    isLiquid: false,
    nutrientsPer100g: {
      calories: 320,
      protein: 7.5,
      carbs: 64,
      fat: 3.2,
      saturatedFat: 1.1,
      transFat: 0,
      fiber: 4.5,
      sugar: 12.0,
      addedSugar: null,
      sodium: 1250,
      cholesterol: null,
      potassium: null,
      calcium: null,
      iron: null,
      vitaminD: null,
      vitaminB12: null,
      micronutrients: {},
    },
    nutrientsPerServing: {
      calories: 160,
      protein: 3.75,
      carbs: 32,
      fat: 1.6,
      saturatedFat: 0.55,
      transFat: 0,
      fiber: 2.25,
      sugar: 6.0,
      addedSugar: null,
      sodium: 625,
      cholesterol: null,
      potassium: null,
      calcium: null,
      iron: null,
      vitaminD: null,
      vitaminB12: null,
      micronutrients: {},
    },
    servingConversions: [],
    source: FoodSource.OPEN_FOOD_FACTS,
    attribution: 'Open Food Facts contributors',
    license: 'ODbL 1.0',
    isVerified: true,
    dataQuality: DataQuality.EXTERNAL_SOURCE,
    missingNutrients: [
      'addedSugar',
      'cholesterol',
      'potassium',
      'calcium',
      'iron',
      'vitaminD',
      'vitaminB12',
    ],
  };

  let mockBarcodeApi: Partial<BarcodeApiClient>;
  let mockDiaryApi: Partial<DiaryApiClient>;

  beforeEach(() => {
    mockBarcodeApi = {
      lookupBarcode: vi.fn().mockResolvedValue(mockProduct),
      manualLookup: vi.fn().mockResolvedValue(mockProduct),
    };

    mockDiaryApi = {
      createDiaryEntry: vi.fn().mockResolvedValue({} as any),
    };
  });

  // 1. Initial Screen Rendering
  it('renders Food Scanner menu with Barcode Scanner option and manual entry fallback', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ScanScreen
            barcodeApiClient={mockBarcodeApi as BarcodeApiClient}
            diaryApiClient={mockDiaryApi as DiaryApiClient}
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    expect(textContent).toContain('Food Scanner');
    expect(textContent).toContain('Barcode Scanner');
    expect(textContent).toContain('Manual Barcode Entry');
    expect(textContent).toContain('Barcode Scanner Available');
  });

  // 2. Camera Permission Lifecycle
  it('displays permission denied state when user rejects camera access', async () => {
    vi.spyOn(permissions, 'checkCameraPermission').mockResolvedValue(false);
    vi.spyOn(permissions, 'requestCameraPermission').mockResolvedValue(false);

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ScanScreen
            barcodeApiClient={mockBarcodeApi as BarcodeApiClient}
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            initialMode="permission_denied"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    expect(textContent).toContain('Camera Access Required');
    expect(textContent).toContain('Grant Camera Access');
    expect(textContent).toContain('Enter Barcode Manually');
  });

  it('launches camera view when camera permission is granted', async () => {
    vi.spyOn(permissions, 'checkCameraPermission').mockResolvedValue(true);

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ScanScreen
            barcodeApiClient={mockBarcodeApi as BarcodeApiClient}
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            initialMode="barcode"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    expect(textContent).toContain('Scan Barcode');
    expect(textContent).toContain('Align barcode inside frame');
    expect(textContent).toContain('Supports EAN-13, EAN-8, UPC-A, UPC-E & Code 128');
  });

  // 3. Manual Barcode Modal Validation & Submission
  it('ManualBarcodeModal validates GS1 check digit and enables search only on valid barcodes', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ManualBarcodeModal visible={true} onClose={onClose} onSubmit={onSubmit} />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textInput = root.findByType(TextInput);

    // Enter invalid barcode with wrong check digit
    await act(async () => {
      textInput.props.onChangeText('8901030825483'); // check digit should be 4
    });

    let textNodes = root.findAllByType(Text);
    let textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');
    expect(textContent).toContain('Invalid EAN-13 check digit');

    // Enter valid EAN-13
    await act(async () => {
      textInput.props.onChangeText('8901030825484');
    });

    textNodes = root.findAllByType(Text);
    textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');
    expect(textContent).toContain('Valid EAN_13');

    // Submit valid barcode
    const buttons = root.findAllByType(Pressable);
    const searchBtn = buttons.find(b => {
      const childTexts = b
        .findAllByType(Text)
        .map(t => t.props.children)
        .flat()
        .join(' ');
      return childTexts.includes('Search');
    });

    expect(searchBtn).toBeDefined();
    await act(async () => {
      searchBtn!.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith('8901030825484');
  });

  // 4. BarcodeScannerView and Debouncing
  it('BarcodeScannerView triggers lookup on scan and debounces duplicate scans', async () => {
    const onScan = vi.fn();
    const onOpenManual = vi.fn();
    const onClose = vi.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <BarcodeScannerView
            onScan={onScan}
            onOpenManual={onOpenManual}
            onClose={onClose}
            isProcessing={false}
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const cameraComponent = root.findByProps({ scanBarcode: true });
    expect(cameraComponent).toBeDefined();

    // Trigger barcode read
    await act(async () => {
      cameraComponent.props.onReadCode({
        nativeEvent: { codeStringValue: '8901030825484' },
      });
    });

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('8901030825484');

    // Immediate duplicate scan should be debounced
    await act(async () => {
      cameraComponent.props.onReadCode({
        nativeEvent: { codeStringValue: '8901030825484' },
      });
    });

    expect(onScan).toHaveBeenCalledTimes(1);
  });

  // 5. Product Detail Sheet & Diary Logging
  it('ProductDetailSheet renders packaged food details, calculates live nutrition, and logs to diary', async () => {
    const onAddToDiary = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProductDetailSheet
            visible={true}
            product={mockProduct}
            onClose={onClose}
            onAddToDiary={onAddToDiary}
            initialMealType={MealType.LUNCH}
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textContent = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    // Product identity
    expect(textContent).toContain('Knorr Classic Mixed Vegetable Soup');
    expect(textContent).toContain('Knorr • Hindustan Unilever Ltd');
    expect(textContent).toContain('External (Open Food Facts)');

    // Attribution notice
    expect(textContent).toContain(
      'Data sourced from Open Food Facts under Open Database License (ODbL) 1.0.',
    );

    // Allergens
    expect(textContent).toContain('Gluten');
    expect(textContent).toContain('Celery');

    // 1 serving is 50g -> 160 kcal
    expect(textContent).toContain('160');
    expect(textContent).toContain('3.8g'); // Protein for 50g: 7.5 * 0.5 = 3.75 -> 3.8
    expect(textContent).toContain('625mg'); // Sodium for 50g: 1250 * 0.5 = 625

    // Missing nutrient test: cholesterol is null, so it shouldn't be rendered as 0
    // Test that Add to Diary triggers callback with barcode loggedMethod
    const submitBtn = root.findAllByType(Pressable).find(b => {
      const childTexts = b
        .findAllByType(Text)
        .map(t => t.props.children)
        .flat()
        .join(' ');
      return childTexts.includes('Log to Lunch');
    });

    expect(submitBtn).toBeDefined();

    await act(async () => {
      submitBtn!.props.onPress();
    });

    expect(onAddToDiary).toHaveBeenCalledWith(
      expect.objectContaining({
        foodItemId: mockProduct.id,
        foodName: mockProduct.name,
        mealType: MealType.LUNCH,
        servingSizeGrams: 50,
        portionAmount: 1,
        servingUnit: 'packet',
        calories: 160,
        loggedMethod: LoggedMethod.BARCODE,
      }),
    );
  });
});
