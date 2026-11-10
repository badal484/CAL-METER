import { describe, it, expect } from 'vitest';
import {
  lightTheme,
  darkTheme,
  PALETTE,
  spacing,
  radii,
  dimensions,
  shadows,
  typography,
} from '../src/theme';

describe('Design System: Theme Tokens', () => {
  it('defines consistent monochrome palette colors', () => {
    expect(PALETTE.white).toBe('#FFFFFF');
    expect(PALETTE.black).toBe('#000000');
    expect(PALETTE.gray50).toBe('#F9FAFB');
    expect(PALETTE.gray900).toBe('#111827');
    expect(PALETTE.gray950).toBe('#0B0F17');
  });

  it('provides complete light theme contract', () => {
    expect(lightTheme.isDark).toBe(false);
    expect(lightTheme.colors.background).toBe(PALETTE.white);
    expect(lightTheme.colors.textPrimary).toBe(PALETTE.gray900);
    expect(lightTheme.colors.tabBarActive).toBe(PALETTE.black);
    expect(lightTheme.colors.card).toBe(PALETTE.white);
    expect(lightTheme.colors.border).toBe(PALETTE.gray200);
  });

  it('provides complete dark theme contract with inverted monochrome palette', () => {
    expect(darkTheme.isDark).toBe(true);
    expect(darkTheme.colors.background).toBe(PALETTE.black);
    expect(darkTheme.colors.textPrimary).toBe(PALETTE.gray50);
    expect(darkTheme.colors.tabBarActive).toBe(PALETTE.white);
    expect(darkTheme.colors.card).toBe(PALETTE.gray950);
    expect(darkTheme.colors.border).toBe(PALETTE.gray800);
  });

  it('ensures strict spacing progression', () => {
    expect(spacing.none).toBe(0);
    expect(spacing.xxs).toBe(2);
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(20);
    expect(spacing.xxl).toBe(24);
    expect(spacing.xxxl).toBe(32);
    expect(spacing.huge).toBe(40);
    expect(spacing.massive).toBe(48);
  });

  it('satisfies touch target accessibility standards', () => {
    expect(dimensions.minTouchTarget).toBeGreaterThanOrEqual(44);
    expect(dimensions.tabBarCenterButtonSize).toBe(52);
    expect(dimensions.buttonHeight.sm).toBeGreaterThanOrEqual(36);
    expect(dimensions.buttonHeight.md).toBeGreaterThanOrEqual(44);
    expect(dimensions.buttonHeight.lg).toBe(54);
  });

  it('defines border radii tokens', () => {
    expect(radii.none).toBe(0);
    expect(radii.xs).toBe(4);
    expect(radii.sm).toBe(6);
    expect(radii.md).toBe(10);
    expect(radii.lg).toBe(16);
    expect(radii.xl).toBe(24);
    expect(radii.full).toBe(9999);
  });

  it('provides structured typography scale with system fallbacks', () => {
    expect(typography.display.fontSize).toBe(34);
    expect(typography.titleLarge.fontSize).toBe(24);
    expect(typography.titleMedium.fontSize).toBe(20);
    expect(typography.titleSmall.fontSize).toBe(17);
    expect(typography.bodyLarge.fontSize).toBe(16);
    expect(typography.bodyMedium.fontSize).toBe(14);
    expect(typography.bodySmall.fontSize).toBe(12);
    expect(typography.labelLarge.fontSize).toBe(15);
    expect(typography.numericDisplay.fontSize).toBe(44);
    expect(typography.numericLarge.fontSize).toBe(28);
    expect(typography.numericMedium.fontSize).toBe(18);
  });

  it('provides shadow tokens including subtle, medium, and none', () => {
    expect(shadows.none.elevation).toBe(0);
    expect(shadows.subtle).toBeDefined();
    expect(shadows.medium).toBeDefined();
    expect(shadows.sm).toBe(shadows.subtle);
    expect(shadows.md).toBe(shadows.medium);
  });
});
