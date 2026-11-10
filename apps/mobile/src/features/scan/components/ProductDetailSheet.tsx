import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, Image } from 'react-native';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { Button } from '../../../components';
import { X, Plus, Minus, ShieldCheck, Globe, User, Check } from 'lucide-react-native';
import type { PackagedProductDto } from '@calmeter/contracts';
import { MealType, LoggedMethod, DataQuality, roundTo } from '@calmeter/shared';

export interface ProductDetailSheetProps {
  visible: boolean;
  product: PackagedProductDto | null;
  onClose: () => void;
  onAddToDiary: (params: {
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
  }) => Promise<void>;
  initialMealType?: MealType;
}

type PortionMode = 'serving' | '100g' | 'custom';

export const ProductDetailSheet: React.FC<ProductDetailSheetProps> = ({
  visible,
  product,
  onClose,
  onAddToDiary,
  initialMealType = MealType.BREAKFAST,
}) => {
  const { theme } = useTheme();
  const { colors, typography, spacing, radii } = theme;

  // Portion selection mode
  const hasStandardServing = Boolean(
    product?.servingSize && product.servingSize > 0 && product?.servingUnit,
  );
  const [portionMode, setPortionMode] = useState<PortionMode>(
    hasStandardServing ? 'serving' : '100g',
  );
  const [quantity, setQuantity] = useState(1);
  const [customGrams, setCustomGrams] = useState(100);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset state when product changes
  React.useEffect(() => {
    if (product) {
      setPortionMode(product.servingSize ? 'serving' : '100g');
      setQuantity(1);
      setCustomGrams(product.servingSize || 100);
      setIsSubmitting(false);
      setIsSuccess(false);
    }
  }, [product]);

  // Compute active base serving size in grams and unit label
  const { activeServingGrams, activeServingUnit } = useMemo(() => {
    if (!product) return { activeServingGrams: 100, activeServingUnit: 'g' };

    if (portionMode === 'serving' && product.servingSize && product.servingUnit) {
      return {
        activeServingGrams: product.servingSize,
        activeServingUnit: product.servingUnit,
      };
    }
    if (portionMode === 'custom') {
      return {
        activeServingGrams: Math.max(1, customGrams),
        activeServingUnit: 'g',
      };
    }
    // 100g default
    return {
      activeServingGrams: 100,
      activeServingUnit: '100g',
    };
  }, [portionMode, product, customGrams]);

  // Total weight in grams
  const totalWeightGrams = activeServingGrams * quantity;

  // Scaled nutrition values (scaled from per-100g values)
  // Preserves null when unmeasured! Never silently substitutes 0 for unknown values.
  const scaledNutrients = useMemo(() => {
    if (!product) return null;
    const { nutrientsPer100g } = product;
    const factor = totalWeightGrams / 100;

    const scale = (val: number | null | undefined): number | null => {
      if (val === null || val === undefined) return null;
      return roundTo(val * factor, 1);
    };

    return {
      calories: scale(nutrientsPer100g.calories),
      protein: scale(nutrientsPer100g.protein),
      carbs: scale(nutrientsPer100g.carbs),
      fat: scale(nutrientsPer100g.fat),
      saturatedFat: scale(nutrientsPer100g.saturatedFat),
      transFat: scale(nutrientsPer100g.transFat),
      fiber: scale(nutrientsPer100g.fiber),
      sugar: scale(nutrientsPer100g.sugar),
      sodium: scale(nutrientsPer100g.sodium),
    };
  }, [product, totalWeightGrams]);

  if (!product) return null;

  const handleQuantityMinus = () => {
    setQuantity(prev => (prev > 0.5 ? roundTo(prev - 0.5, 1) : 0.5));
  };

  const handleQuantityPlus = () => {
    setQuantity(prev => roundTo(prev + 0.5, 1));
  };

  const handleAddToDiary = async () => {
    if (isSubmitting || isSuccess) return;
    setIsSubmitting(true);
    try {
      await onAddToDiary({
        foodItemId: product.id,
        foodName: product.name,
        mealType: selectedMealType,
        servingSizeGrams: activeServingGrams,
        portionAmount: quantity,
        servingUnit: activeServingUnit,
        calories: scaledNutrients?.calories ?? 0,
        protein: scaledNutrients?.protein ?? 0,
        carbs: scaledNutrients?.carbs ?? 0,
        fat: scaledNutrients?.fat ?? 0,
        fiber: scaledNutrients?.fiber ?? null,
        sugar: scaledNutrients?.sugar ?? null,
        sodium: scaledNutrients?.sodium ?? null,
        loggedMethod: LoggedMethod.BARCODE,
      });
      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch {
      setIsSubmitting(false);
    }
  };

  const renderDataQualityBadge = () => {
    switch (product.dataQuality) {
      case DataQuality.VERIFIED:
        return (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <ShieldCheck size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />
            <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '600' }]}>
              Verified
            </Text>
          </View>
        );
      case DataQuality.USER_ENTERED:
        return (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <User size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>User Entered</Text>
          </View>
        );
      case DataQuality.EXTERNAL_SOURCE:
      default:
        return (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <Globe size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>
              External (Open Food Facts)
            </Text>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flex: 1 }}>
              <Text
                style={[typography.titleMedium, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              {(product.brand || product.manufacturer) && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textSecondary, marginTop: spacing.xxs },
                  ]}
                >
                  {[product.brand, product.manufacturer].filter(Boolean).join(' • ')}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close product details"
            >
              <X size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Meta row: Barcode & Quality Badge */}
            <View style={[styles.metaRow, { marginVertical: spacing.sm }]}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Barcode: {product.barcode}
              </Text>
              {renderDataQualityBadge()}
            </View>

            {/* Product Image (if available) */}
            {Boolean(product.imageUrl) && (
              <View
                style={[
                  styles.imageWrapper,
                  { borderColor: colors.borderSubtle, borderRadius: radii.md },
                ]}
              >
                <Image
                  source={{ uri: product.imageUrl! }}
                  style={styles.productImage}
                  resizeMode="contain"
                  accessibilityLabel={`Photo of ${product.name}`}
                />
              </View>
            )}

            {/* Portion Selection */}
            <Text
              style={[
                typography.labelMedium,
                { color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              Select Portion Size
            </Text>
            <View style={styles.portionRow}>
              {hasStandardServing && (
                <Pressable
                  style={[
                    styles.portionPill,
                    {
                      backgroundColor:
                        portionMode === 'serving' ? colors.primary : colors.surfaceMuted,
                      borderColor: portionMode === 'serving' ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      marginRight: spacing.xs,
                    },
                  ]}
                  onPress={() => setPortionMode('serving')}
                  accessibilityRole="button"
                  accessibilityLabel={`Per serving ${product.servingSize}g`}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: portionMode === 'serving' ? colors.surface : colors.textPrimary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    1 Serving ({product.servingSize} {product.servingUnit})
                  </Text>
                </Pressable>
              )}

              <Pressable
                style={[
                  styles.portionPill,
                  {
                    backgroundColor: portionMode === '100g' ? colors.primary : colors.surfaceMuted,
                    borderColor: portionMode === '100g' ? colors.primary : colors.borderSubtle,
                    borderRadius: radii.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    marginRight: spacing.xs,
                  },
                ]}
                onPress={() => setPortionMode('100g')}
                accessibilityRole="button"
                accessibilityLabel="Per 100 grams"
              >
                <Text
                  style={[
                    typography.caption,
                    {
                      color: portionMode === '100g' ? colors.surface : colors.textPrimary,
                      fontWeight: '600',
                    },
                  ]}
                >
                  Per 100g
                </Text>
              </Pressable>
            </View>

            {/* Quantity Stepper */}
            <View style={[styles.stepperContainer, { marginVertical: spacing.md }]}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Quantity</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      borderRadius: radii.sm,
                    },
                  ]}
                  onPress={handleQuantityMinus}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease quantity"
                >
                  <Minus size={16} color={colors.textPrimary} />
                </Pressable>
                <Text
                  style={[
                    typography.titleMedium,
                    {
                      color: colors.textPrimary,
                      marginHorizontal: spacing.md,
                      minWidth: 40,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {quantity}x
                </Text>
                <Pressable
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      borderRadius: radii.sm,
                    },
                  ]}
                  onPress={handleQuantityPlus}
                  accessibilityRole="button"
                  accessibilityLabel="Increase quantity"
                >
                  <Plus size={16} color={colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            {/* Total calculated weight */}
            <Text
              style={[
                typography.caption,
                { color: colors.textSecondary, marginBottom: spacing.md },
              ]}
            >
              Total portion: {roundTo(totalWeightGrams, 1)}g ({quantity} × {activeServingGrams}g)
            </Text>

            {/* Live Nutrition Panel */}
            <View
              style={[
                styles.nutritionPanel,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: colors.borderSubtle,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                },
              ]}
            >
              <Text
                style={[
                  typography.labelMedium,
                  { color: colors.textPrimary, marginBottom: spacing.xs },
                ]}
              >
                Nutrition Facts
              </Text>
              <View style={styles.macroGrid}>
                <View style={styles.macroCard}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Calories
                  </Text>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {scaledNutrients?.calories !== null ? `${scaledNutrients?.calories}` : '--'}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>kcal</Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Protein</Text>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {scaledNutrients?.protein !== null ? `${scaledNutrients?.protein}g` : '--'}
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Carbs</Text>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {scaledNutrients?.carbs !== null ? `${scaledNutrients?.carbs}g` : '--'}
                  </Text>
                </View>
                <View style={styles.macroCard}>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Fat</Text>
                  <Text style={[typography.titleMedium, { color: colors.textPrimary }]}>
                    {scaledNutrients?.fat !== null ? `${scaledNutrients?.fat}g` : '--'}
                  </Text>
                </View>
              </View>

              {/* Micros & Detailed Breakdown */}
              <View style={[styles.microRow, { marginTop: spacing.sm }]}>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Fiber: {scaledNutrients?.fiber !== null ? `${scaledNutrients?.fiber}g` : '--'}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Sugar: {scaledNutrients?.sugar !== null ? `${scaledNutrients?.sugar}g` : '--'}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Sodium: {scaledNutrients?.sodium !== null ? `${scaledNutrients?.sodium}mg` : '--'}
                </Text>
              </View>
            </View>

            {/* Allergens */}
            {product.allergens && product.allergens.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={[
                    typography.labelSmall,
                    { color: colors.textPrimary, marginBottom: spacing.xs },
                  ]}
                >
                  Allergens
                </Text>
                <View style={styles.allergenWrap}>
                  {product.allergens.map((allergen, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.allergenChip,
                        {
                          backgroundColor: colors.surfaceMuted,
                          borderColor: colors.borderSubtle,
                          borderRadius: radii.xs,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xxs,
                          marginRight: spacing.xs,
                          marginBottom: spacing.xs,
                        },
                      ]}
                    >
                      <Text style={[typography.caption, { color: colors.textPrimary }]}>
                        {allergen}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Ingredients */}
            {Boolean(product.ingredientsText) && (
              <View style={{ marginBottom: spacing.md }}>
                <Text
                  style={[
                    typography.labelSmall,
                    { color: colors.textPrimary, marginBottom: spacing.xs },
                  ]}
                >
                  Ingredients
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, lineHeight: 16 }]}>
                  {product.ingredientsText}
                </Text>
              </View>
            )}

            {/* Meal Slot Selection */}
            <Text
              style={[
                typography.labelMedium,
                { color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.xs },
              ]}
            >
              Meal Slot
            </Text>
            <View style={styles.mealSlotRow}>
              {[MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER, MealType.SNACK].map(type => (
                <Pressable
                  key={type}
                  style={[
                    styles.mealSlotPill,
                    {
                      backgroundColor:
                        selectedMealType === type ? colors.primary : colors.surfaceMuted,
                      borderColor: selectedMealType === type ? colors.primary : colors.borderSubtle,
                      borderRadius: radii.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      marginRight: spacing.xs,
                    },
                  ]}
                  onPress={() => setSelectedMealType(type)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select meal slot ${type}`}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: selectedMealType === type ? colors.surface : colors.textPrimary,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Attribution Notice */}
            <View style={[styles.attributionBox, { marginVertical: spacing.md }]}>
              <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
                {product.dataQuality === DataQuality.EXTERNAL_SOURCE
                  ? 'Data sourced from Open Food Facts under Open Database License (ODbL) 1.0.'
                  : 'Nutrition data verified by CAL METER.'}
              </Text>
            </View>

            {/* Add to Diary Action Button */}
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.xl }}>
              <Button
                title={
                  isSuccess
                    ? 'Added to Diary!'
                    : isSubmitting
                      ? 'Adding...'
                      : `Log to ${selectedMealType.charAt(0) + selectedMealType.slice(1).toLowerCase()}`
                }
                onPress={handleAddToDiary}
                disabled={isSubmitting || isSuccess}
                loading={isSubmitting}
                leftIcon={isSuccess ? <Check size={18} color={colors.surface} /> : undefined}
                accessibilityLabel="Log packaged food item to diary"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  scrollContent: {
    flexGrow: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  imageWrapper: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginVertical: 8,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  portionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  portionPill: {
    borderWidth: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionPanel: {
    borderWidth: 1,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroCard: {
    alignItems: 'center',
    flex: 1,
  },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
    paddingTop: 8,
  },
  allergenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergenChip: {
    borderWidth: 1,
  },
  mealSlotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mealSlotPill: {
    borderWidth: 1,
  },
  attributionBox: {
    alignItems: 'center',
  },
});
