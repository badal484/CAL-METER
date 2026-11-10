import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { ProgressScreen } from '../src/features/progress/ProgressScreen';
import type { TrackingApiClient } from '../src/services/trackingApi';
import { ExerciseCategory, ExerciseIntensity, CalorieEstimateSource } from '@calmeter/shared';

describe('ProgressScreen Mobile Component & Tracking Workflows (Part 10)', () => {
  let mockTrackingApi: Partial<TrackingApiClient>;

  const mockProgressReport = {
    startDate: '2026-10-11',
    endDate: '2026-11-10',
    weight: {
      currentWeightKg: 78.5,
      startWeightKg: 82.0,
      previousWeightKg: 79.2,
      targetWeightKg: 72.0,
      netChangeKg: -3.5,
      progressPercentage: 35.0,
      minWeightKg: 78.0,
      maxWeightKg: 82.5,
      trend: 'LOSING' as const,
      history: [
        {
          id: 'w-1',
          userId: 'user-1',
          weightKg: 78.5,
          loggedAt: '2026-11-10T08:00:00.000Z',
          notes: 'Morning weigh-in',
          source: 'MANUAL',
        },
        {
          id: 'w-2',
          userId: 'user-1',
          weightKg: 79.2,
          loggedAt: '2026-11-03T08:00:00.000Z',
          notes: null,
          source: 'MANUAL',
        },
        {
          id: 'w-3',
          userId: 'user-1',
          weightKg: 82.0,
          loggedAt: '2026-10-15T08:00:00.000Z',
          notes: 'Starting weight',
          source: 'MANUAL',
        },
      ],
    },
    water: {
      averageDailyMl: 2200,
      daysTracked: 28,
      targetMl: 2500,
      adherenceRate: 85.7,
    },
    exercise: {
      totalSessions: 14,
      totalDurationMinutes: 480,
      totalCaloriesBurned: 3250,
      sessionsByCategory: {
        WALKING: 6,
        RUNNING: 4,
        STRENGTH_TRAINING: 4,
      },
    },
    disclaimers: [
      'Weight variations of ±0.5–1.5 kg over 24–48 hours are normal.',
      'Exercise calories are statistical approximations and are NOT added to your food calorie budget.',
      'Daily water targets are general wellness baselines.',
    ],
  };

  const mockDailyWater = {
    date: '2026-11-10',
    totalMl: 1750,
    targetMl: 2500,
    percentage: 70.0,
    entries: [
      {
        id: 'water-1',
        userId: 'user-1',
        date: '2026-11-10',
        amountMl: 500,
        loggedAt: '2026-11-10T08:30:00.000Z',
        source: 'MANUAL',
      },
      {
        id: 'water-2',
        userId: 'user-1',
        date: '2026-11-10',
        amountMl: 750,
        loggedAt: '2026-11-10T12:00:00.000Z',
        source: 'QUICK_ADD',
      },
      {
        id: 'water-3',
        userId: 'user-1',
        date: '2026-11-10',
        amountMl: 500,
        loggedAt: '2026-11-10T15:00:00.000Z',
        source: 'QUICK_ADD',
      },
    ],
    disclaimer: 'Daily water targets are general lifestyle references.',
  };

  const mockExercises = [
    {
      id: 'ex-1',
      userId: 'user-1',
      name: 'Morning Jog',
      category: ExerciseCategory.RUNNING,
      durationMinutes: 30,
      performedAt: '2026-11-10T07:00:00.000Z',
      date: '2026-11-10',
      distanceKm: 4.2,
      intensity: ExerciseIntensity.MODERATE,
      caloriesBurned: 310,
      calorieSource: CalorieEstimateSource.MET_FORMULA,
      metValue: 9.8,
      notes: 'Felt great',
      createdAt: '2026-11-10T07:35:00.000Z',
      updatedAt: '2026-11-10T07:35:00.000Z',
    },
    {
      id: 'ex-2',
      userId: 'user-1',
      name: 'Evening Walk',
      category: ExerciseCategory.WALKING,
      durationMinutes: 45,
      performedAt: '2026-11-09T18:00:00.000Z',
      date: '2026-11-09',
      distanceKm: 3.5,
      intensity: ExerciseIntensity.LIGHT,
      caloriesBurned: 155,
      calorieSource: CalorieEstimateSource.MET_FORMULA,
      metValue: 3.3,
      notes: null,
      createdAt: '2026-11-09T19:00:00.000Z',
      updatedAt: '2026-11-09T19:00:00.000Z',
    },
  ];

  beforeEach(() => {
    mockTrackingApi = {
      getProgressReport: vi.fn().mockResolvedValue(mockProgressReport),
      getWaterSummaryForDate: vi.fn().mockResolvedValue(mockDailyWater),
      getExercises: vi.fn().mockResolvedValue(mockExercises),
      logWeight: vi.fn().mockResolvedValue({
        id: 'w-new',
        userId: 'user-1',
        weightKg: 78.0,
        loggedAt: '2026-11-10T12:00:00.000Z',
        source: 'MANUAL',
      }),
      deleteWeightLog: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      logWater: vi.fn().mockResolvedValue({
        id: 'water-new',
        userId: 'user-1',
        date: '2026-11-10',
        amountMl: 250,
        loggedAt: '2026-11-10T12:00:00.000Z',
        source: 'QUICK_ADD',
      }),
      deleteWaterLog: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      logExercise: vi.fn().mockResolvedValue({
        id: 'ex-new',
        userId: 'user-1',
        name: 'Gym Workout',
        category: ExerciseCategory.GYM_WORKOUT,
        durationMinutes: 40,
        performedAt: '2026-11-10T12:00:00.000Z',
        date: '2026-11-10',
        intensity: ExerciseIntensity.MODERATE,
        caloriesBurned: 240,
        calorieSource: CalorieEstimateSource.MET_FORMULA,
        createdAt: '2026-11-10T12:00:00.000Z',
        updatedAt: '2026-11-10T12:00:00.000Z',
      }),
      deleteExerciseLog: vi.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
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

  it('renders progress dashboard with weight, water, exercise and disclaimers', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen trackingApiClient={mockTrackingApi as TrackingApiClient} />
        </ThemeProvider>,
      );
    });

    const text = getAllText(renderer!.root);

    // Header & Titles
    expect(text).toContain('Progress & Activity');
    expect(text).toContain('Body Weight');
    expect(text).toContain('Hydration (Today)');
    expect(text).toContain('Physical Activity');

    // Weight stats
    expect(text).toContain('78.5 kg');
    expect(text).toContain('72 kg');
    expect(text).toContain('-3.5 kg');

    // Water stats
    expect(text).toContain('1750 ml');
    expect(text).toContain('2500 ml');
    expect(text).toContain('70%');

    // Exercise stats
    expect(text).toContain('14');
    expect(text).toContain('480m');
    expect(text).toContain('3250');
    expect(text).toContain('*Not added to diet budget');

    // Disclaimers
    expect(text).toContain('Tracking Science & Non-Medical Notice');
    expect(text).toContain('±0.5–1.5 kg');
    expect(text).toContain('Compendium MET equations');
  });

  it('switches timeframe range tabs (7D, 30D, 90D, 1Y) and re-fetches report', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen
            trackingApiClient={mockTrackingApi as TrackingApiClient}
            initialRange="30D"
          />
        </ThemeProvider>,
      );
    });

    // Default call was with 30 days
    expect(mockTrackingApi.getProgressReport).toHaveBeenCalledWith({ days: 30 });

    // Switch to 7D
    const tab7D = renderer!.root.find(node => node.props.accessibilityLabel === 'Range 7D');
    await act(async () => {
      tab7D.props.onPress();
    });

    expect(mockTrackingApi.getProgressReport).toHaveBeenCalledWith({ days: 7 });

    // Switch to 1Y
    const tab1Y = renderer!.root.find(node => node.props.accessibilityLabel === 'Range 1Y');
    await act(async () => {
      tab1Y.props.onPress();
    });

    expect(mockTrackingApi.getProgressReport).toHaveBeenCalledWith({ days: 365 });
  });

  it('toggles weight units between kg and lbs correctly', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen trackingApiClient={mockTrackingApi as TrackingApiClient} />
        </ThemeProvider>,
      );
    });

    let text = getAllText(renderer!.root);
    expect(text).toContain('78.5 kg');

    // Find weight unit toggle button
    const unitToggle = renderer!.root.find(
      node => node.props.accessibilityLabel === 'Switch weight unit to lbs',
    );

    await act(async () => {
      unitToggle.props.onPress();
    });

    text = getAllText(renderer!.root);
    // 78.5 * 2.20462 = 173.06 lbs
    expect(text).toContain('173.06 lbs');
  });

  it('toggles water units between ml, L, and fl oz', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen trackingApiClient={mockTrackingApi as TrackingApiClient} />
        </ThemeProvider>,
      );
    });

    let text = getAllText(renderer!.root);
    expect(text).toContain('1750 ml');

    // Switch to Liters
    const unitToggle = renderer!.root.find(
      node => node.props.accessibilityLabel === 'Switch water unit to L',
    );

    await act(async () => {
      unitToggle.props.onPress();
    });

    text = getAllText(renderer!.root);
    // 1750 ml = 1.75 L
    expect(text).toContain('1.75 L');
  });

  it('executes quick-add water button seamlessly', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen trackingApiClient={mockTrackingApi as TrackingApiClient} />
        </ThemeProvider>,
      );
    });

    // Find the quick-add +250 ml button
    const quickAddBtn = renderer!.root.find(
      node => node.props.accessibilityLabel === 'Quick add 250 ml of water',
    );

    await act(async () => {
      quickAddBtn.props.onPress();
    });

    expect(mockTrackingApi.logWater).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMl: 250,
        source: 'QUICK_ADD',
      }),
    );
    expect(mockTrackingApi.getWaterSummaryForDate).toHaveBeenCalled();
  });

  it('renders error state and retries on failure', async () => {
    mockTrackingApi.getProgressReport = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

    let renderer: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProgressScreen trackingApiClient={mockTrackingApi as TrackingApiClient} />
        </ThemeProvider>,
      );
    });

    const text = getAllText(renderer!.root);
    expect(text).toContain('Could Not Load Progress');
    expect(text).toContain('Network offline');
  });
});
