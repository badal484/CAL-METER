import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { DiaryScreen } from '../src/features/diary/DiaryScreen';
import type { DiaryApiClient } from '../src/services/diaryApi';
import type { FoodApiClient } from '../src/services/foodApi';
import type { DailyNutritionSummary } from '@calmeter/contracts';
import { MealType, LoggedMethod } from '@calmeter/shared';

describe('DiaryScreen Mobile Component & User Workflows', () => {
  const mockSummary: DailyNutritionSummary = {
    date: '2026-11-10',
    calorieGoal: 2100,
    caloriesConsumed: 550,
    caloriesRemaining: 1550,
    macros: {
      protein: { consumed: 35, target: 140, remaining: 105 },
      carbs: { consumed: 75, target: 220, remaining: 145 },
      fat: { consumed: 12, target: 65, remaining: 53 },
      fiber: { consumed: 14, target: 30, remaining: 16 },
    },
    totals: {
      calories: 550,
      protein: 35,
      carbs: 75,
      fat: 12,
      fiber: 14,
      sugar: 8,
      sodium: 450,
    },
    meals: [
      {
        id: 'meal-breakfast-1',
        userId: 'user-1',
        date: '2026-11-10',
        mealType: MealType.BREAKFAST,
        loggedAt: '2026-11-10T08:30:00.000Z',
        totalCalories: 240,
        totalProtein: 8,
        totalCarbs: 48,
        totalFat: 2,
        totalFiber: 6,
        totalSugar: 4,
        totalSodium: 200,
        items: [
          {
            id: 'item-1',
            mealEntryId: 'meal-breakfast-1',
            foodName: 'Whole Wheat Roti',
            portionAmount: 2,
            servingUnit: 'piece',
            gramWeight: 70,
            calories: 240,
            protein: 8,
            carbs: 48,
            fat: 2,
            fiber: 6,
            sugar: 1,
            sodium: 120,
            loggedMethod: LoggedMethod.SEARCH,
            createdAt: '2026-11-10T08:30:00.000Z',
          },
        ],
      },
      {
        id: 'meal-lunch-1',
        userId: 'user-1',
        date: '2026-11-10',
        mealType: MealType.LUNCH,
        loggedAt: '2026-11-10T13:00:00.000Z',
        totalCalories: 310,
        totalProtein: 27,
        totalCarbs: 27,
        totalFat: 10,
        totalFiber: 8,
        totalSugar: 4,
        totalSodium: 250,
        items: [
          {
            id: 'item-2',
            mealEntryId: 'meal-lunch-1',
            foodName: 'Yellow Dal Tadka',
            portionAmount: 1.5,
            servingUnit: 'katori',
            gramWeight: 270,
            calories: 310,
            protein: 27,
            carbs: 27,
            fat: 10,
            fiber: 8,
            sugar: 3,
            sodium: 130,
            loggedMethod: LoggedMethod.SEARCH,
            createdAt: '2026-11-10T13:00:00.000Z',
          },
        ],
      },
    ],
  };

  let mockDiaryApi: Partial<DiaryApiClient>;
  let mockFoodApi: Partial<FoodApiClient>;

  beforeEach(() => {
    mockDiaryApi = {
      getDailySummary: vi.fn().mockResolvedValue(mockSummary),
      createDiaryEntry: vi.fn().mockResolvedValue({} as any),
      updateDiaryEntry: vi.fn().mockResolvedValue({} as any),
      deleteDiaryEntry: vi.fn().mockResolvedValue({ success: true } as any),
    };

    mockFoodApi = {
      searchFoods: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    };
  });

  it('renders loading state initially then loads daily summary', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DiaryScreen
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            foodApiClient={mockFoodApi as FoodApiClient}
            initialDate="2026-11-10"
          />
        </ThemeProvider>,
      );
    });

    expect(mockDiaryApi.getDailySummary).toHaveBeenCalledWith('2026-11-10');
    const root = renderer!.root;

    // Verify Calories Consumed are rendered
    const textNodes = root.findAllByType(Text);
    const textStrings = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    expect(textStrings).toContain('CALORIES CONSUMED');
    expect(textStrings).toContain('550');
    expect(textStrings).toContain('/ 2100 kcal');
    expect(textStrings).toContain('1550 kcal left');
  });

  it('renders all 4 meal sections: Breakfast, Lunch, Dinner, and Snacks', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DiaryScreen
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            foodApiClient={mockFoodApi as FoodApiClient}
            initialDate="2026-11-10"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textStrings = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');

    expect(textStrings).toContain('Breakfast');
    expect(textStrings).toContain('Lunch');
    expect(textStrings).toContain('Dinner');
    expect(textStrings).toContain('Snacks');

    // Breakfast has items
    expect(textStrings).toContain('Whole Wheat Roti');
    expect(textStrings).toContain('2 piece (70g)');

    // Lunch has items
    expect(textStrings).toContain('Yellow Dal Tadka');
    expect(textStrings).toContain('1.5 katori (270g)');

    // Dinner and Snacks are empty
    expect(textStrings).toContain('No food logged for dinner.');
    expect(textStrings).toContain('No food logged for snacks.');
  });

  it('navigates to next day and previous day when buttons are pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DiaryScreen
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            foodApiClient={mockFoodApi as FoodApiClient}
            initialDate="2026-11-10"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const prevBtn = root.findByProps({ accessibilityLabel: 'Previous day' });
    const nextBtn = root.findByProps({ accessibilityLabel: 'Next day' });

    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();

    // Click Next day -> should request 2026-11-11
    await act(async () => {
      nextBtn.props.onPress();
    });

    expect(mockDiaryApi.getDailySummary).toHaveBeenCalledWith('2026-11-11');

    // Click Previous day twice -> should request 2026-11-10 then 2026-11-09
    await act(async () => {
      prevBtn.props.onPress();
    });
    expect(mockDiaryApi.getDailySummary).toHaveBeenCalledWith('2026-11-10');

    await act(async () => {
      prevBtn.props.onPress();
    });
    expect(mockDiaryApi.getDailySummary).toHaveBeenCalledWith('2026-11-09');
  });

  it('handles item delete action and refreshes summary', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DiaryScreen
            diaryApiClient={mockDiaryApi as DiaryApiClient}
            foodApiClient={mockFoodApi as FoodApiClient}
            initialDate="2026-11-10"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const deleteBtn = root.findByProps({ accessibilityLabel: 'Delete Whole Wheat Roti' });
    expect(deleteBtn).toBeDefined();

    await act(async () => {
      deleteBtn.props.onPress();
    });

    expect(mockDiaryApi.deleteDiaryEntry).toHaveBeenCalledWith('item-1');
    expect(mockDiaryApi.getDailySummary).toHaveBeenCalledTimes(2); // initial + after delete
  });

  it('displays ErrorState when API fails and allows retry', async () => {
    const failingDiaryApi = {
      getDailySummary: vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error loading diary.'))
        .mockResolvedValueOnce(mockSummary),
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <DiaryScreen
            diaryApiClient={failingDiaryApi as any}
            foodApiClient={mockFoodApi as FoodApiClient}
            initialDate="2026-11-10"
          />
        </ThemeProvider>,
      );
    });

    const root = renderer!.root;
    const textNodes = root.findAllByType(Text);
    const textStrings = textNodes
      .map(t => t.props.children)
      .flat()
      .join(' ');
    expect(textStrings).toContain('Network error loading diary.');

    const retryBtn = root.findByProps({ accessibilityLabel: 'Retry' });
    expect(retryBtn).toBeDefined();

    await act(async () => {
      retryBtn.props.onPress();
    });

    expect(failingDiaryApi.getDailySummary).toHaveBeenCalledTimes(2);
  });
});
