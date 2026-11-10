import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { ScreenContainer, Card, Button, TextInput } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  BiologicalSex,
  Gender,
  ActivityLevel,
  PrimaryGoal,
  DietPreference,
  UnitSystem,
  calculateBmr,
  calculateTdee,
  calculateCalorieTarget,
  calculateMacronutrients,
  calculateAgeFromDob,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
} from '@calmeter/shared';
import type { OnboardingFormState, OnboardingStep } from './types';
import { ProfileApiClient } from '../../services/profileApi';
import { ChevronLeft, Check, AlertCircle, Info, Sliders, Sparkles } from 'lucide-react-native';

export interface OnboardingFlowProps {
  onComplete: () => void;
  onCancel?: () => void;
  apiClient?: ProfileApiClient;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onCancel,
  apiClient = new ProfileApiClient(),
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [step, setStep] = useState<OnboardingStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Form State
  const [form, setForm] = useState<OnboardingFormState>({
    name: '',
    dob: '1995-06-15',
    biologicalSex: BiologicalSex.MALE,
    gender: Gender.PREFER_NOT_TO_SAY,
    unitSystem: UnitSystem.METRIC,
    heightCm: 175,
    heightFeet: 5,
    heightInches: 9,
    currentWeightKg: 75,
    currentWeightLbs: 165,
    targetWeightKg: 70,
    targetWeightLbs: 154,
    primaryGoal: PrimaryGoal.LOSE_WEIGHT,
    activityLevel: ActivityLevel.MODERATELY_ACTIVE,
    paceKgPerWeek: 0.5,
    dietPreference: DietPreference.ANY,
  });

  // Step 1 Validation
  const age = useMemo(() => {
    try {
      return calculateAgeFromDob(form.dob);
    } catch {
      return null;
    }
  }, [form.dob]);

  const isMinor = age !== null && age < 18;
  const isInvalidDob = age === null || age > 120;

  // Real-time Calculations for Review Screen
  const previewCalculations = useMemo(() => {
    try {
      const currentAge = age && age >= 18 ? age : 25;
      const bmrRes = calculateBmr({
        weightKg: form.currentWeightKg,
        heightCm: form.heightCm,
        ageYears: currentAge,
        biologicalSex: form.biologicalSex,
        gender: form.gender,
      });

      if (bmrRes.status === 'UNSUPPORTED' || !bmrRes.bmr) {
        return null;
      }

      const tdeeRes = calculateTdee({
        bmr: bmrRes.bmr,
        activityLevel: form.activityLevel,
      });

      const calorieRes = calculateCalorieTarget({
        tdee: tdeeRes.tdee,
        bmr: bmrRes.bmr,
        primaryGoal: form.primaryGoal,
        paceKgPerWeek: form.paceKgPerWeek,
        customCalorieOverride: form.customDailyCalories,
      });

      const macroRes = calculateMacronutrients({
        dailyCalories: calorieRes.dailyCalories,
        customProteinGrams: form.customProteinGrams,
        customCarbsGrams: form.customCarbsGrams,
        customFatGrams: form.customFatGrams,
        customFiberGrams: form.customFiberGrams,
      });

      return {
        bmr: bmrRes.bmr,
        tdee: tdeeRes.tdee,
        dailyCalories: calorieRes.dailyCalories,
        deficitOrSurplus: calorieRes.dailyDeficitOrSurplus,
        proteinGrams: macroRes.proteinGrams,
        carbsGrams: macroRes.carbsGrams,
        fatGrams: macroRes.fatGrams,
        fiberGrams: macroRes.fiberGrams,
        isBelowBmr: calorieRes.isBelowBmr,
        warnings: [...(calorieRes.warnings || []), ...(macroRes.warnings || [])],
      };
    } catch {
      return null;
    }
  }, [form, age]);

