import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { ScreenContainer, Card, SectionHeader, Button } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import {
  User,
  Target,
  Scale,
  Moon,
  ShieldCheck,
  CreditCard,
  ChevronRight,
} from 'lucide-react-native';

export const ProfileScreen: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [useMetric, setUseMetric] = useState(true);

  const profileMenuItems = [
    {
      id: 'goals',
      title: 'Nutrition & Macro Goals',
      subtitle: '2,100 kcal • 150g P / 220g C / 65g F',
      icon: <Target size={20} color={colors.textPrimary} />,
    },
    {
      id: 'biometrics',
      title: 'Biometrics & Body Stats',
      subtitle: '178 cm • 81.4 kg (Goal: 75 kg)',
      icon: <Scale size={20} color={colors.textPrimary} />,
    },
    {
      id: 'subscription',
      title: 'CAL METER Pro',
      subtitle: 'Free Tier Preview (3 AI scans / day)',
      icon: <CreditCard size={20} color={colors.textPrimary} />,
    },
    {
      id: 'privacy',
      title: 'Privacy & Data Export',
      subtitle: 'GDPR / DPDP compliance',
      icon: <ShieldCheck size={20} color={colors.textPrimary} />,
    },
  ];

  return (
    <ScreenContainer>
      {/* Profile Header Avatar Card */}
      <Card style={[styles.profileHeader, { marginBottom: spacing.lg }]}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.surfaceMuted, borderRadius: radii.full },
          ]}
        >
          <User size={32} color={colors.textPrimary} />
        </View>

        <View style={{ flex: 1, marginLeft: spacing.lg }}>
          <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
            Guest Athlete [Preview]
          </Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            Local Monorepo Demo Profile
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
                { color: colors.textTertiary, fontSize: 10, fontWeight: '600' },
              ]}
            >
              CAL METER FREE PREVIEW
            </Text>
          </View>
        </View>
      </Card>

      {/* App Preferences */}
      <SectionHeader title="Preferences" />
      <Card style={{ padding: 0, marginBottom: spacing.lg }}>
        {/* Dark Mode Toggle */}
        <View
          style={[
            styles.preferenceRow,
            {
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomColor: colors.borderSubtle,
              borderBottomWidth: 1,
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Moon size={20} color={colors.textPrimary} style={{ marginRight: spacing.md }} />
            <View>
              <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>Dark Mode</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Monochrome high-contrast theme
              </Text>
            </View>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={isDark ? colors.background : colors.surface}
          />
        </View>

        {/* Units System Toggle */}
        <View
          style={[
            styles.preferenceRow,
            { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Scale size={20} color={colors.textPrimary} style={{ marginRight: spacing.md }} />
            <View>
              <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                Unit System
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {useMetric ? 'Metric (kg, cm, ml)' : 'Imperial (lbs, ft/in, fl oz)'}
              </Text>
            </View>
          </View>
          <Button
            title={useMetric ? 'Metric' : 'Imperial'}
            onPress={() => setUseMetric(prev => !prev)}
            variant="outline"
            size="sm"
            style={{ minHeight: 32, paddingHorizontal: spacing.md }}
          />
        </View>
      </Card>

      {/* Settings Navigation Items */}
      <SectionHeader title="Settings & Management" />
      <Card style={{ padding: 0, marginBottom: spacing.xl }}>
        {profileMenuItems.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.menuItem,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomColor: colors.borderSubtle,
                borderBottomWidth: index < profileMenuItems.length - 1 ? 1 : 0,
              },
            ]}
          >
            <View style={{ marginRight: spacing.md }}>{item.icon}</View>

            <View style={{ flex: 1 }}>
              <Text style={[typography.labelLarge, { color: colors.textPrimary }]}>
                {item.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                {item.subtitle}
              </Text>
            </View>

            <ChevronRight size={18} color={colors.textTertiary} />
          </View>
        ))}
      </Card>

      {/* Footer Info */}
      <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          CAL METER v1.0.0 (Build Foundation)
        </Text>
        <Text
          style={[typography.caption, { color: colors.textTertiary, fontSize: 10, marginTop: 2 }]}
        >
          Designed & Built with Pure React Native CLI
        </Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBadge: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
