import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { Button, TextInput } from '../../../components';
import { X, Barcode, CheckCircle, AlertCircle } from 'lucide-react-native';
import { validateBarcode, normalizeBarcode } from '@calmeter/shared';

export interface ManualBarcodeModalProps {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (barcode: string) => void;
}

export const ManualBarcodeModal: React.FC<ManualBarcodeModalProps> = ({
  visible,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [inputVal, setInputVal] = useState('');

  // Validate entered code dynamically
  const validation = useMemo(() => {
    const raw = inputVal.trim();
    if (!raw) {
      return { isValid: false, message: '', format: null, normalizedBarcode: '' };
    }
    const clean = normalizeBarcode(raw);
    const result = validateBarcode(clean);
    return {
      isValid: result.isValid,
      message: result.error || (result.isValid ? `Valid ${result.format}` : 'Invalid barcode'),
      format: result.format,
      normalizedBarcode: result.normalizedBarcode,
    };
  }, [inputVal]);

  const handleSubmit = () => {
    if (!validation.isValid || !validation.normalizedBarcode) {
      return;
    }
    onSubmit(validation.normalizedBarcode);
  };

  const handleClose = () => {
    setInputVal('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Barcode size={22} color={colors.textPrimary} style={{ marginRight: spacing.sm }} />
              <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                Enter Barcode Manually
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close manual barcode entry"
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text
            style={[
              typography.bodySmall,
              { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
            ]}
          >
            Enter the 8, 12, or 13-digit number located under or beside the product barcode.
          </Text>

          {/* Barcode Text Input */}
          <TextInput
            placeholder="e.g. 8901030825484 or 737628064502"
            value={inputVal}
            onChangeText={setInputVal}
            keyboardType="number-pad"
            autoFocus
            accessibilityLabel="Barcode numeric input"
          />

          {/* Format / Validation Status */}
          {inputVal.trim().length > 0 && (
            <View
              style={[
                styles.statusBox,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: validation.isValid ? colors.border : colors.borderSubtle,
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  marginTop: spacing.sm,
                },
              ]}
            >
              {validation.isValid ? (
                <CheckCircle
                  size={16}
                  color={colors.textPrimary}
                  style={{ marginRight: spacing.xs }}
                />
              ) : (
                <AlertCircle
                  size={16}
                  color={colors.textSecondary}
                  style={{ marginRight: spacing.xs }}
                />
              )}
              <Text
                style={[
                  typography.caption,
                  {
                    color: validation.isValid ? colors.textPrimary : colors.textSecondary,
                    fontWeight: validation.isValid ? '600' : '400',
                  },
                ]}
              >
                {validation.message}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={[styles.actionsRow, { marginTop: spacing.lg }]}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Button title="Cancel" variant="outline" onPress={handleClose} disabled={loading} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Button
                title={loading ? 'Searching...' : 'Search'}
                onPress={handleSubmit}
                disabled={!validation.isValid || loading}
                loading={loading}
                accessibilityLabel="Search product by barcode"
              />
            </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
