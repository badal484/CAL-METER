import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { OnboardingFlow } from '../src/features/onboarding/OnboardingFlow';
import { ProfileScreen } from '../src/features/profile/ProfileScreen';
import type { ProfileApiClient } from '../src/services/profileApi';
import type { GoalApiClient } from '../src/services/goalApi';
import {
  BiologicalSex,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
} from '@calmeter/shared';

describe('Onboarding & Personalization Mobile Components', () => {
  let mockProfileApi: Partial<ProfileApiClient>;
  let mockGoalApi: Partial<GoalApiClient>;

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    name: 'Badal Kumar',
    gender: Gender.MALE,
    biologicalSex: BiologicalSex.MALE,
    dob: '1995-06-15',
    heightCm: 178,
    currentWeightKg: 80,
    targetWeightKg: 74,
    activityLevel: ActivityLevel.MODERATELY_ACTIVE,
    dietPreference: DietPreference.VEGETARIAN,
    primaryGoal: PrimaryGoal.LOSE_WEIGHT,
    paceKgPerWeek: 0.5,
    timezone: 'Asia/Kolkata',
    preferredUnits: UnitSystem.METRIC,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockGoal = {
    id: 'goal-1',
    userId: 'user-1',
    dailyCalories: 2150,
    proteinGrams: 145,
    carbsGrams: 230,
    fatGrams: 65,
    fiberGrams: 30,
    waterMl: 2500,
    effectiveDate: '2026-01-01',
    status: 'ACTIVE' as const,
    primaryGoal: PrimaryGoal.LOSE_WEIGHT,
    targetWeightKg: 74,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    mockProfileApi = {
      getProfile: vi.fn().mockResolvedValue(mockProfile),
      updateProfile: vi.fn().mockImplementation(async data => ({
        ...mockProfile,
        ...data,
      })),
      completeOnboarding: vi.fn().mockResolvedValue({
        profile: mockProfile,
        goal: mockGoal,
        calculations: {
          bmr: 1750,
          tdee: 2712,
          dailyCalories: 2150,
          proteinGrams: 145,
          carbsGrams: 230,
          fatGrams: 65,
          fiberGrams: 30,
          dailyDeficitOrSurplus: -550,
          paceKgPerWeek: 0.5,
          isBelowBmr: false,
          warnings: [],
          disclaimers: ['Estimates only'],
        },
      }),
    };

    mockGoalApi = {
      getCurrentGoal: vi.fn().mockResolvedValue(mockGoal),
      getGoalHistory: vi.fn().mockResolvedValue([mockGoal]),
      createGoal: vi.fn().mockImplementation(async data => ({
        ...mockGoal,
        ...data,
      })),
      updateGoal: vi.fn().mockImplementation(async (_id, data) => ({
        ...mockGoal,
        ...data,
      })),
      recalculateGoals: vi.fn().mockResolvedValue({
        bmr: 1750,
        tdee: 2712,
        suggestedCalories: 2150,
        proteinGrams: 145,
        carbsGrams: 230,
        fatGrams: 65,
        fiberGrams: 30,
        dailyDeficitOrSurplus: -550,
        paceKgPerWeek: 0.5,
        isBelowBmr: false,
        warnings: [],
        disclaimers: ['Estimates only'],
      }),
    };
  });

  describe('OnboardingFlow Component', () => {
    it('renders Step 1 and navigates through all 6 steps to complete onboarding', async () => {
      const onComplete = vi.fn();
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <OnboardingFlow
              onComplete={onComplete}
              apiClient={mockProfileApi as ProfileApiClient}
            />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      // Check Step 1 rendered
      const texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(texts.some(t => t.includes('Step 1 of 6'))).toBe(true);
      expect(texts.some(t => t.includes('Tell us about yourself'))).toBe(true);
      expect(texts.some(t => t.includes('Biological Sex'))).toBe(true);

      // Advance to Step 2
      const step1Continue = root.findByProps({ testID: 'btn-step1-continue' });
      await act(async () => {
        step1Continue.props.onPress();
      });

      // Check Step 2 rendered
      const step2Texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(step2Texts.some(t => t.includes('Step 2 of 6'))).toBe(true);
      expect(step2Texts.some(t => t.includes('What is your primary goal?'))).toBe(true);

      // Advance to Step 3
      const step2Continue = root.findByProps({ testID: 'btn-step2-continue' });
      await act(async () => {
        step2Continue.props.onPress();
      });

      // Check Step 3 rendered
      const step3Texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(step3Texts.some(t => t.includes('Step 3 of 6'))).toBe(true);
      expect(step3Texts.some(t => t.includes('How active are you?'))).toBe(true);

      // Advance to Step 4
      const step3Continue = root.findByProps({ testID: 'btn-step3-continue' });
      await act(async () => {
        step3Continue.props.onPress();
      });

      // Check Step 4 rendered
      const step4Texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(step4Texts.some(t => t.includes('Step 4 of 6'))).toBe(true);
      expect(step4Texts.some(t => t.includes('Target & Preferred Pace'))).toBe(true);

      // Advance to Step 5
      const step4Continue = root.findByProps({ testID: 'btn-step4-continue' });
      await act(async () => {
        step4Continue.props.onPress();
      });

      // Check Step 5 rendered
      const step5Texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(step5Texts.some(t => t.includes('Step 5 of 6'))).toBe(true);
      expect(step5Texts.some(t => t.includes('Dietary Preferences'))).toBe(true);

      // Advance to Step 6
      const step5Continue = root.findByProps({ testID: 'btn-step5-continue' });
      await act(async () => {
        step5Continue.props.onPress();
      });

      // Check Step 6 (Review & Blueprint)
      const step6Texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(step6Texts.some(t => t.includes('Step 6 of 6'))).toBe(true);
      expect(step6Texts.some(t => t.includes('Your Nutrition Blueprint'))).toBe(true);
      expect(step6Texts.some(t => t.includes('DAILY TARGET CALORIES'))).toBe(true);

      // Submit Onboarding
      const completeBtn = root.findByProps({ testID: 'btn-complete-onboarding' });
      await act(async () => {
        await completeBtn.props.onPress();
      });

      expect(mockProfileApi.completeOnboarding).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalled();
    });

    it('navigates back without losing state', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <OnboardingFlow onComplete={vi.fn()} apiClient={mockProfileApi as ProfileApiClient} />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      // Go to Step 2
      await act(async () => {
        root.findByProps({ testID: 'btn-step1-continue' }).props.onPress();
      });

      let texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(texts.some(t => t.includes('Step 2 of 6'))).toBe(true);

      // Tap Back button
      const backBtn = root.findByProps({ testID: 'onboarding-back-btn' });
      await act(async () => {
        backBtn.props.onPress();
      });

      texts = root
        .findAllByType(Text)
        .map(t =>
          Array.isArray(t.props.children)
            ? t.props.children.join('')
            : String(t.props.children ?? ''),
        );
      expect(texts.some(t => t.includes('Step 1 of 6'))).toBe(true);
    });

    it('switches between Metric and Imperial units', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <OnboardingFlow onComplete={vi.fn()} apiClient={mockProfileApi as ProfileApiClient} />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      // Toggle to Imperial
      const imperialBtn = root.findByProps({ testID: 'btn-unit-imperial' });
      await act(async () => {
        imperialBtn.props.onPress();
      });

      // Check Imperial inputs rendered
      expect(root.findByProps({ testID: 'input-height-ft' })).toBeDefined();
      expect(root.findByProps({ testID: 'input-height-in' })).toBeDefined();
      expect(root.findByProps({ testID: 'input-weight-lbs' })).toBeDefined();

      // Toggle back to Metric
      const metricBtn = root.findByProps({ testID: 'btn-unit-metric' });
      await act(async () => {
        metricBtn.props.onPress();
      });

      expect(root.findByProps({ testID: 'input-height-cm' })).toBeDefined();
      expect(root.findByProps({ testID: 'input-weight-kg' })).toBeDefined();
    });
  });

  describe('ProfileScreen Component', () => {
    it('loads and renders current user profile and active nutrition targets', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <ProfileScreen
              profileClient={mockProfileApi as ProfileApiClient}
              goalClient={mockGoalApi as GoalApiClient}
            />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;
      const texts = root.findAllByType(Text).map(t => String(t.props.children));

      expect(texts.some(t => t.includes('Badal Kumar'))).toBe(true);
      expect(texts.some(t => t.includes('178 cm • 80 kg'))).toBe(true);
      expect(texts.some(t => t.includes('2,150 kcal'))).toBe(true);
      expect(texts.some(t => t.includes('145g'))).toBe(true); // Protein
    });

    it('updates body measurements via modal', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <ProfileScreen
              profileClient={mockProfileApi as ProfileApiClient}
              goalClient={mockGoalApi as GoalApiClient}
            />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      // Open measurements modal
      const menuBiometrics = root.findByProps({ testID: 'menu-biometrics' });
      await act(async () => {
        menuBiometrics.props.onPress();
      });

      // Save biometrics
      const saveBtn = root.findByProps({ testID: 'btn-save-biometrics' });
      await act(async () => {
        await saveBtn.props.onPress();
      });

      expect(mockProfileApi.updateProfile).toHaveBeenCalledWith({
        heightCm: 178,
        currentWeightKg: 80,
      });
    });

    it('recalculates nutrition targets when recalculate button is pressed', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <ProfileScreen
              profileClient={mockProfileApi as ProfileApiClient}
              goalClient={mockGoalApi as GoalApiClient}
            />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      const recalcBtn = root.findByProps({ testID: 'btn-recalculate' });
      await act(async () => {
        await recalcBtn.props.onPress();
      });

      expect(mockGoalApi.recalculateGoals).toHaveBeenCalled();
      expect(mockGoalApi.createGoal).toHaveBeenCalled();
    });

    it('opens customize modal and saves target customizations', async () => {
      let renderer: ReactTestRenderer.ReactTestRenderer;

      await act(async () => {
        renderer = ReactTestRenderer.create(
          <ThemeProvider>
            <ProfileScreen
              profileClient={mockProfileApi as ProfileApiClient}
              goalClient={mockGoalApi as GoalApiClient}
            />
          </ThemeProvider>,
        );
      });

      const root = renderer!.root;

      // Open customize modal
      const openCustomizeBtn = root.findByProps({ testID: 'btn-open-customize' });
      await act(async () => {
        openCustomizeBtn.props.onPress();
      });

      // Save custom targets
      const saveTargetsBtn = root.findByProps({ testID: 'btn-save-custom-targets' });
      await act(async () => {
        await saveTargetsBtn.props.onPress();
      });

      expect(mockGoalApi.updateGoal).toHaveBeenCalled();
    });
  });
});
