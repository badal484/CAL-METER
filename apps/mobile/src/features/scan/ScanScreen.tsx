import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer, Card, SectionHeader, Button } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Camera, Barcode, FileText, Info } from 'lucide-react-native';

export const ScanScreen: React.FC = () => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const scanModes = [
    {
      id: 'photo',
      title: 'Food Photo AI',
      description:
        'Snap your plate to automatically recognize food items, estimate portions, and match calories.',
      icon: <Camera size={24} color={colors.textPrimary} />,
      badge: 'Multimodal Vision',
    },
    {
      id: 'barcode',
      title: 'Barcode Scanner',
      description:
        'Scan packaged goods to retrieve certified nutritional facts via Open Food Facts & USDA.',
      icon: <Barcode size={24} color={colors.textPrimary} />,
      badge: 'UPC / EAN',
    },
    {
      id: 'label',
      title: 'Nutrition Label OCR',
      description:
        'Extract exact nutrition panels from packaging using on-device optical character recognition.',
      icon: <FileText size={24} color={colors.textPrimary} />,
      badge: 'Nutrition Facts',
    },
  ];

  return (
    <ScreenContainer>
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.titleLarge, { color: colors.textPrimary }]}>Food Scanner</Text>
        <Text
          style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}
        >
          AI-powered visual recognition and barcode catalog lookup.
        </Text>
      </View>

      {/* Scope Disclaimer Banner */}
      <View
        style={[
          styles.disclaimerBanner,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.xl,
          },
        ]}
      >
        <Info size={20} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={[typography.labelMedium, { color: colors.textPrimary }]}>
            Milestone Notice
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}
          >
            Scanning hardware and AI vision pipeline are scheduled for Milestone 4 & 7. Camera
            permissions are not requested in this foundation build.
          </Text>
        </View>
      </View>

      {/* Scanner Modes */}
      <SectionHeader title="Select Capture Method" />

      {scanModes.map(mode => (
        <Card
          key={mode.id}
          style={{ marginBottom: spacing.md }}
          onPress={() => {}}
          accessibilityLabel={`${mode.title}: ${mode.description}`}
        >
          <View style={styles.modeCard}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: radii.md,
                  marginRight: spacing.md,
                },
              ]}
            >
              {mode.icon}
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.modeTitleRow}>
                <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                  {mode.title}
                </Text>
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.borderSubtle,
                      borderRadius: radii.xs,
                      paddingHorizontal: spacing.xs,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 10 }]}>
                    {mode.badge}
                  </Text>
                </View>
              </View>

              <Text
                style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}
              >
                {mode.description}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      {/* Manual Fallback */}
      <View style={{ marginTop: spacing.lg }}>
        <Button title="Manual Text Search" onPress={() => {}} variant="outline" />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagBadge: {
    borderWidth: 1,
  },
});
