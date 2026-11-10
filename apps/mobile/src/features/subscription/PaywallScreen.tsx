import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Button } from '../../components';
import { X, Sparkles, Camera, Barcode, Bot, PieChart, Calendar, Layers } from 'lucide-react-native';
import {
  defaultRevenueCatService,
  type IRevenueCatService,
} from '../../services/revenueCatService';
import { SubscriptionApiClient } from '../../services/subscriptionApi';
import type { PurchasesPackage } from 'react-native-purchases';

export interface PaywallScreenProps {
  onClose?: () => void;
  onSuccess?: () => void;
  revenueCatService?: IRevenueCatService;
  subscriptionClient?: SubscriptionApiClient;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({
  onClose,
  onSuccess,
  revenueCatService = defaultRevenueCatService,
  subscriptionClient = new SubscriptionApiClient(),
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');

  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    async function loadOfferings() {
      try {
        const result = await revenueCatService.getOfferings();
        if (result?.current) {
          if (result.current.annual) {
            setAnnualPackage(result.current.annual);
          }
          if (result.current.monthly) {
            setMonthlyPackage(result.current.monthly);
          }
        }
      } catch (err) {
        console.warn('[PaywallScreen] Error loading offerings:', err);
      }
    }
    loadOfferings();
  }, [revenueCatService]);

  const annualPrice = annualPackage?.product?.priceString || '$79.99 / yr';
  const monthlyPrice = monthlyPackage?.product?.priceString || '$9.99 / mo';

