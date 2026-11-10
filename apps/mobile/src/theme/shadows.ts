import { ViewStyle, Platform } from 'react-native';

const noneStyle: ViewStyle = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

const subtleStyle: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
  default: {},
}) as ViewStyle;

const mediumStyle: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  android: {
    elevation: 4,
  },
  default: {},
}) as ViewStyle;

export const shadows = {
  none: noneStyle,
  subtle: subtleStyle,
  medium: mediumStyle,
  sm: subtleStyle,
  md: mediumStyle,
  lg: mediumStyle,
} as const;
