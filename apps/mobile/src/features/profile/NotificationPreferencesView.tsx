import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card, SectionHeader, Button, TextInput } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Bell, Droplets, Utensils, Moon, Sparkles, CheckCircle, X } from 'lucide-react-native';
import { NotificationApiClient, defaultNotificationApi } from '../../services/notificationApi';
import { NotificationCategory } from '@calmeter/shared';

export interface NotificationPreferencesViewProps {
  notificationClient?: NotificationApiClient;
  onClose?: () => void;
}

export const NotificationPreferencesView: React.FC<NotificationPreferencesViewProps> = ({
  notificationClient = defaultNotificationApi,
  onClose,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Preference State
  const [enabled, setEnabled] = useState(true);
  const [mealReminders, setMealReminders] = useState(true);
  const [breakfastReminder, setBreakfastReminder] = useState(true);
  const [lunchReminder, setLunchReminder] = useState(true);
  const [dinnerReminder, setDinnerReminder] = useState(true);
  const [waterReminders, setWaterReminders] = useState(true);
  const [dailySummary, setDailySummary] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [weightReminders, setWeightReminders] = useState(true);
  const [coachInsights, setCoachInsights] = useState(true);

  // Reminder Times
  const [breakfastTime, setBreakfastTime] = useState('08:30');
  const [lunchTime, setLunchTime] = useState('13:00');
  const [dinnerTime, setDinnerTime] = useState('20:00');
  const [dailySummaryTime, setDailySummaryTime] = useState('21:30');
  const [weightReminderTime, setWeightReminderTime] = useState('08:00');
  const [waterIntervalHours, setWaterIntervalHours] = useState('2');

  // Quiet Hours
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('07:00');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  useEffect(() => {
    let mounted = true;
    async function loadPreferences() {
      try {
        const pref = await notificationClient.getPreferences();
        if (mounted && pref) {
          setEnabled(pref.enabled);
          setMealReminders(pref.mealReminders);
          setBreakfastReminder(pref.breakfastReminder);
          setLunchReminder(pref.lunchReminder);
          setDinnerReminder(pref.dinnerReminder);
          setWaterReminders(pref.waterReminders);
          setDailySummary(pref.dailySummary);
          setWeeklySummary(pref.weeklySummary);
          setWeightReminders(pref.weightReminders);
          setCoachInsights(pref.coachInsights);

          setBreakfastTime(pref.breakfastTime || '08:30');
          setLunchTime(pref.lunchTime || '13:00');
          setDinnerTime(pref.dinnerTime || '20:00');
          setDailySummaryTime(pref.dailySummaryTime || '21:30');
          setWeightReminderTime(pref.weightReminderTime || '08:00');
          setWaterIntervalHours(String(pref.waterIntervalHours || 2));

          setQuietHoursStart(pref.quietHoursStart || '22:00');
          setQuietHoursEnd(pref.quietHoursEnd || '07:00');
          setTimezone(pref.timezone || 'Asia/Kolkata');
        }
      } catch (err) {
        console.warn('Failed to load notification preferences:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPreferences();
    return () => {
      mounted = false;
    };
  }, [notificationClient]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      await notificationClient.updatePreferences({
        enabled,
        mealReminders,
        breakfastReminder,
        lunchReminder,
        dinnerReminder,
        waterReminders,
        dailySummary,
        weeklySummary,
        weightReminders,
        coachInsights,
        breakfastTime,
        lunchTime,
        dinnerTime,
        dailySummaryTime,
        weightReminderTime,
        waterIntervalHours: Number.parseInt(waterIntervalHours, 10) || 2,
        quietHoursStart,
        quietHoursEnd,
        timezone,
      });
      setSuccessMessage('Notification preferences saved.');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update preferences';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    setTesting(true);
    try {
      await notificationClient.sendTestNotification({
        category: NotificationCategory.MEAL_REMINDER_BREAKFAST,
        title: 'CAL METER Test Alert',
        body: 'Push reminders are working perfectly on this device.',
      });
      Alert.alert('Notification Dispatched', 'A test reminder has been sent to your device.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send test notification';
      Alert.alert('Dispatch Error', msg);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Bell size={22} color={colors.textPrimary} />
          <Text
            style={[typography.titleMedium, { color: colors.textPrimary, marginLeft: spacing.sm }]}
          >
            Push Reminders & Alerts
          </Text>
        </View>
        {onClose && (
          <Pressable
            testID="close-notifications-btn"
            accessibilityLabel="Close notification settings"
            onPress={onClose}
            hitSlop={12}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {successMessage && (
        <View
          style={[
            styles.successBanner,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.md,
            },
          ]}
        >
          <CheckCircle size={16} color={colors.textPrimary} />
          <Text
            style={[typography.bodyMedium, { color: colors.textPrimary, marginLeft: spacing.xs }]}
          >
            {successMessage}
          </Text>
        </View>
      )}

      {/* Master Toggle */}
      <Card style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabelContainer}>
            <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
              Enable Notifications
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Receive helpful meal, hydration, and goal check-ins
            </Text>
          </View>
          <Switch
            testID="master-notification-switch"
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.border, true: colors.textPrimary }}
            thumbColor={colors.background}
          />
        </View>
      </Card>

      {/* Meal Reminders */}
      <SectionHeader title="Meal Logging Reminders" style={{ marginTop: spacing.md }} />
      <Card style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabelContainer}>
            <View style={styles.rowInline}>
              <Utensils size={16} color={colors.textPrimary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Meal Reminders
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Timed reminders to record your meals
            </Text>
          </View>
          <Switch
            testID="meal-reminders-switch"
            value={mealReminders}
            disabled={!enabled}
            onValueChange={setMealReminders}
            trackColor={{ false: colors.border, true: colors.textPrimary }}
            thumbColor={colors.background}
          />
        </View>

        {mealReminders && enabled && (
          <View style={[styles.subOptions, { borderTopColor: colors.border }]}>
            <View style={styles.timeRow}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Breakfast Time
              </Text>
              <TextInput
                testID="breakfast-time-input"
                value={breakfastTime}
                onChangeText={setBreakfastTime}
                placeholder="08:30"
                containerStyle={styles.timeInputContainer}
                inputStyle={styles.timeInputText}
              />
            </View>

            <View style={styles.timeRow}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Lunch Time</Text>
              <TextInput
                testID="lunch-time-input"
                value={lunchTime}
                onChangeText={setLunchTime}
                placeholder="13:00"
                containerStyle={styles.timeInputContainer}
                inputStyle={styles.timeInputText}
              />
            </View>

            <View style={styles.timeRow}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                Dinner Time
              </Text>
              <TextInput
                testID="dinner-time-input"
                value={dinnerTime}
                onChangeText={setDinnerTime}
                placeholder="20:00"
                containerStyle={styles.timeInputContainer}
                inputStyle={styles.timeInputText}
              />
            </View>
          </View>
        )}
      </Card>

      {/* Water & Habits */}
      <SectionHeader title="Hydration & Habits" style={{ marginTop: spacing.md }} />
      <Card style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabelContainer}>
            <View style={styles.rowInline}>
              <Droplets size={16} color={colors.textPrimary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                Water Intake Alerts
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Periodic reminder every {waterIntervalHours} hours
            </Text>
          </View>
          <Switch
            testID="water-reminders-switch"
            value={waterReminders}
            disabled={!enabled}
            onValueChange={setWaterReminders}
            trackColor={{ false: colors.border, true: colors.textPrimary }}
            thumbColor={colors.background}
          />
        </View>

        <View
          style={[
            styles.switchRow,
            { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
          ]}
        >
          <View style={styles.switchLabelContainer}>
            <View style={styles.rowInline}>
              <Sparkles size={16} color={colors.textPrimary} />
              <Text
                style={[
                  typography.titleSmall,
                  { color: colors.textPrimary, marginLeft: spacing.xs },
                ]}
              >
                AI Coach Insights
              </Text>
            </View>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              Actionable feedback when pacing deviations occur
            </Text>
          </View>
          <Switch
            testID="coach-insights-switch"
            value={coachInsights}
            disabled={!enabled}
            onValueChange={setCoachInsights}
            trackColor={{ false: colors.border, true: colors.textPrimary }}
            thumbColor={colors.background}
          />
        </View>
      </Card>

      {/* Quiet Hours */}
      <SectionHeader title="Do Not Disturb (Quiet Hours)" style={{ marginTop: spacing.md }} />
      <Card style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.rowInline}>
          <Moon size={16} color={colors.textPrimary} />
          <Text
            style={[typography.titleSmall, { color: colors.textPrimary, marginLeft: spacing.xs }]}
          >
            Quiet Window
          </Text>
        </View>
        <Text
          style={[
            typography.caption,
            { color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
          ]}
        >
          Notifications are suppressed during these hours to protect your rest
        </Text>

        <View style={styles.timeRow}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Sleep Start</Text>
          <TextInput
            testID="quiet-start-input"
            value={quietHoursStart}
            onChangeText={setQuietHoursStart}
            placeholder="22:00"
            containerStyle={styles.timeInputContainer}
            inputStyle={styles.timeInputText}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Wake End</Text>
          <TextInput
            testID="quiet-end-input"
            value={quietHoursEnd}
            onChangeText={setQuietHoursEnd}
            placeholder="07:00"
            containerStyle={styles.timeInputContainer}
            inputStyle={styles.timeInputText}
          />
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={[styles.actionsContainer, { marginTop: spacing.lg }]}>
        <Button
          testID="save-preferences-btn"
          title={saving ? 'Saving...' : 'Save Preferences'}
          onPress={handleSave}
          disabled={saving}
        />

        <Button
          testID="send-test-notif-btn"
          title={testing ? 'Dispatching...' : 'Send Test Notification'}
          variant="outline"
          onPress={handleSendTestNotification}
          disabled={testing || !enabled}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabelContainer: {
    flex: 1,
    paddingRight: 12,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subOptions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  timeInputContainer: {
    width: 90,
  },
  timeInputText: {
    textAlign: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  actionsContainer: {
    marginBottom: 20,
  },
});