  const handlePurchase = async () => {
    const pkgToPurchase = selectedPlan === 'annual' ? annualPackage : monthlyPackage;

    setPurchasing(true);
    try {
      if (pkgToPurchase) {
        const { success } = await revenueCatService.purchasePackage(pkgToPurchase);
        if (!success) {
          // User cancelled
          setPurchasing(false);
          return;
        }
      }

      // Sync backend state
      await subscriptionClient.syncSubscription();

      Alert.alert(
        'Subscription Activated',
        'Thank you for subscribing to Cal Meter Premium. Your premium features are now unlocked.',
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.();
              onClose?.();
            },
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Purchase Failed',
        error?.message || 'Unable to complete purchase. Please try again.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { success } = await revenueCatService.restorePurchases();
      if (success) {
        await subscriptionClient.syncSubscription();
        Alert.alert('Purchases Restored', 'Your subscription has been successfully restored.', [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.();
              onClose?.();
            },
          },
        ]);
      } else {
        Alert.alert(
          'No Subscription Found',
          'We could not find an active subscription to restore.',
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Restore Failed',
        error?.message || 'Unable to restore purchases. Please try again.',
      );
    } finally {
      setRestoring(false);
    }
  };

  const FEATURES = [
    {
      title: 'AI Photo Scans',
      free: '3 / day',
      premium: '50 / day',
      icon: Camera,
    },
    {
      title: 'Barcode Scanning',
      free: '10 / day',
      premium: 'Unlimited',
      icon: Barcode,
    },
    {
      title: 'Nutrition Label OCR',
      free: '2 / day',
      premium: 'Unlimited',
      icon: Layers,
    },
    {
      title: 'AI Nutrition Coach Chat',
      free: '5 / day',
      premium: 'Unlimited',
      icon: Bot,
    },
    {
      title: 'Meal Recommendations',
      free: '2 / day',
      premium: 'Unlimited',
      icon: Sparkles,
    },
    {
      title: 'Diary History Range',
      free: '30 Days',
      premium: 'All Time',
      icon: Calendar,
    },
    {
      title: 'Advanced Analytics',
      free: 'Basic',
      premium: 'Full Suite',
      icon: PieChart,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.contentContainer, { padding: spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header bar */}
      <View style={styles.headerBar}>
        {onClose && (
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close paywall"
            style={styles.closeButton}
          >
            <X size={24} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {/* Title & Headline */}
      <View style={[styles.heroSection, { marginBottom: spacing.xl }]}>
        <Text style={[typography.caption, { color: colors.textSecondary, letterSpacing: 1.5 }]}>
          CAL METER PREMIUM
        </Text>
        <Text
          style={[
            typography.titleLarge,
            styles.heroTitle,
            { color: colors.textPrimary, marginTop: spacing.xs },
          ]}
        >
          Precision Nutrition Without Limits
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            styles.heroSubtitle,
            { color: colors.textSecondary, marginTop: spacing.sm },
          ]}
        >
          Elevate your tracking with high-volume scanning, continuous AI coaching, and deep
          metabolic trends.
        </Text>
      </View>

      {/* Plan Selector */}
      <View style={[styles.planSection, { marginBottom: spacing.xl }]}>
        {/* Annual Option */}
        <Pressable
          onPress={() => setSelectedPlan('annual')}
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surface,
              borderColor: selectedPlan === 'annual' ? colors.textPrimary : colors.border,
              borderWidth: selectedPlan === 'annual' ? 2 : 1,
              borderRadius: radii.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
            },
          ]}
        >
          <View style={styles.planHeader}>
            <View style={styles.planRadioRow}>
              <View
                style={[
                  styles.radioOuter,
                  {
                    borderColor: selectedPlan === 'annual' ? colors.textPrimary : colors.border,
                  },
                ]}
              >
                {selectedPlan === 'annual' && (
                  <View style={[styles.radioInner, { backgroundColor: colors.textPrimary }]} />
                )}
              </View>
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                  Annual Plan
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Billed annually at {annualPrice}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.border,
                  borderRadius: radii.sm,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700' }]}>
                SAVE 33%
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Monthly Option */}
        <Pressable
          onPress={() => setSelectedPlan('monthly')}
          style={[
            styles.planCard,
            {
              backgroundColor: colors.surface,
              borderColor: selectedPlan === 'monthly' ? colors.textPrimary : colors.border,
              borderWidth: selectedPlan === 'monthly' ? 2 : 1,
              borderRadius: radii.md,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.planRadioRow}>
            <View
              style={[
                styles.radioOuter,
                {
                  borderColor: selectedPlan === 'monthly' ? colors.textPrimary : colors.border,
                },
              ]}
            >
              {selectedPlan === 'monthly' && (
                <View style={[styles.radioInner, { backgroundColor: colors.textPrimary }]} />
              )}
            </View>
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                Monthly Plan
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {monthlyPrice} / month, cancel anytime
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Feature Comparison Table */}
      <View
        style={[
          styles.comparisonCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            marginBottom: spacing.xl,
          },
        ]}
      >
        <Text
          style={[typography.titleSmall, { color: colors.textPrimary, marginBottom: spacing.md }]}
        >
          Feature Comparison
        </Text>

        {/* Header row */}
        <View
          style={[styles.tableRow, styles.tableHeaderRow, { borderBottomColor: colors.border }]}
        >
          <Text style={[typography.caption, styles.featureCol, { color: colors.textSecondary }]}>
            FEATURE
          </Text>
          <Text
            style={[
              typography.caption,
              styles.valCol,
              { color: colors.textSecondary, textAlign: 'center' },
            ]}
          >
            FREE
          </Text>
          <Text
            style={[
              typography.caption,
              styles.valCol,
              { color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
            ]}
          >
            PREMIUM
          </Text>
        </View>

        {/* Features */}
        {FEATURES.map((item, idx) => (
          <View
            key={item.title}
            style={[
              styles.tableRow,
              {
                borderBottomColor: idx < FEATURES.length - 1 ? colors.border : 'transparent',
                paddingVertical: spacing.sm,
              },
            ]}
          >
            <View style={styles.featureNameWrapper}>
              <item.icon size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={[typography.bodyMedium, { color: colors.textPrimary, fontSize: 13 }]}>
                {item.title}
              </Text>
            </View>
            <Text
              style={[
                typography.caption,
                styles.valCol,
                { color: colors.textSecondary, textAlign: 'center' },
              ]}
            >
              {item.free}
            </Text>
            <Text
              style={[
                typography.caption,
                styles.valCol,
                { color: colors.textPrimary, fontWeight: '700', textAlign: 'center' },
              ]}
            >
              {item.premium}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA Buttons */}
      <View style={[styles.actionSection, { marginBottom: spacing.lg }]}>
        <Button
          title={
            purchasing
              ? 'Processing...'
              : `Subscribe — ${selectedPlan === 'annual' ? annualPrice : monthlyPrice}`
          }
          onPress={handlePurchase}
          disabled={purchasing || restoring}
          variant="primary"
        />

        <View style={{ marginTop: spacing.sm }}>
          <Button
            title={restoring ? 'Restoring...' : 'Restore Purchases'}
            onPress={handleRestore}
            disabled={purchasing || restoring}
            variant="ghost"
          />
        </View>
      </View>

      {/* Disclosures & Legal */}
      <View style={styles.disclaimerSection}>
        <Text style={[typography.caption, styles.disclaimerText, { color: colors.textTertiary }]}>
          Payment will be charged to your Apple App Store or Google Play account upon confirmation
          of purchase. Subscriptions automatically renew unless auto-renew is turned off at least 24
          hours before the end of the current billing cycle. You may manage or cancel your
          subscription anytime in your device account settings.
        </Text>
      </View>
    </ScrollView>
  );
};

export interface PaywallModalProps extends PaywallScreenProps {
  visible: boolean;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose, ...rest }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <PaywallScreen onClose={onClose} {...rest} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
  },
  heroTitle: {
    textAlign: 'center',
    fontWeight: '800',
  },
  heroSubtitle: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  planSection: {},
  planCard: {
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  comparisonCard: {
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  tableHeaderRow: {
    paddingBottom: 8,
  },
  featureCol: {
    flex: 2,
  },
  featureNameWrapper: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  valCol: {
    flex: 1,
  },
  actionSection: {},
  disclaimerSection: {
    paddingHorizontal: 8,
  },
  disclaimerText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
});
