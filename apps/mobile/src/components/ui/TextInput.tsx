import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export const TextInput: React.FC<TextInputProps> = ({
  label,
  helperText,
  errorMessage,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}) => {
  const { theme } = useTheme();
  const { colors, typography, radii, spacing, dimensions } = theme;
  const [isFocused, setIsFocused] = useState(false);

  const isError = Boolean(errorMessage);

  const getBorderColor = (): string => {
    if (isError) return colors.error;
    if (isFocused) return colors.borderFocus;
    return colors.border;
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text
          style={[
            typography.labelMedium,
            { color: isError ? colors.error : colors.textSecondary, marginBottom: spacing.xs },
          ]}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: editable ? colors.surface : colors.surfaceMuted,
            borderColor: getBorderColor(),
            borderRadius: radii.md,
            minHeight: dimensions.inputHeight,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        {leftIcon ? <View style={{ marginRight: spacing.sm }}>{leftIcon}</View> : null}

        <RNTextInput
          style={[
            styles.textInput,
            typography.bodyLarge,
            { color: colors.textPrimary },
            inputStyle,
          ]}
          placeholderTextColor={colors.textTertiary}
          editable={editable}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />

        {rightIcon ? <View style={{ marginLeft: spacing.sm }}>{rightIcon}</View> : null}
      </View>

      {errorMessage ? (
        <Text style={[typography.caption, { color: colors.error, marginTop: spacing.xs }]}>
          {errorMessage}
        </Text>
      ) : helperText ? (
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
  },
});
