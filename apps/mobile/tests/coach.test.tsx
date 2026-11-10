import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { CoachScreen } from '../src/features/coach/CoachScreen';
import type { CoachApiClient } from '../src/services/coachApi';
import { MealType, InsightCategory, InsightType } from '@calmeter/shared';

describe('CoachScreen Mobile Component & AI Nutrition Workflows (Part 11)', () => {
  let mockCoachApi: Partial<CoachApiClient>;

  const mockHistory = {
    messages: [
      {
        id: 'msg-1',
        userId: 'user-1',
        role: 'USER' as any,
        content: 'How am I doing on protein today?',
        metadata: null,
        createdAt: '2026-11-10T10:00:00.000Z',
      },
      {
        id: 'msg-2',
        userId: 'coach',
        role: 'ASSISTANT' as any,
        content:
          'You have consumed 45g of protein out of your 130g target (85g remaining). To boost intake, consider adding paneer or lentils to your lunch.',
        metadata: { model: 'mock-coach-v1' },
        createdAt: '2026-11-10T10:00:02.000Z',
      },
    ],
    totalCount: 2,
  };

  const mockInsights = {
    date: '2026-11-10',
    insights: [
      {
        type: InsightType.CALORIE_PROGRESS,
        category: InsightCategory.OBSERVATION,
        title: 'Calorie Pacing On Track',
        message: 'You have consumed 800 kcal out of your 2000 kcal target (40%).',
        actionableTip: 'Ensure your upcoming dinner includes adequate complex carbohydrates.',
        periodAnalyzed: 'TODAY',
        metricData: {
          current: 800,
          target: 2000,
          unit: 'kcal',
          percentage: 40,
        },
        generatedAt: '2026-11-10T10:05:00.000Z',
      },
      {
        type: InsightType.WEIGHT_TRAJECTORY,
        category: InsightCategory.CELEBRATION,
        title: 'Steady Weight Trend',
        message: 'Your weight is moving steadily toward your 72 kg goal (-1.5 kg over 5 days).',
        actionableTip: 'Maintain consistent hydration and sleep for healthy recovery.',
        periodAnalyzed: 'PAST_5_DAYS',
        metricData: {
          current: 78.0,
          target: 72.0,
          unit: 'kg',
          percentage: 92.3,
          delta: -1.5,
        },
        generatedAt: '2026-11-10T10:05:00.000Z',
      },
    ],
    disclaimer:
      'Personalized insights are derived deterministically from your actual logged food and tracking data.',
  };

  const mockMealRecommendations = {
    date: '2026-11-10',
    remainingCalories: 850,
    remainingProtein: 45,
    remainingCarbs: 95,
    remainingFat: 22,
    recommendations: [
      {
        id: 'rec-1',
        mealType: MealType.DINNER,
        title: 'Phulkas with Moong Dal Tadka & Salad',
        description: 'Traditional home-cooked dinner with whole wheat flatbreads and yellow dal.',
        cuisine: 'North Indian',
        totalCalories: 410,
        totalProtein: 16.5,
        totalCarbs: 72.0,
        totalFat: 3.5,
        fitsRemainingBudget: true,
        dietaryTags: ['VEGETARIAN', 'HIGH_FIBER'],
        items: [
          {
            foodName: 'Whole Wheat Roti',
            portionAmount: 2,
            servingUnit: 'piece',
            gramWeight: 70,
            calories: 208,
            protein: 6.8,
            carbs: 44.0,
            fat: 0.8,
            isVerified: true,
          },
          {
            foodName: 'Yellow Moong Dal Tadka',
            portionAmount: 1,
            servingUnit: 'katori',
            gramWeight: 200,
            calories: 190,
            protein: 10.8,
            carbs: 29.0,
            fat: 4.2,
            isVerified: true,
          },
        ],
      },
    ],
    disclaimer: 'Tailored recommendations are suggestions scaled to your remaining budget.',
  };

  beforeEach(() => {
    mockCoachApi = {
      getHistory: vi.fn().mockResolvedValue(mockHistory),
      sendMessage: vi.fn().mockResolvedValue({
        reply:
          'Great choice! Having grilled paneer with vegetables will give you 25g of protein while staying within your calorie target.',
        messageId: 'msg-new-assistant',
        suggestedPrompts: ['How much water should I drink?', 'Can I eat fruits at night?'],
        disclaimers: ['Educational guidance only.'],
      }),
      clearHistory: vi.fn().mockResolvedValue({ success: true, message: 'Cleared' }),
      getInsights: vi.fn().mockResolvedValue(mockInsights),
      getMealRecommendations: vi.fn().mockResolvedValue(mockMealRecommendations),
    };
  });

  function getAllText(root: ReactTestRenderer.ReactTestInstance): string {
    return root
      .findAllByType(Text)
      .map(node =>
        Array.isArray(node.props.children)
          ? node.props.children.join('')
          : String(node.props.children ?? ''),
      )
      .join(' ');
  }

  it('renders coach screen header, disclaimer banner, and initial messages', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const text = getAllText(renderer!.root);

    // Header & Subtitle
    expect(text).toContain('AI Nutrition Coach');
    expect(text).toContain('Context-aware guidance based on your authentic logged nutrition');

    // Educational Non-Clinical Disclaimer Banner
    expect(text).toContain(
      'Educational guidance only. Not medical diagnosis or therapeutic prescription.',
    );

    // History Messages
    expect(text).toContain('How am I doing on protein today?');
    expect(text).toContain('You have consumed 45g of protein out of your 130g target');

    // Suggested questions section
    expect(text).toContain('SUGGESTED QUESTIONS');
    expect(text).toContain('What should I eat for dinner?');
  });

  it('submits a user message via text input and displays the coach reply', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const textInput = renderer!.root.findByProps({ testID: 'coach-chat-input' });

    // Type query
    await act(async () => {
      textInput.props.onChangeText('What should I eat for a high-protein dinner?');
    });

    // Submit
    await act(async () => {
      textInput.props.onSubmitEditing();
    });

    expect(mockCoachApi.sendMessage).toHaveBeenCalledWith(
      'What should I eat for a high-protein dinner?',
    );

    const text = getAllText(renderer!.root);
    expect(text).toContain('Great choice! Having grilled paneer with vegetables');
  });

  it('taps a suggested prompt chip and sends it automatically', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const chip = renderer!.root.findByProps({ testID: 'coach-prompt-chip-0' });

    await act(async () => {
      chip.props.onPress();
    });

    expect(mockCoachApi.sendMessage).toHaveBeenCalled();
  });

  it('switches to Insights tab and renders deterministic insight cards', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const insightsTab = renderer!.root.findByProps({ testID: 'coach-tab-insights' });

    await act(async () => {
      insightsTab.props.onPress();
    });

    expect(mockCoachApi.getInsights).toHaveBeenCalled();

    const text = getAllText(renderer!.root);
    expect(text).toContain("Today's Evaluated Insights");
    expect(text).toContain('Calorie Pacing On Track');
    expect(text).toContain('800 / 2000 kcal (40%)');
    expect(text).toContain('Steady Weight Trend');
    expect(text).toContain('-1.5 kg');
    expect(text).toContain('Coach Action:');
    expect(text).toContain('Ensure your upcoming dinner includes adequate complex carbohydrates.');
  });

  it('switches to Meal Ideas tab, displays remaining budget and logs recommended meal', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const mealsTab = renderer!.root.findByProps({ testID: 'coach-tab-meals' });

    await act(async () => {
      mealsTab.props.onPress();
    });

    expect(mockCoachApi.getMealRecommendations).toHaveBeenCalled();

    const text = getAllText(renderer!.root);
    expect(text).toContain('Remaining Daily Budget');
    expect(text).toContain('850 kcal');
    expect(text).toContain('45g');
    expect(text).toContain('Phulkas with Moong Dal Tadka & Salad');
    expect(text).toContain('North Indian • DINNER');
    expect(text).toContain('Whole Wheat Roti');

    // Tap "Log This Meal"
    const logButton = renderer!.root.findByProps({ testID: 'log-meal-rec-1' });
    await act(async () => {
      logButton.props.onPress();
    });

    const updatedText = getAllText(renderer!.root);
    expect(updatedText).toContain('Logged "Phulkas with Moong Dal Tadka & Salad"');
  });

  it('handles load error and allows retry', async () => {
    mockCoachApi.getHistory = vi.fn().mockRejectedValue(new Error('Network connection timeout'));

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <CoachScreen coachApiClient={mockCoachApi as CoachApiClient} />
        </ThemeProvider>,
      );
    });

    const text = getAllText(renderer!.root);
    expect(text).toContain('Failed to Load History');
    expect(text).toContain('Network connection timeout');
  });
});
