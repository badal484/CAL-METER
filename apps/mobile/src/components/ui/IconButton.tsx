import React from 'react';
import { Pressable, ViewStyle, StyleProp, PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export type IconButtonVariant = 'ghost' | 'filled' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}) => {
  const { theme } = useTheme();
  const { colors, radii, dimensions } = theme;

  let dimension: number = dimensions.minTouchTarget;
  if (size === 'sm') dimension = 36;
  if (size === 'lg') dimension = 52;

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let backgroundColor = 'transparent';
    let borderColor = 'transparent';
    let borderWidth = 0;
    let opacity = 1;

    if (variant === 'filled') {
      backgroundColor = colors.surfaceMuted;
    } else if (variant === 'outline') {
      borderColor = colors.border;
      borderWidth = 1;
    }

    if (pressed && !disabled) {
      opacity = 0.6;
    }
    if (disabled) {
      opacity = 0.3;
    }

    return {
      width: dimension,
      height: dimension,
      borderRadius: radii.full,
      backgroundColor,
      borderColor,
      borderWidth,
      opacity,
      alignItems: 'center',
      justifyContent: 'center',
    };
  };

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={size === 'sm' ? { top: 8, bottom: 8, left: 8, right: 8 } : undefined}
      style={({ pressed }: PressableStateCallbackType) => [getContainerStyle(pressed), style]}
    >
      {icon}
    </Pressable>
  );
};
