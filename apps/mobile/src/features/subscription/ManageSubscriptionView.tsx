import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Card, Button } from '../../components';
import { Sparkles } from 'lucide-react-native';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PaywallModal } from './PaywallScreen';
import {
  defaultRevenueCatService,
  type IRevenueCatService,
} from '../../services/revenueCatService';

export interface ManageSubscriptionViewProps {
  revenueCatService?: IRevenueCatService;
}

export const ManageSubscriptionView: React.FC<ManageSubscriptionViewProps> = ({
  revenueCatService = defaultRevenueCatService,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;
  const { isPremium, status, refresh, isCanceled, cancelAtPeriodEnd, expiresAt } =
    useEntitlements();

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { success } = await revenueCatService.restorePurchases();
      if (success) {
        await refresh();
        Alert.alert('Purchases Restored', 'Your subscription state has been synced.');
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription.');
      }
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Unable to restore purchases.');
    } finally {
      setRestoring(false);
    }
  };

  const formattedExpiresAt = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Sparkles size={20} color={colors.textPrimary} style={{ marginRight: 8 }} />
          <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>Subscription</Text>
        </View>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: isPremium ? colors.textPrimary : colors.surfaceMuted,
              borderColor: colors.border,
              borderRadius: radii.sm,
            },
          ]}
        >
          <Text
            style={[
              typography.caption,
              {
                color: isPremium ? colors.background : colors.textSecondary,
                fontWeight: '700',
              },
            ]}
          >
            {isPremium ? 'PREMIUM' : 'FREE PLAN'}
          </Text>
        </View>
      </View>

      {isPremium ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
            {status?.productId?.includes('annual') ? 'Annual Premium Plan' : 'Monthly Premium Plan'}
          </Text>

          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
            {isCanceled || cancelAtPeriodEnd
              ? `Cancelled • Access remains active until ${formattedExpiresAt}`
              : `Auto-renews ${formattedExpiresAt ? `on ${formattedExpiresAt}` : 'periodically'}`}
          </Text>

          <View style={[styles.premiumActions, { marginTop: spacing.md }]}>
            <Button
              title={restoring ? 'Syncing...' : 'Sync Purchases'}
              onPress={handleRestore}
              disabled={restoring}
              variant="outline"
            />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={[typography.bodyMedium, { color: colors.textSecondary }]}>
            You are on the Free plan (3 AI scans/day, 10 barcode lookups/day, 30-day history).
          </Text>

          <View style={[styles.freeActions, { marginTop: spacing.md, gap: spacing.sm }]}>
            <Button
              title="Upgrade to Cal Meter Premium"
              onPress={() => setPaywallVisible(true)}
              variant="primary"
            />
            <Button
              title={restoring ? 'Restoring...' : 'Restore Purchases'}
              onPress={handleRestore}
              disabled={restoring}
              variant="ghost"
            />
          </View>
        </View>
      )}

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onSuccess={() => {
          setPaywallVisible(false);
          refresh();
        }}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  premiumActions: {
    width: '100%',
  },
  freeActions: {
    width: '100%',
  },
});
