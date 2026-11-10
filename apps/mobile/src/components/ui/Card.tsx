import React from 'react';
import { View, Pressable, ViewStyle, StyleProp, PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'muted';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  variant = 'default',
  style,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { theme } = useTheme();
  const { colors, radii, spacing, shadows } = theme;

  const isPressable = Boolean(onPress);

  const getBackgroundColor = (): string => {
    switch (variant) {
      case 'default':
        return colors.card;
      case 'elevated':
        return colors.surfaceElevated;
      case 'muted':
        return colors.surface;
    }
  };

  const containerStyle: ViewStyle = {
    backgroundColor: getBackgroundColor(),
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    ...(variant === 'elevated' ? shadows.subtle : {}),
  };

  if (isPressable) {
    return (
      <Pressable
        onPress={onPress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }: PressableStateCallbackType) => [
          containerStyle,
          { opacity: pressed ? 0.75 : 1 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[containerStyle, style]}>{children}</View>;
};
