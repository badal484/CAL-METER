import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Button } from '../../components';
import { ShieldAlert, X } from 'lucide-react-native';
import { FeatureKey } from '@calmeter/shared';

export interface FeatureLimitModalProps {
  visible: boolean;
  feature?: FeatureKey | string;
  onClose: () => void;
  onUpgrade: () => void;
}

const FEATURE_NAMES: Record<string, string> = {
  [FeatureKey.AI_PHOTO_SCAN]: 'AI Food Photo Scans',
  [FeatureKey.BARCODE_SCAN]: 'Barcode Scans',
  [FeatureKey.NUTRITION_LABEL_SCAN]: 'Nutrition Label Scans',
  [FeatureKey.COACH_CHAT]: 'AI Nutrition Coach Messages',
  [FeatureKey.MEAL_RECOMMENDATIONS]: 'Meal Recommendations',
  [FeatureKey.ADVANCED_ANALYTICS]: 'Advanced Analytics',
  [FeatureKey.HISTORY_RANGE]: 'Extended History Range',
};

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  [FeatureKey.AI_PHOTO_SCAN]:
    'You have reached your daily limit of 3 free AI food photo scans. Quotas reset tomorrow at midnight.',
  [FeatureKey.BARCODE_SCAN]:
    'You have reached your daily limit of 10 free barcode lookups. Quotas reset tomorrow at midnight.',
  [FeatureKey.NUTRITION_LABEL_SCAN]:
    'You have reached your daily limit of 2 free nutrition label scans. Quotas reset tomorrow at midnight.',
  [FeatureKey.COACH_CHAT]:
    'You have reached your daily limit of 5 free messages with the AI Nutrition Coach. Quotas reset tomorrow at midnight.',
  [FeatureKey.MEAL_RECOMMENDATIONS]:
    'You have reached your daily limit of 2 free meal suggestions.',
  [FeatureKey.ADVANCED_ANALYTICS]:
    'In-depth nutrient trends and micronutrient breakdowns are available exclusively on Cal Meter Premium.',
  [FeatureKey.HISTORY_RANGE]:
    'Historical logs beyond 30 days require a Cal Meter Premium subscription.',
};

export const FeatureLimitModal: React.FC<FeatureLimitModalProps> = ({
  visible,
  feature = FeatureKey.AI_PHOTO_SCAN,
  onClose,
  onUpgrade,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const featureTitle = FEATURE_NAMES[feature] || 'Feature Quota Reached';
  const featureDesc =
    FEATURE_DESCRIPTIONS[feature] ||
    'You have reached the free limit for this feature. Upgrade to Cal Meter Premium for unlimited access.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radii.lg,
              padding: spacing.lg,
            },
          ]}
        >
          {/* Close icon */}
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close limit modal"
            style={styles.closeButton}
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>

          {/* Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
              },
            ]}
          >
            <ShieldAlert size={28} color={colors.textPrimary} />
          </View>

          {/* Title & Description */}
          <Text
            style={[
              typography.titleMedium,
              styles.title,
              { color: colors.textPrimary, marginTop: spacing.md },
            ]}
          >
            {featureTitle}
          </Text>

          <Text
            style={[
              typography.bodyMedium,
              styles.description,
              { color: colors.textSecondary, marginTop: spacing.sm },
            ]}
          >
            {featureDesc}
          </Text>

          {/* Actions */}
          <View style={[styles.actionContainer, { marginTop: spacing.lg, gap: spacing.sm }]}>
            <Button
              title="Upgrade to Premium"
              onPress={() => {
                onClose();
                onUpgrade();
              }}
              variant="primary"
            />
            <Button title="Maybe Later" onPress={onClose} variant="outline" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
  },
  actionContainer: {
    width: '100%',
  },
});
