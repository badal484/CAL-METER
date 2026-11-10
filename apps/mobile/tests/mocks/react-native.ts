export const Platform = {
  OS: 'ios',
  select: <T>(obj: { ios?: T; android?: T; default?: T }): T => {
    return (obj.ios ?? obj.default) as T;
  },
};

export const StyleSheet = {
  hairlineWidth: 1,
  create: <T>(styles: T): T => styles,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const useColorScheme = () => 'light';

export const AppRegistry = {
  registerComponent: () => {},
};

export default {
  Platform,
  StyleSheet,
  Dimensions,
  useColorScheme,
  AppRegistry,
};
