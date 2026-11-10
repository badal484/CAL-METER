import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert, Modal, ScrollView } from 'react-native';
import { ScreenContainer, Card, SectionHeader, Button, TextInput } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  User,
  Target,
  Scale,
  Moon,
  ShieldCheck,
  ChevronRight,
  Edit2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react-native';
import { ProfileApiClient } from '../../services/profileApi';
import { GoalApiClient } from '../../services/goalApi';
import type { UserProfileDto, NutritionGoalDto } from '@calmeter/contracts';
import { PrimaryGoal, ActivityLevel } from '@calmeter/shared';
import { OnboardingFlow } from '../onboarding/OnboardingFlow';
import { ManageSubscriptionView } from '../subscription/ManageSubscriptionView';

export interface ProfileScreenProps {
  profileClient?: ProfileApiClient;
  goalClient?: GoalApiClient;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profileClient = new ProfileApiClient(),
  goalClient = new GoalApiClient(),
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  // View state
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [goal, setGoal] = useState<NutritionGoalDto | null>(null);
  const [_loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Modals
  const [editBiometricsModal, setEditBiometricsModal] = useState(false);
  const [editGoalModal, setEditGoalModal] = useState(false);
  const [customizeModal, setCustomizeModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Edit Biometrics Draft
  const [draftHeightCm, setDraftHeightCm] = useState('175');
  const [draftWeightKg, setDraftWeightKg] = useState('75');

  // Edit Goal Draft
  const [draftPrimaryGoal, setDraftPrimaryGoal] = useState<PrimaryGoal>(PrimaryGoal.LOSE_WEIGHT);
  const [draftActivityLevel, setDraftActivityLevel] = useState<ActivityLevel>(
    ActivityLevel.MODERATELY_ACTIVE,
  );
  const [draftTargetWeightKg, setDraftTargetWeightKg] = useState('70');
  const [draftPace, setDraftPace] = useState(0.5);

  // Customize Targets Draft
  const [draftCalories, setDraftCalories] = useState('2100');
  const [draftProtein, setDraftProtein] = useState('140');
  const [draftCarbs, setDraftCarbs] = useState('220');
  const [draftFat, setDraftFat] = useState('65');
  const [draftFiber, setDraftFiber] = useState('30');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedProfile, fetchedGoal] = await Promise.all([
        profileClient.getProfile().catch(() => null),
        goalClient.getCurrentGoal().catch(() => null),
      ]);

      if (fetchedProfile) {
        setProfile(fetchedProfile);
        setDraftHeightCm(String(fetchedProfile.heightCm));
        setDraftWeightKg(String(fetchedProfile.currentWeightKg));
        if (fetchedProfile.targetWeightKg) {
          setDraftTargetWeightKg(String(fetchedProfile.targetWeightKg));
        }
        if (fetchedProfile.primaryGoal) {
          setDraftPrimaryGoal(fetchedProfile.primaryGoal);
        }
        if (fetchedProfile.activityLevel) {
          setDraftActivityLevel(fetchedProfile.activityLevel);
        }
      }

      if (fetchedGoal) {
        setGoal(fetchedGoal);
        setDraftCalories(String(fetchedGoal.dailyCalories));
        setDraftProtein(String(fetchedGoal.proteinGrams));
        setDraftCarbs(String(fetchedGoal.carbsGrams));
        setDraftFat(String(fetchedGoal.fatGrams));
        setDraftFiber(String(fetchedGoal.fiberGrams));
      }
    } finally {
      setLoading(false);
    }
  }, [profileClient, goalClient]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveBiometrics = async () => {
    try {
      const height = Number(draftHeightCm);
      const weight = Number(draftWeightKg);
      if (isNaN(height) || height < 100 || height > 250) {
        Alert.alert('Invalid Height', 'Height must be between 100 cm and 250 cm.');
        return;
      }
      if (isNaN(weight) || weight < 30 || weight > 350) {
        Alert.alert('Invalid Weight', 'Weight must be between 30 kg and 350 kg.');
        return;
      }

      const updated = await profileClient.updateProfile({
        heightCm: height,
        currentWeightKg: weight,
      });
      setProfile(updated);
      setEditBiometricsModal(false);
      Alert.alert('Measurements Updated', 'Your body stats and weight log have been updated.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update biometrics.');
    }
  };

  const handleSaveGoalSettings = async () => {
    try {
      const targetWeight = Number(draftTargetWeightKg) || undefined;
      const updated = await profileClient.updateProfile({
        primaryGoal: draftPrimaryGoal,
        activityLevel: draftActivityLevel,
        targetWeightKg: targetWeight,
        paceKgPerWeek: draftPace,
      });
      setProfile(updated);
      setEditGoalModal(false);
      Alert.alert('Goal Updated', 'Your primary goal and activity preferences were saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update goal.');
    }
  };

  const handleSaveCustomTargets = async () => {
    try {
      const cals = Number(draftCalories);
      const p = Number(draftProtein);
      const c = Number(draftCarbs);
      const f = Number(draftFat);
      const fib = Number(draftFiber);

      if (goal?.id) {
        const updated = await goalClient.updateGoal(goal.id, {
          dailyCalories: cals,
          proteinGrams: p,
          carbsGrams: c,
          fatGrams: f,
          fiberGrams: fib,
        });
        setGoal(updated);
      } else {
        const created = await goalClient.createGoal({
          dailyCalories: cals,
          proteinGrams: p,
          carbsGrams: c,
          fatGrams: f,
          fiberGrams: fib,
          effectiveDate: new Date().toISOString().split('T')[0],
        });
        setGoal(created);
      }

      setCustomizeModal(false);
      Alert.alert('Targets Updated', 'Custom nutrition targets have been saved.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save custom targets.');
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const recalculated = await goalClient.recalculateGoals({
        primaryGoal: profile?.primaryGoal ?? draftPrimaryGoal,
        activityLevel: profile?.activityLevel ?? draftActivityLevel,
        paceKgPerWeek: profile?.paceKgPerWeek ?? draftPace,
      });

      // Automatically create a new active goal with the recalculated values
      const newGoal = await goalClient.createGoal({
        dailyCalories: recalculated.suggestedCalories,
        proteinGrams: recalculated.proteinGrams,
        carbsGrams: recalculated.carbsGrams,
        fatGrams: recalculated.fatGrams,
        fiberGrams: recalculated.fiberGrams,
        effectiveDate: new Date().toISOString().split('T')[0],
      });

      setGoal(newGoal);
      setDraftCalories(String(newGoal.dailyCalories));
      setDraftProtein(String(newGoal.proteinGrams));
      setDraftCarbs(String(newGoal.carbsGrams));
      setDraftFat(String(newGoal.fatGrams));
      setDraftFiber(String(newGoal.fiberGrams));

      Alert.alert(
        'Goals Recalculated',
        `Suggested Daily Calories: ${recalculated.suggestedCalories} kcal\nProtein: ${recalculated.proteinGrams}g • Carbs: ${recalculated.carbsGrams}g • Fat: ${recalculated.fatGrams}g`,
      );
    } catch (err: any) {
      Alert.alert('Recalculation Error', err.message || 'Failed to recalculate goals.');
    } finally {
      setRecalculating(false);
    }
  };

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={() => {
          setShowOnboarding(false);
          loadData();
        }}
        onCancel={() => setShowOnboarding(false)}
        apiClient={profileClient}
      />
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
      >
        {/* Profile Header Avatar Card */}
        <Card style={[styles.profileHeader, { marginBottom: spacing.md }]}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
            ]}
          >
            <User size={32} color={colors.textPrimary} />
          </View>

          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text
              style={[typography.titleSmall, { color: colors.textPrimary }]}
              testID="profile-user-name"
            >
              {profile?.name || 'Athlete Profile'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {profile
                ? `${profile.heightCm} cm • ${profile.currentWeightKg} kg (Goal: ${
                    profile.targetWeightKg ?? '—'
                  } kg)`
                : 'No profile configured'}
            </Text>
            <View
              style={[
                styles.planBadge,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.xs,
                  paddingHorizontal: spacing.xs,
                  marginTop: spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  { color: colors.primary, fontSize: 10, fontWeight: '600' },
                ]}
              >
                {profile?.primaryGoal ? profile.primaryGoal.replace('_', ' ') : 'ACTIVE ATHLETE'}
              </Text>
            </View>
          </View>
        </Card>

        {/* ACTIVE NUTRITION GOAL CARD */}
        <Card
          style={[
            styles.goalCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              marginBottom: spacing.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={styles.inlineRow}>
              <Target size={20} color={colors.primary} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Active Daily Targets
              </Text>
            </View>
            <Pressable
              onPress={() => setCustomizeModal(true)}
              style={styles.inlineRow}
              testID="btn-open-customize"
            >
              <Edit2 size={16} color={colors.primary} />
              <Text
                style={[
                  typography.caption,
                  { color: colors.primary, marginLeft: 4, fontWeight: '600' },
                ]}
              >
                Customize
              </Text>
            </Pressable>
          </View>

          <View style={styles.caloriesRow}>
            <Text
              style={[typography.numericLarge, { color: colors.primary }]}
              testID="target-calories"
            >
              {goal ? `${goal.dailyCalories.toLocaleString()} kcal` : '2,100 kcal'}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Daily Energy Target
            </Text>
          </View>

          <View style={styles.macroSplitRow}>
            <View style={styles.macroPill}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Protein</Text>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}
              >
                {goal ? `${goal.proteinGrams}g` : '150g'}
              </Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Carbs</Text>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}
              >
                {goal ? `${goal.carbsGrams}g` : '220g'}
              </Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Fat</Text>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}
              >
                {goal ? `${goal.fatGrams}g` : '65g'}
              </Text>
            </View>
            <View style={styles.macroPill}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Fiber</Text>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '600' }]}
              >
                {goal ? `${goal.fiberGrams}g` : '30g'}
              </Text>
            </View>
          </View>

          <Button
            title={recalculating ? 'Recalculating...' : 'Recalculate Suggested Targets'}
            variant="outline"
            size="sm"
            onPress={handleRecalculate}
            disabled={recalculating}
            style={{ marginTop: spacing.md }}
            leftIcon={<RefreshCw size={14} color={colors.primary} />}
            testID="btn-recalculate"
          />
        </Card>

        {/* SECTION: SUBSCRIPTION & PREMIUM MEMBERSHIP */}
        <ManageSubscriptionView />

        {/* SECTION: NUTRITION & BODY MANAGEMENT */}
        <SectionHeader title="Profile & Goal Settings" style={{ marginBottom: spacing.xs }} />

        {/* Edit Body Measurements */}
        <Pressable
          onPress={() => setEditBiometricsModal(true)}
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              marginBottom: spacing.xs,
              padding: spacing.md,
            },
          ]}
          testID="menu-biometrics"
        >
          <View style={styles.inlineRow}>
            <Scale size={20} color={colors.textPrimary} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '500' }]}
              >
                Body Measurements
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {profile
                  ? `Height: ${profile.heightCm} cm • Weight: ${profile.currentWeightKg} kg`
                  : 'Update height & weight measurements'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </View>
        </Pressable>

        {/* Update Goal & Activity */}
        <Pressable
          onPress={() => setEditGoalModal(true)}
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              marginBottom: spacing.xs,
              padding: spacing.md,
            },
          ]}
          testID="menu-goals"
        >
          <View style={styles.inlineRow}>
            <Target size={20} color={colors.textPrimary} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text
                style={[typography.bodyMedium, { color: colors.textPrimary, fontWeight: '500' }]}
              >
                Primary Goal & Activity
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {profile?.activityLevel
                  ? profile.activityLevel.replace('_', ' ')
                  : 'Set activity level'}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </View>
        </Pressable>

        {/* Re-run Onboarding */}
        <Pressable
          onPress={() => setShowOnboarding(true)}
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              borderRadius: radii.md,
              marginBottom: spacing.md,
              padding: spacing.md,
            },
          ]}
          testID="btn-run-onboarding"
        >
          <View style={styles.inlineRow}>
            <Sparkles size={20} color={colors.primary} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typography.bodyMedium, { color: colors.primary, fontWeight: '600' }]}>
                {profile ? 'Re-run Onboarding Setup Wizard' : 'Start Onboarding Setup'}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                6-step guided personalization questionnaire
              </Text>
            </View>
            <ChevronRight size={18} color={colors.primary} />
          </View>
        </Pressable>

        {/* APP PREFERENCES */}
        <SectionHeader title="Preferences" style={{ marginBottom: spacing.xs }} />

        <Card
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              marginBottom: spacing.xs,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.inlineRow}>
            <Moon size={20} color={colors.textPrimary} />
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Dark Mode</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {isDark ? 'Dark theme active' : 'Light theme active'}
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </Card>

        <Card
          style={[
            styles.menuItem,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderSubtle,
              marginBottom: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.inlineRow}>
            <ShieldCheck size={20} color={colors.textPrimary} />
            <View style={{ marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Data Privacy
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Protected biometrics & local logs
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </Card>
      </ScrollView>

      {/* ================= MODAL: EDIT BIOMETRICS ================= */}
      <Modal visible={editBiometricsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                Edit Body Measurements
              </Text>
              <Pressable onPress={() => setEditBiometricsModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              label="Height (cm)"
              keyboardType="numeric"
              value={draftHeightCm}
              onChangeText={setDraftHeightCm}
              containerStyle={{ marginBottom: spacing.md }}
              testID="modal-height-input"
            />

            <TextInput
              label="Current Weight (kg)"
              keyboardType="numeric"
              value={draftWeightKg}
              onChangeText={setDraftWeightKg}
              helperText="Changes are automatically recorded in your weight tracking history."
              containerStyle={{ marginBottom: spacing.lg }}
              testID="modal-weight-input"
            />

            <Button
              title="Save Measurements"
              onPress={handleSaveBiometrics}
              testID="btn-save-biometrics"
            />
          </Card>
        </View>
      </Modal>

      {/* ================= MODAL: EDIT GOALS & ACTIVITY ================= */}
      <Modal visible={editGoalModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                Update Primary Goal
              </Text>
              <Pressable onPress={() => setEditGoalModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {[
              { id: PrimaryGoal.LOSE_WEIGHT, label: 'Lose Weight' },
              { id: PrimaryGoal.MAINTAIN_WEIGHT, label: 'Maintain Weight' },
              { id: PrimaryGoal.BUILD_MUSCLE, label: 'Build Muscle' },
            ].map(g => (
              <Pressable
                key={g.id}
                onPress={() => setDraftPrimaryGoal(g.id)}
                style={[
                  styles.choiceItem,
                  {
                    borderColor: draftPrimaryGoal === g.id ? colors.primary : colors.border,
                    backgroundColor:
                      draftPrimaryGoal === g.id ? colors.surfaceMuted : colors.surface,
                    borderRadius: radii.sm,
                    marginBottom: spacing.xs,
                    padding: spacing.sm,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.bodyMedium,
                    { color: draftPrimaryGoal === g.id ? colors.primary : colors.textPrimary },
                  ]}
                >
                  {g.label}
                </Text>
              </Pressable>
            ))}

            <TextInput
              label="Target Weight (kg)"
              keyboardType="numeric"
              value={draftTargetWeightKg}
              onChangeText={setDraftTargetWeightKg}
              containerStyle={{ marginTop: spacing.md, marginBottom: spacing.sm }}
            />

            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: spacing.xs },
              ]}
            >
              Weekly Pace (kg/week)
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg }}>
              {[0.25, 0.5, 0.75, 1.0].map(p => (
                <Pressable
                  key={p}
                  onPress={() => setDraftPace(p)}
                  style={[
                    styles.choiceItem,
                    {
                      flex: 1,
                      alignItems: 'center',
                      borderColor: draftPace === p ? colors.primary : colors.border,
                      backgroundColor: draftPace === p ? colors.surfaceMuted : colors.surface,
                      borderRadius: radii.xs,
                      paddingVertical: spacing.xs,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: draftPace === p ? colors.primary : colors.textSecondary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {p} kg
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button title="Save Goal Settings" onPress={handleSaveGoalSettings} />
          </Card>
        </View>
      </Modal>

      {/* ================= MODAL: CUSTOMIZE TARGETS ================= */}
      <Modal visible={customizeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                Customize Nutrition Targets
              </Text>
              <Pressable onPress={() => setCustomizeModal(false)}>
                <X size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              label="Daily Calories (kcal)"
              keyboardType="numeric"
              value={draftCalories}
              onChangeText={setDraftCalories}
              containerStyle={{ marginBottom: spacing.sm }}
              testID="modal-calories-input"
            />

            <View style={styles.macroInputsRow}>
              <TextInput
                label="Protein (g)"
                keyboardType="numeric"
                value={draftProtein}
                onChangeText={setDraftProtein}
                containerStyle={{ flex: 1, marginRight: spacing.xs }}
              />
              <TextInput
                label="Carbs (g)"
                keyboardType="numeric"
                value={draftCarbs}
                onChangeText={setDraftCarbs}
                containerStyle={{ flex: 1, marginRight: spacing.xs }}
              />
              <TextInput
                label="Fat (g)"
                keyboardType="numeric"
                value={draftFat}
                onChangeText={setDraftFat}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <TextInput
              label="Fiber (g)"
              keyboardType="numeric"
              value={draftFiber}
              onChangeText={setDraftFiber}
              containerStyle={{ marginTop: spacing.xs, marginBottom: spacing.lg }}
            />

            <Button
              title="Save Target Customization"
              onPress={handleSaveCustomTargets}
              testID="btn-save-custom-targets"
            />
          </Card>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingVertical: 2,
  },
  goalCard: {
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caloriesRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  macroSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  macroPill: {
    alignItems: 'center',
    flex: 1,
  },
  menuItem: {
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    padding: 20,
    borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  choiceItem: {
    borderWidth: 1,
  },
  macroInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
