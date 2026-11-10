import React from 'react';

// Configure React 19 test environment
// @ts-expect-error global IS_REACT_ACT_ENVIRONMENT
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export const Platform = {
  OS: 'ios',
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T => {
    return (obj.ios ?? obj.default) as T;
  },
};

export const StyleSheet = {
  hairlineWidth: 1,
  absoluteFill: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (styles: unknown) => {
    if (!styles) return {};
    if (Array.isArray(styles)) {
      return Object.assign({}, ...styles.flat().filter(Boolean));
    }
    return styles;
  },
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
  addEventListener: () => ({ remove: () => {} }),
};

export const useWindowDimensions = () => ({
  width: 375,
  height: 812,
  scale: 2,
  fontScale: 1,
});

export const useColorScheme = () => 'light';

export const AppRegistry = {
  registerComponent: () => {},
};

export const PixelRatio = {
  get: () => 2,
  roundToNearestPixel: (n: number) => Math.round(n),
};

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: Array<{ text: string; onPress?: () => void }>,
  ) => {
    Alert.lastAlert = { title, message, buttons };
  },
  lastAlert: null as {
    title: string;
    message?: string;
    buttons?: Array<{ text: string; onPress?: () => void }>;
  } | null,
};

// React Native UI Component Mocks
export const View = React.forwardRef<unknown, React.PropsWithChildren<Record<string, unknown>>>(
  ({ children, ...props }, ref) =>
    React.createElement('View', { ...props, ref }, children as React.ReactNode),
);
View.displayName = 'View';

export const Text = React.forwardRef<unknown, React.PropsWithChildren<Record<string, unknown>>>(
  ({ children, ...props }, ref) =>
    React.createElement('Text', { ...props, ref }, children as React.ReactNode),
);
Text.displayName = 'Text';

export interface PressableProps {
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  style?: unknown;
  onPress?: ((e?: unknown) => void) | undefined;
  onLongPress?: ((e?: unknown) => void) | undefined;
  disabled?: boolean;
  accessibilityRole?: string;
  accessibilityState?: Record<string, unknown>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export const Pressable = React.forwardRef<unknown, PressableProps>(
  ({ children, style, onPress, disabled, ...props }, ref) => {
    const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
    const resolvedChildren =
      typeof children === 'function' ? children({ pressed: false }) : children;

    const handlePress = (e: unknown) => {
      if (!disabled && onPress) {
        onPress(e);
      }
    };

    return React.createElement(
      'Pressable',
      {
        ...props,
        ref,
        disabled,
        style: resolvedStyle,
        onClick: handlePress,
        onPress: handlePress,
      },
      resolvedChildren as React.ReactNode,
    );
  },
);
Pressable.displayName = 'Pressable';

export interface TextInputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  [key: string]: unknown;
}

export const TextInput = React.forwardRef<unknown, TextInputProps>(
  ({ onChangeText, value, ...props }, ref) => {
    return React.createElement('TextInput', {
      ...props,
      ref,
      value,
      onChangeText,
      onChange: (e: { target: { value: string } }) => {
        if (typeof onChangeText === 'function') {
          onChangeText(e.target?.value ?? '');
        }
      },
    });
  },
);
TextInput.displayName = 'TextInput';

export interface SwitchProps {
  value?: boolean;
  onValueChange?: (val: boolean) => void;
  disabled?: boolean;
  [key: string]: unknown;
}

export const Switch = React.forwardRef<unknown, SwitchProps>(
  ({ value, onValueChange, disabled, ...props }, ref) => {
    return React.createElement('Switch', {
      ...props,
      ref,
      value,
      disabled,
      onChange: () => {
        if (!disabled && typeof onValueChange === 'function') {
          onValueChange(!value);
        }
      },
    });
  },
);
Switch.displayName = 'Switch';

export const ActivityIndicator = React.forwardRef<unknown, Record<string, unknown>>((props, ref) =>
  React.createElement('ActivityIndicator', { ...props, ref }),
);
ActivityIndicator.displayName = 'ActivityIndicator';

export const ScrollView = React.forwardRef<
  unknown,
  React.PropsWithChildren<Record<string, unknown>>
>(({ children, ...props }, ref) =>
  React.createElement('ScrollView', { ...props, ref }, children as React.ReactNode),
);
ScrollView.displayName = 'ScrollView';

export const StatusBar: React.FC<Record<string, unknown>> = () => null;

export default {
  Platform,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  useColorScheme,
  AppRegistry,
  PixelRatio,
  Alert,
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
  StatusBar,
};
