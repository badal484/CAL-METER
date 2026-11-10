import React from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  ViewStyle,
  StyleProp,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../app/providers/ThemeProvider';

export interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  withBottomPadding?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  header,
  footer,
  style,
  contentContainerStyle,
  withBottomPadding = true,
}) => {
  const { theme, isDark } = useTheme();
  const { colors, spacing } = theme;
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: insets.top,
  };

  const bottomPadding = withBottomPadding ? spacing.huge : 0;

  return (
    <View style={[containerStyle, style]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {header ? <View>{header}</View> : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scrollable ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              {
                paddingHorizontal: spacing.lg,
                paddingBottom: insets.bottom + bottomPadding,
              },
              contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              {
                flex: 1,
                paddingHorizontal: spacing.lg,
                paddingBottom: insets.bottom + bottomPadding,
              },
              contentContainerStyle,
            ]}
          >
            {children}
          </View>
        )}
      </KeyboardAvoidingView>

      {footer ? <View style={{ paddingBottom: insets.bottom }}>{footer}</View> : null}
    </View>
  );
};