  // Unit Toggle Handlers
  const toggleUnitSystem = (system: UnitSystem) => {
    if (system === form.unitSystem) return;

    if (system === UnitSystem.IMPERIAL) {
      const { feet, inches } = cmToFeetInches(form.heightCm);
      const weightLbs = kgToLbs(form.currentWeightKg);
      const targetLbs = kgToLbs(form.targetWeightKg);
      setForm(prev => ({
        ...prev,
        unitSystem: UnitSystem.IMPERIAL,
        heightFeet: feet,
        heightInches: inches,
        currentWeightLbs: Math.round(weightLbs),
        targetWeightLbs: Math.round(targetLbs),
      }));
    } else {
      const heightCm = Math.round(feetInchesToCm(form.heightFeet, form.heightInches));
      const weightKg = Math.round(lbsToKg(form.currentWeightLbs));
      const targetKg = Math.round(lbsToKg(form.targetWeightLbs));
      setForm(prev => ({
        ...prev,
        unitSystem: UnitSystem.METRIC,
        heightCm,
        currentWeightKg: weightKg,
        targetWeightKg: targetKg,
      }));
    }
  };

  const handleNext = () => {
    setApiError(null);
    if (step === 1) {
      if (isMinor) {
        Alert.alert(
          'Age Requirement',
          'CAL METER requires users to be at least 18 years of age. Pediatric nutrition requires clinical oversight.',
        );
        return;
      }
      if (isInvalidDob) {
        Alert.alert('Invalid Date', 'Please enter a valid date of birth (YYYY-MM-DD).');
        return;
      }
      if (form.heightCm < 100 || form.heightCm > 250) {
        Alert.alert('Invalid Height', 'Height must be between 100 cm and 250 cm.');
        return;
      }
      if (form.currentWeightKg < 30 || form.currentWeightKg > 350) {
        Alert.alert('Invalid Weight', 'Weight must be between 30 kg and 350 kg.');
        return;
      }
    }

    if (step < 6) {
      setStep((step + 1) as OnboardingStep);
    }
  };

