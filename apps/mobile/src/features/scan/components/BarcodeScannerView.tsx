import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Camera, TorchMode } from 'react-native-camera-kit';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { Button } from '../../../components';
import { X, Zap, ZapOff, Barcode, AlertCircle } from 'lucide-react-native';

export interface BarcodeScannerViewProps {
  onScan: (barcode: string) => void;
  onOpenManual: () => void;
  onClose: () => void;
  isProcessing: boolean;
  error?: string | null;
  onClearError?: () => void;
}

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({
  onScan,
  onOpenManual,
  onClose,
  isProcessing,
  error,
  onClearError,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [torchMode, setTorchMode] = useState<TorchMode>('off');
  const lastScannedRef = useRef<{ code: string; timestamp: number } | null>(null);

  const toggleTorch = () => {
    setTorchMode(prev => (prev === 'on' ? 'off' : 'on'));
  };

  const handleBarcodeRead = useCallback(
    (event: { nativeEvent: { codeStringValue: string } }) => {
      if (isProcessing) return;

      const code = event?.nativeEvent?.codeStringValue?.trim();
      if (!code) return;

      const now = Date.now();
      // Debounce duplicate scans of same code within 2 seconds
      if (
        lastScannedRef.current &&
        lastScannedRef.current.code === code &&
        now - lastScannedRef.current.timestamp < 2000
      ) {
        return;
      }

      lastScannedRef.current = { code, timestamp: now };
      onScan(code);
    },
    [isProcessing, onScan],
  );

  return (
    <View style={styles.container}>
      {/* Active Camera */}
      <Camera
        style={StyleSheet.absoluteFill}
        scanBarcode={!isProcessing}
        onReadCode={handleBarcodeRead}
        torchMode={torchMode}
        scanThrottleDelay={1000}
      />

      {/* Viewfinder Overlay */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        {/* Top Mask with Controls */}
        <View style={styles.topMask}>
          <View style={styles.topBar}>
            <Pressable
              style={styles.iconButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close barcode scanner"
            >
              <X size={24} color="#FFFFFF" />
            </Pressable>

            <Text style={[typography.labelMedium, { color: '#FFFFFF' }]}>Scan Barcode</Text>

            <Pressable
              style={styles.iconButton}
              onPress={toggleTorch}
              accessibilityRole="button"
              accessibilityLabel={torchMode === 'on' ? 'Turn flashlight off' : 'Turn flashlight on'}
            >
              {torchMode === 'on' ? (
                <ZapOff size={24} color="#FFFFFF" />
              ) : (
                <Zap size={24} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Center Row: Left Mask, Reticle Cutout, Right Mask */}
        <View style={styles.centerRow}>
          <View style={styles.sideMask} />

          {/* Monochrome Targeting Reticle */}
          <View style={styles.reticleBox}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Red / White scan line guide */}
            <View style={styles.laserLine} />
          </View>

          <View style={styles.sideMask} />
        </View>

        {/* Bottom Mask with Instructions & Fallback Action */}
        <View style={styles.bottomMask}>
          <Text style={[typography.bodyMedium, styles.instructionText]}>
            Align barcode inside frame
          </Text>
          <Text style={[typography.caption, styles.subInstructionText]}>
            Supports EAN-13, EAN-8, UPC-A, UPC-E & Code 128
          </Text>

          {/* Error Banner (if any) */}
          {error && (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: 'rgba(239, 68, 68, 0.9)',
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  marginHorizontal: spacing.lg,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <AlertCircle size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[typography.caption, { color: '#FFFFFF', flex: 1 }]}>{error}</Text>
              {onClearError && (
                <Pressable onPress={onClearError} hitSlop={8}>
                  <X size={14} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          )}

          {/* Manual Entry Button */}
          <View style={styles.manualButtonContainer}>
            <Button
              title="Enter Barcode Manually"
              variant="outline"
              leftIcon={<Barcode size={18} color="#FFFFFF" />}
              onPress={onOpenManual}
              accessibilityLabel="Open manual barcode entry dialog"
              style={styles.manualBtnStyle}
              textStyle={{ color: '#FFFFFF' }}
            />
          </View>
        </View>
      </View>

      {/* Loading Overlay */}
      {isProcessing && (
        <View style={styles.loadingBackdrop}>
          <View
            style={[
              styles.loadingBox,
              {
                backgroundColor: colors.surface,
                borderRadius: radii.md,
                borderColor: colors.border,
                padding: spacing.lg,
              },
            ]}
          >
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: spacing.md }]}
            >
              Looking up product...
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const { width } = Dimensions.get('window');
const RETICLE_WIDTH = Math.min(width * 0.78, 300);
const RETICLE_HEIGHT = 160;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-start',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    height: RETICLE_HEIGHT,
  },
  sideMask: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  reticleBox: {
    width: RETICLE_WIDTH,
    height: RETICLE_HEIGHT,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  laserLine: {
    width: '90%',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  bottomMask: {
    flex: 1.3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 40,
  },
  instructionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  subInstructionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
  },
  manualButtonContainer: {
    width: '80%',
    maxWidth: 280,
  },
  manualBtnStyle: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  loadingBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minWidth: 200,
  },
});
