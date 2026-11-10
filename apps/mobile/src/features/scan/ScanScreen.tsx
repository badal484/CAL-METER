import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ScreenContainer, Card, SectionHeader, Button } from '../../components';
import { useTheme } from '../../app/providers/ThemeProvider';
import { Camera, Barcode, FileText, Info, CameraOff } from 'lucide-react-native';
import { defaultBarcodeApiClient, BarcodeApiClient } from '../../services/barcodeApi';
import { defaultDiaryApiClient, DiaryApiClient } from '../../services/diaryApi';
import { checkCameraPermission, requestCameraPermission } from './permissions';
import { BarcodeScannerView } from './components/BarcodeScannerView';
import { ManualBarcodeModal } from './components/ManualBarcodeModal';
import { ProductDetailSheet } from './components/ProductDetailSheet';
import type { PackagedProductDto } from '@calmeter/contracts';
import { formatDateToIso, MealType, LoggedMethod } from '@calmeter/shared';

export interface ScanScreenProps {
  barcodeApiClient?: BarcodeApiClient;
  diaryApiClient?: DiaryApiClient;
  initialMode?: 'menu' | 'barcode' | 'permission_denied';
}

export const ScanScreen: React.FC<ScanScreenProps> = ({
  barcodeApiClient = defaultBarcodeApiClient,
  diaryApiClient = defaultDiaryApiClient,
  initialMode = 'menu',
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  const [activeView, setActiveView] = useState<'menu' | 'barcode' | 'permission_denied'>(
    initialMode,
  );
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [productSheetVisible, setProductSheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PackagedProductDto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Activate Barcode Scanner mode with permission verification
  const handleLaunchBarcodeScanner = async () => {
    setErrorMessage(null);
    const hasPermission = await checkCameraPermission();
    if (hasPermission) {
      setActiveView('barcode');
      return;
    }

    const granted = await requestCameraPermission();
    if (granted) {
      setActiveView('barcode');
    } else {
      setActiveView('permission_denied');
    }
  };

  const handleModePress = (modeId: string, title: string) => {
    if (modeId === 'barcode') {
      handleLaunchBarcodeScanner();
    } else {
      Alert.alert(
        `${title} Preview`,
        `${title} camera capture and AI recognition pipeline are scheduled for Milestones 4 & 7. Camera permissions are not requested in this foundation build.`,
        [{ text: 'OK' }],
      );
    }
  };

  // Perform barcode lookup (from camera scan or manual modal)
  const performBarcodeLookup = async (barcode: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const product = await barcodeApiClient.lookupBarcode(barcode);
      setSelectedProduct(product);
      setManualModalVisible(false);
      setProductSheetVisible(true);
    } catch (err: any) {
      const message =
        err?.message ||
        `Product with barcode "${barcode}" was not found in catalog or Open Food Facts.`;
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add recognized packaged food item to user's daily diary
  const handleAddToDiary = async ({
    foodItemId,
    foodName,
    mealType,
    servingSizeGrams,
    portionAmount,
    servingUnit,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    loggedMethod,
  }: {
    foodItemId: string;
    foodName: string;
    mealType: MealType;
    servingSizeGrams: number;
    portionAmount: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    loggedMethod: LoggedMethod;
  }) => {
    const todayIso = formatDateToIso(new Date());
    await diaryApiClient.createDiaryEntry({
      date: todayIso,
      mealType,
      items: [
        {
          foodItemId,
          foodName,
          portionAmount,
          servingUnit,
          gramWeight: servingSizeGrams * portionAmount,
          calories,
          protein,
          carbs,
          fat,
          fiber,
          sugar,
          sodium,
          loggedMethod,
        },
      ],
    });
  };

  // 1. ACTIVE CAMERA SCANNER VIEW
  if (activeView === 'barcode') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <BarcodeScannerView
          onScan={performBarcodeLookup}
          onOpenManual={() => setManualModalVisible(true)}
          onClose={() => setActiveView('menu')}
          isProcessing={isProcessing}
          error={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />

        {/* Manual Barcode Entry Modal */}
        <ManualBarcodeModal
          visible={manualModalVisible}
          loading={isProcessing}
          onClose={() => setManualModalVisible(false)}
          onSubmit={performBarcodeLookup}
        />

        {/* Packaged Product Details Bottom Sheet */}
        <ProductDetailSheet
          visible={productSheetVisible}
          product={selectedProduct}
          onClose={() => {
            setProductSheetVisible(false);
            setSelectedProduct(null);
          }}
          onAddToDiary={handleAddToDiary}
        />
      </View>
    );
  }

  // 2. CAMERA PERMISSION DENIED VIEW
  if (activeView === 'permission_denied') {
    return (
      <ScreenContainer>
        <View style={[styles.deniedContainer, { padding: spacing.xl }]}>
          <View
            style={[
              styles.deniedIconBox,
              {
                backgroundColor: colors.surfaceMuted,
                borderRadius: radii.full,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              },
            ]}
          >
            <CameraOff size={48} color={colors.textPrimary} />
          </View>

          <Text
            style={[typography.titleMedium, { color: colors.textPrimary, textAlign: 'center' }]}
          >
            Camera Access Required
          </Text>

          <Text
            style={[
              typography.bodyMedium,
              {
                color: colors.textSecondary,
                textAlign: 'center',
                marginTop: spacing.sm,
                marginBottom: spacing.xl,
              },
            ]}
          >
            CAL METER requires camera permissions to scan barcodes on food packages. You can grant
            access or enter barcode digits manually.
          </Text>

          <View style={{ width: '100%', marginBottom: spacing.md }}>
            <Button
              title="Grant Camera Access"
              onPress={handleLaunchBarcodeScanner}
              accessibilityLabel="Request camera access again"
            />
          </View>

          <View style={{ width: '100%', marginBottom: spacing.md }}>
            <Button
              title="Enter Barcode Manually"
              variant="outline"
              leftIcon={<Barcode size={18} color={colors.textPrimary} />}
              onPress={() => setManualModalVisible(true)}
              accessibilityLabel="Enter barcode manually"
            />
          </View>

          <View style={{ width: '100%' }}>
            <Button
              title="Back to Capture Modes"
              variant="ghost"
              onPress={() => setActiveView('menu')}
              accessibilityLabel="Return to capture mode list"
            />
          </View>
        </View>

        {/* Manual Barcode Entry Modal */}
        <ManualBarcodeModal
          visible={manualModalVisible}
          loading={isProcessing}
          onClose={() => setManualModalVisible(false)}
          onSubmit={async barcode => {
            await performBarcodeLookup(barcode);
          }}
        />

        {/* Packaged Product Details Bottom Sheet */}
        <ProductDetailSheet
          visible={productSheetVisible}
          product={selectedProduct}
          onClose={() => {
            setProductSheetVisible(false);
            setSelectedProduct(null);
          }}
          onAddToDiary={handleAddToDiary}
        />
      </ScreenContainer>
    );
  }

  // 3. DEFAULT SCAN MENU VIEW
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
            Barcode Scanner Available
          </Text>
          <Text
            style={[typography.caption, { color: colors.textSecondary, marginTop: spacing.xxs }]}
          >
            Barcode scanning with live Open Food Facts integration is active. Photo AI and Label OCR
            will arrive in upcoming milestones.
          </Text>
        </View>
      </View>

      {/* Scanner Modes */}
      <SectionHeader title="Select Capture Method" />

      {scanModes.map(mode => (
        <Card
          key={mode.id}
          style={{ marginBottom: spacing.md }}
          onPress={() => handleModePress(mode.id, mode.title)}
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
        <Button
          title="Manual Barcode Entry"
          onPress={() => setManualModalVisible(true)}
          variant="outline"
          leftIcon={<Barcode size={18} color={colors.textPrimary} />}
          accessibilityLabel="Open manual barcode search dialog"
        />
      </View>

      {/* Manual Barcode Entry Modal */}
      <ManualBarcodeModal
        visible={manualModalVisible}
        loading={isProcessing}
        onClose={() => setManualModalVisible(false)}
        onSubmit={performBarcodeLookup}
      />

      {/* Packaged Product Details Bottom Sheet */}
      <ProductDetailSheet
        visible={productSheetVisible}
        product={selectedProduct}
        onClose={() => {
          setProductSheetVisible(false);
          setSelectedProduct(null);
        }}
        onAddToDiary={handleAddToDiary}
      />
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
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deniedIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