  const handleBack = () => {
    setApiError(null);
    if (step > 1) {
      setStep((step - 1) as OnboardingStep);
    } else if (onCancel) {
      onCancel();
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      await apiClient.completeOnboarding({
        name: form.name.trim() || undefined,
        dob: form.dob,
        gender: form.gender,
        biologicalSex: form.biologicalSex,
        heightCm: form.heightCm,
        currentWeightKg: form.currentWeightKg,
        targetWeightKg: form.targetWeightKg,
        primaryGoal: form.primaryGoal,
        activityLevel: form.activityLevel,
        paceKgPerWeek: form.paceKgPerWeek,
        dietPreference: form.dietPreference,
        timezone: 'Asia/Kolkata',
        preferredUnits: form.unitSystem,
        customDailyCalories: form.customDailyCalories,
        customProteinGrams: form.customProteinGrams,
        customCarbsGrams: form.customCarbsGrams,
        customFatGrams: form.customFatGrams,
        customFiberGrams: form.customFiberGrams,
      });

      onComplete();
    } catch (err: any) {
      setApiError(err.message || 'Failed to complete onboarding. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      {/* Header with Step Progress */}
      <View style={[styles.header, { marginBottom: spacing.md }]}>
        <View style={styles.headerRow}>
          {step > 1 ? (
            <Pressable
              onPress={handleBack}
              style={[
                styles.navBtn,
                { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
              ]}
              testID="onboarding-back-btn"
            >
              <ChevronLeft size={20} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}

          <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
            {`Step ${step} of 6`}
          </Text>

          {onCancel ? (
            <Pressable onPress={onCancel}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Cancel</Text>
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>

        {/* Progress Bar */}
        <View
          style={[
            styles.progressBarTrack,
            { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${(step / 6) * 100}%`,
                backgroundColor: colors.primary,
                borderRadius: radii.full,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        {apiError && (
          <Card
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.error,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={styles.inlineRow}>
              <AlertCircle size={20} color={colors.error} />
              <Text
                style={[
                  typography.bodySmall,
                  { color: colors.error, marginLeft: spacing.sm, flex: 1 },
                ]}
              >
                {apiError}
              </Text>
            </View>
          </Card>
        )}

        {/* ================= STEP 1: BASIC INFORMATION ================= */}
        {step === 1 && (
          <View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              Tell us about yourself
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              We use these measurements to calculate your baseline metabolic rate.
            </Text>

            <TextInput
              label="Display Name (optional)"
              placeholder="e.g. Badal"
              value={form.name}
              onChangeText={val => setForm(f => ({ ...f, name: val }))}
              containerStyle={{ marginBottom: spacing.md }}
              testID="input-name"
            />

            <TextInput
              label="Date of Birth (YYYY-MM-DD)"
              placeholder="1995-06-15"
              value={form.dob}
              onChangeText={val => setForm(f => ({ ...f, dob: val }))}
              errorMessage={
                isMinor
                  ? 'Must be at least 18 years of age.'
                  : isInvalidDob
                    ? 'Please enter valid date YYYY-MM-DD.'
                    : undefined
              }
              helperText={age !== null && !isMinor ? `Age: ${age} years` : undefined}
              containerStyle={{ marginBottom: spacing.md }}
              testID="input-dob"
            />

            {/* Biological Sex Selector */}
            <View style={{ marginBottom: spacing.md }}>
              <Text
                style={[
                  typography.labelMedium,
                  { color: colors.textPrimary, marginBottom: spacing.xs },
                ]}
              >
                Biological Sex
              </Text>
              <View style={styles.buttonGroup}>
                <Pressable
                  onPress={() => setForm(f => ({ ...f, biologicalSex: BiologicalSex.MALE }))}
                  style={[
                    styles.groupBtn,
                    {
                      borderColor:
                        form.biologicalSex === BiologicalSex.MALE ? colors.primary : colors.border,
                      backgroundColor:
                        form.biologicalSex === BiologicalSex.MALE
                          ? colors.surfaceMuted
                          : colors.surface,
                      borderRadius: radii.md,
                    },
                  ]}
                  testID="btn-sex-male"
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color:
                          form.biologicalSex === BiologicalSex.MALE
                            ? colors.primary
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    Male
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setForm(f => ({ ...f, biologicalSex: BiologicalSex.FEMALE }))}
                  style={[
                    styles.groupBtn,
                    {
                      borderColor:
                        form.biologicalSex === BiologicalSex.FEMALE
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        form.biologicalSex === BiologicalSex.FEMALE
                          ? colors.surfaceMuted
                          : colors.surface,
                      borderRadius: radii.md,
                    },
                  ]}
                  testID="btn-sex-female"
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      {
                        color:
                          form.biologicalSex === BiologicalSex.FEMALE
                            ? colors.primary
                            : colors.textSecondary,
                      },
                    ]}
                  >
                    Female
                  </Text>
                </Pressable>
              </View>

              {/* Informational Callout */}
              <Card
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.borderSubtle,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <View style={styles.inlineRow}>
                  <Info size={16} color={colors.textSecondary} />
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 },
                    ]}
                  >
                    Biological sex assigned at birth is required for physiological accuracy in the
                    Mifflin-St Jeor equation. We fully respect your gender identity; this is used
                    strictly for clinical energy expenditure.
                  </Text>
                </View>
              </Card>
            </View>

            {/* Units Toggle */}
            <View style={[styles.unitsRow, { marginBottom: spacing.md }]}>
              <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>
                Unit System
              </Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => toggleUnitSystem(UnitSystem.METRIC)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor:
                        form.unitSystem === UnitSystem.METRIC
                          ? colors.primary
                          : colors.surfaceMuted,
                      borderRadius: radii.sm,
                    },
                  ]}
                  testID="btn-unit-metric"
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color:
                          form.unitSystem === UnitSystem.METRIC
                            ? colors.textInverse
                            : colors.textSecondary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Metric (cm/kg)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => toggleUnitSystem(UnitSystem.IMPERIAL)}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor:
                        form.unitSystem === UnitSystem.IMPERIAL
                          ? colors.primary
                          : colors.surfaceMuted,
                      borderRadius: radii.sm,
                      marginLeft: spacing.xs,
                    },
                  ]}
                  testID="btn-unit-imperial"
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color:
                          form.unitSystem === UnitSystem.IMPERIAL
                            ? colors.textInverse
                            : colors.textSecondary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    Imperial (ft/lbs)
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Height & Weight Inputs */}
            {form.unitSystem === UnitSystem.METRIC ? (
              <View>
                <TextInput
                  label="Height (cm)"
                  keyboardType="numeric"
                  value={String(form.heightCm)}
                  onChangeText={val => {
                    const num = Number(val);
                    setForm(f => ({ ...f, heightCm: isNaN(num) ? 0 : num }));
                  }}
                  containerStyle={{ marginBottom: spacing.md }}
                  testID="input-height-cm"
                />

                <TextInput
                  label="Current Weight (kg)"
                  keyboardType="numeric"
                  value={String(form.currentWeightKg)}
                  onChangeText={val => {
                    const num = Number(val);
                    setForm(f => ({ ...f, currentWeightKg: isNaN(num) ? 0 : num }));
                  }}
                  containerStyle={{ marginBottom: spacing.md }}
                  testID="input-weight-kg"
                />
              </View>
            ) : (
              <View>
                <View style={styles.inlineInputs}>
                  <TextInput
                    label="Height (Feet)"
                    keyboardType="numeric"
                    value={String(form.heightFeet)}
                    onChangeText={val => {
                      const ft = Number(val) || 0;
                      const cm = Math.round(feetInchesToCm(ft, form.heightInches));
                      setForm(f => ({ ...f, heightFeet: ft, heightCm: cm }));
                    }}
                    containerStyle={{ flex: 1, marginRight: spacing.sm }}
                    testID="input-height-ft"
                  />
                  <TextInput
                    label="Inches"
                    keyboardType="numeric"
                    value={String(form.heightInches)}
                    onChangeText={val => {
                      const inch = Number(val) || 0;
                      const cm = Math.round(feetInchesToCm(form.heightFeet, inch));
                      setForm(f => ({ ...f, heightInches: inch, heightCm: cm }));
                    }}
                    containerStyle={{ flex: 1 }}
                    testID="input-height-in"
                  />
                </View>

                <TextInput
                  label="Current Weight (lbs)"
                  keyboardType="numeric"
                  value={String(form.currentWeightLbs)}
                  onChangeText={val => {
                    const lbs = Number(val) || 0;
                    const kg = Math.round(lbsToKg(lbs));
                    setForm(f => ({ ...f, currentWeightLbs: lbs, currentWeightKg: kg }));
                  }}
                  containerStyle={{ marginBottom: spacing.md }}
                  testID="input-weight-lbs"
                />
              </View>
            )}

            <Button
              title="Continue"
              onPress={handleNext}
              disabled={isMinor || isInvalidDob}
              style={{ marginTop: spacing.md }}
              testID="btn-step1-continue"
            />
          </View>
        )}

        {/* ================= STEP 2: PRIMARY GOAL ================= */}
        {step === 2 && (
          <View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              What is your primary goal?
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              Choose the primary focus for your personalized nutrition plan.
            </Text>

            {[
              {
                id: PrimaryGoal.LOSE_WEIGHT,
                title: 'Lose Weight / Fat Loss',
                desc: 'A safe, structured caloric deficit designed to drop fat while preserving lean muscle.',
              },
              {
                id: PrimaryGoal.MAINTAIN_WEIGHT,
                title: 'Maintain Weight & Recomposition',
                desc: 'Balanced caloric intake to sustain your current weight, enhance workout energy, and recompose body composition.',
              },
              {
                id: PrimaryGoal.BUILD_MUSCLE,
                title: 'Build Muscle / Clean Surplus',
                desc: 'A modest caloric surplus paired with high protein to maximize hypertrophy and strength gains.',
              },
            ].map(item => {
              const selected = form.primaryGoal === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setForm(f => ({ ...f, primaryGoal: item.id }))}
                  style={[
                    styles.goalOptionCard,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.md,
                    },
                  ]}
                  testID={`goal-option-${item.id}`}
                >
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        typography.titleSmall,
                        { color: selected ? colors.primary : colors.textPrimary },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </View>
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.textSecondary, marginTop: spacing.xs },
                    ]}
                  >
                    {item.desc}
                  </Text>
                </Pressable>
              );
            })}

            <Card
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.borderSubtle,
                  marginBottom: spacing.lg,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Energy balance (calories in vs. calories out) controls overall body weight change,
                while resistance training and adequate dietary protein stimulate muscle hypertrophy.
              </Text>
            </Card>

            <Button title="Continue" onPress={handleNext} testID="btn-step2-continue" />
          </View>
        )}

        {/* ================= STEP 3: ACTIVITY LEVEL ================= */}
        {step === 3 && (
          <View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              How active are you?
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              Physical activity determines your daily total energy expenditure (TDEE).
            </Text>

            {[
              {
                id: ActivityLevel.SEDENTARY,
                title: 'Sedentary',
                desc: 'Desk job, little to no intentional exercise or sports (PAL 1.20)',
              },
              {
                id: ActivityLevel.LIGHTLY_ACTIVE,
                title: 'Lightly Active',
                desc: 'Light exercise or brisk walking 1 to 3 days per week (PAL 1.375)',
              },
              {
                id: ActivityLevel.MODERATELY_ACTIVE,
                title: 'Moderately Active',
                desc: 'Moderate exercise 3 to 5 days per week, typical gym goer (PAL 1.55)',
              },
              {
                id: ActivityLevel.VERY_ACTIVE,
                title: 'Very Active',
                desc: 'Hard exercise or sports 6 to 7 days per week (PAL 1.725)',
              },
              {
                id: ActivityLevel.EXTRA_ACTIVE,
                title: 'Extra Active',
                desc: 'Very intense physical job or twice-daily training / athlete (PAL 1.90)',
              },
            ].map(item => {
              const selected = form.activityLevel === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setForm(f => ({ ...f, activityLevel: item.id }))}
                  style={[
                    styles.goalOptionCard,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                  testID={`activity-option-${item.id}`}
                >
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        typography.titleSmall,
                        { color: selected ? colors.primary : colors.textPrimary },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </View>
                  <Text
                    style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}
                  >
                    {item.desc}
                  </Text>
                </Pressable>
              );
            })}

            <Button
              title="Continue"
              onPress={handleNext}
              style={{ marginTop: spacing.md }}
              testID="btn-step3-continue"
            />
          </View>
        )}

        {/* ================= STEP 4: TARGET SELECTION ================= */}
        {step === 4 && (
          <View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              Target & Preferred Pace
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              Set your target body weight and the speed at which you want to progress.
            </Text>

            {form.unitSystem === UnitSystem.METRIC ? (
              <TextInput
                label="Target Weight (kg)"
                keyboardType="numeric"
                value={String(form.targetWeightKg)}
                onChangeText={val => {
                  const kg = Number(val) || 0;
                  setForm(f => ({ ...f, targetWeightKg: kg }));
                }}
                containerStyle={{ marginBottom: spacing.md }}
                testID="input-target-weight-kg"
              />
            ) : (
              <TextInput
                label="Target Weight (lbs)"
                keyboardType="numeric"
                value={String(form.targetWeightLbs)}
                onChangeText={val => {
                  const lbs = Number(val) || 0;
                  const kg = Math.round(lbsToKg(lbs));
                  setForm(f => ({ ...f, targetWeightLbs: lbs, targetWeightKg: kg }));
                }}
                containerStyle={{ marginBottom: spacing.md }}
                testID="input-target-weight-lbs"
              />
            )}

            <Text
              style={[
                typography.labelMedium,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              Pace of Change
            </Text>

            {[
              { pace: 0.25, label: '0.25 kg / week (Gentle & Sustainable)' },
              { pace: 0.5, label: '0.50 kg / week (Recommended Standard)' },
              { pace: 0.75, label: '0.75 kg / week (Moderate)' },
              { pace: 1.0, label: '1.00 kg / week (Aggressive Maximum)' },
            ].map(item => {
              const selected = form.paceKgPerWeek === item.pace;
              return (
                <Pressable
                  key={item.pace}
                  onPress={() => setForm(f => ({ ...f, paceKgPerWeek: item.pace }))}
                  style={[
                    styles.goalOptionCard,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                  testID={`pace-option-${item.pace}`}
                >
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: selected ? colors.primary : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </View>
                </Pressable>
              );
            })}

            <Button
              title="Continue"
              onPress={handleNext}
              style={{ marginTop: spacing.md }}
              testID="btn-step4-continue"
            />
          </View>
        )}

        {/* ================= STEP 5: NUTRITION PREFERENCES ================= */}
        {step === 5 && (
          <View>
            <Text
              style={[
                typography.titleLarge,
                { color: colors.textPrimary, marginBottom: spacing.xs },
              ]}
            >
              Dietary Preferences
            </Text>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              Help us customize food logging recommendations and Indian meal templates.
            </Text>

            {[
              { id: DietPreference.ANY, label: 'Any / No Specific Restrictions' },
              { id: DietPreference.VEGETARIAN, label: 'Vegetarian (Lacto-Ovo)' },
              { id: DietPreference.VEGAN, label: '100% Plant-Based / Vegan' },
              { id: DietPreference.EGGETARIAN, label: 'Eggetarian (Vegetarian + Eggs)' },
              { id: DietPreference.JAIN, label: 'Jain (No Root Vegetables/Garlic/Onion)' },
              { id: DietPreference.KETO, label: 'Ketogenic / Low-Carb' },
              { id: DietPreference.HALAL, label: 'Halal Certified Foods' },
            ].map(item => {
              const selected = form.dietPreference === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setForm(f => ({ ...f, dietPreference: item.id }))}
                  style={[
                    styles.goalOptionCard,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                      borderRadius: radii.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                  testID={`diet-option-${item.id}`}
                >
                  <View style={styles.goalHeaderRow}>
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: selected ? colors.primary : colors.textPrimary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {selected && <Check size={18} color={colors.primary} />}
                  </View>
                </Pressable>
              );
            })}

            <Button
              title="Continue to Plan Review"
              onPress={handleNext}
              style={{ marginTop: spacing.md }}
              testID="btn-step5-continue"
            />
          </View>
        )}

        {/* ================= STEP 6: RESULTS & REVIEW ================= */}
        {step === 6 && (
          <View>
            <View style={styles.inlineRow}>
              <Sparkles size={24} color={colors.primary} />
              <Text
                style={[
                  typography.titleLarge,
                  { color: colors.textPrimary, marginLeft: spacing.xs, flex: 1 },
                ]}
              >
                Your Nutrition Blueprint
              </Text>
            </View>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.textSecondary, marginBottom: spacing.lg },
              ]}
            >
              Here is your calculated baseline target based on Mifflin-St Jeor and physical
              activity.
            </Text>

            {previewCalculations ? (
              <View>
                {/* Calories Card */}
                <Card
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      marginBottom: spacing.md,
                      alignItems: 'center',
                      paddingVertical: spacing.lg,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    DAILY TARGET CALORIES
                  </Text>
                  <Text
                    style={[
                      typography.numericLarge,
                      { color: colors.primary, marginVertical: spacing.xs },
                    ]}
                  >
                    {previewCalculations.dailyCalories.toLocaleString()} kcal
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    BMR: {previewCalculations.bmr} kcal • TDEE: {previewCalculations.tdee} kcal
                  </Text>
                </Card>

                {/* Macronutrient Distribution */}
                <Card
                  style={[
                    styles.macroCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderSubtle,
                      marginBottom: spacing.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: colors.textPrimary, marginBottom: spacing.sm },
                    ]}
                  >
                    Target Macronutrient Split
                  </Text>
                  <View style={styles.macroGrid}>
                    <View style={styles.macroColumn}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Protein
                      </Text>
                      <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                        {previewCalculations.proteinGrams}g
                      </Text>
                    </View>
                    <View style={styles.macroColumn}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Carbs
                      </Text>
                      <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                        {previewCalculations.carbsGrams}g
                      </Text>
                    </View>
                    <View style={styles.macroColumn}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>Fat</Text>
                      <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                        {previewCalculations.fatGrams}g
                      </Text>
                    </View>
                    <View style={styles.macroColumn}>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Fiber
                      </Text>
                      <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                        {previewCalculations.fiberGrams}g
                      </Text>
                    </View>
                  </View>
                </Card>

                {/* Disclaimers & Non-Medical Notice */}
                <Card
                  style={[
                    styles.disclaimerCard,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.borderSubtle,
                      marginBottom: spacing.md,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View style={styles.inlineRow}>
                    <Info size={18} color={colors.textSecondary} />
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.textSecondary, marginLeft: spacing.xs, flex: 1 },
                      ]}
                    >
                      BMR and TDEE are mathematical estimates derived from population equations, not
                      clinical measurements. Monitor real-world body weight trends over 2–4 weeks
                      and adjust calorie targets accordingly.
                    </Text>
                  </View>
                </Card>

                {/* Customization Toggle */}
                <Pressable
                  onPress={() => setShowCustomizer(!showCustomizer)}
                  style={[
                    styles.inlineRow,
                    {
                      justifyContent: 'center',
                      paddingVertical: spacing.sm,
                      marginBottom: spacing.md,
                    },
                  ]}
                  testID="btn-toggle-customizer"
                >
                  <Sliders size={16} color={colors.primary} />
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: colors.primary, marginLeft: spacing.xs },
                    ]}
                  >
                    {showCustomizer
                      ? 'Hide Target Customization'
                      : 'Customize Calorie & Macro Targets'}
                  </Text>
                </Pressable>

                {showCustomizer && (
                  <Card
                    style={[
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        marginBottom: spacing.md,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <TextInput
                      label="Custom Daily Calories"
                      keyboardType="numeric"
                      placeholder={String(previewCalculations.dailyCalories)}
                      value={form.customDailyCalories ? String(form.customDailyCalories) : ''}
                      onChangeText={val => {
                        const num = Number(val);
                        setForm(f => ({
                          ...f,
                          customDailyCalories: num > 0 ? num : undefined,
                        }));
                      }}
                      containerStyle={{ marginBottom: spacing.sm }}
                    />
                    <View style={styles.inlineInputs}>
                      <TextInput
                        label="Protein (g)"
                        keyboardType="numeric"
                        placeholder={String(previewCalculations.proteinGrams)}
                        value={form.customProteinGrams ? String(form.customProteinGrams) : ''}
                        onChangeText={val => {
                          const num = Number(val);
                          setForm(f => ({
                            ...f,
                            customProteinGrams: num > 0 ? num : undefined,
                          }));
                        }}
                        containerStyle={{ flex: 1, marginRight: spacing.xs }}
                      />
                      <TextInput
                        label="Carbs (g)"
                        keyboardType="numeric"
                        placeholder={String(previewCalculations.carbsGrams)}
                        value={form.customCarbsGrams ? String(form.customCarbsGrams) : ''}
                        onChangeText={val => {
                          const num = Number(val);
                          setForm(f => ({
                            ...f,
                            customCarbsGrams: num > 0 ? num : undefined,
                          }));
                        }}
                        containerStyle={{ flex: 1, marginRight: spacing.xs }}
                      />
                      <TextInput
                        label="Fat (g)"
                        keyboardType="numeric"
                        placeholder={String(previewCalculations.fatGrams)}
                        value={form.customFatGrams ? String(form.customFatGrams) : ''}
                        onChangeText={val => {
                          const num = Number(val);
                          setForm(f => ({
                            ...f,
                            customFatGrams: num > 0 ? num : undefined,
                          }));
                        }}
                        containerStyle={{ flex: 1 }}
                      />
                    </View>
                  </Card>
                )}

                <Button
                  title="Save & Start Journey"
                  onPress={handleComplete}
                  loading={submitting}
                  testID="btn-complete-onboarding"
                />
              </View>
            ) : (
              <Text style={[typography.bodyMedium, { color: colors.error }]}>
                Unable to calculate targets with the provided biometrics. Please go back and check
                your inputs.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  errorCard: {
    padding: 12,
    borderWidth: 1,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  groupBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  infoCard: {
    padding: 10,
    borderWidth: 1,
  },
  unitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRow: {
    flexDirection: 'row',
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalOptionCard: {
    borderWidth: 1,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultCard: {
    borderWidth: 1,
  },
  macroCard: {
    borderWidth: 1,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  macroColumn: {
    alignItems: 'center',
  },
  disclaimerCard: {
    borderWidth: 1,
  },
});
