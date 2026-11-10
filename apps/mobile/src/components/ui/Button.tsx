import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  PressableStateCallbackType,
} from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) => {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing, dimensions } = theme;

  const isInteractive = !disabled && !loading;

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let backgroundColor = 'transparent';
    let borderColor = 'transparent';
    let borderWidth = 0;
    let opacity = 1;

    switch (variant) {
      case 'primary':
        backgroundColor = colors.primary;
        break;
      case 'secondary':
        backgroundColor = colors.secondary;
        break;
      case 'outline':
        borderColor = colors.border;
        borderWidth = 1;
        break;
      case 'ghost':
        backgroundColor = 'transparent';
        break;
    }

    if (pressed && isInteractive) {
      opacity = 0.75;
    }
    if (!isInteractive) {
      opacity = 0.4;
    }

    let height: number = dimensions.buttonHeight.md;
    let paddingHorizontal: number = spacing.lg;

    if (size === 'sm') {
      height = dimensions.buttonHeight.sm;
      paddingHorizontal = spacing.md;
    } else if (size === 'lg') {
      height = dimensions.buttonHeight.lg;
      paddingHorizontal = spacing.xl;
    }

    return {
      height,
      minHeight: dimensions.minTouchTarget,
      paddingHorizontal,
      backgroundColor,
      borderColor,
      borderWidth,
      borderRadius: radii.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity,
    };
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
        return colors.primaryText;
      case 'secondary':
        return colors.secondaryText;
      case 'outline':
      case 'ghost':
        return colors.textPrimary;
    }
  };

  const getTextStyle = (): TextStyle => {
    let fontStyle: TextStyle = typography.labelLarge;
    if (size === 'sm') fontStyle = typography.labelMedium;
    if (size === 'lg') fontStyle = typography.titleSmall;

    return {
      ...fontStyle,
      color: getTextColor(),
      textAlign: 'center',
    };
  };

  return (
    <Pressable
      testID={testID}
      onPress={isInteractive ? onPress : undefined}
      disabled={!isInteractive}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={({ pressed }: PressableStateCallbackType) => [getContainerStyle(pressed), style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {leftIcon ? <>{leftIcon}</> : null}
          <Text
            style={[
              getTextStyle(),
              leftIcon ? { marginLeft: spacing.xs } : undefined,
              rightIcon ? { marginRight: spacing.xs } : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon ? <>{rightIcon}</> : null}
        </>
      )}
    </Pressable>
  );
};
