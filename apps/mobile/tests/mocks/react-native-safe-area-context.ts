import React from 'react';

export const useSafeAreaInsets = () => ({
  top: 44,
  bottom: 34,
  left: 0,
  right: 0,
});

export const SafeAreaProvider: React.FC<React.PropsWithChildren<Record<string, unknown>>> = ({
  children,
}) => React.createElement(React.Fragment, null, children as React.ReactNode);

export const SafeAreaView = React.forwardRef<
  unknown,
  React.PropsWithChildren<Record<string, unknown>>
>(({ children, ...props }, ref) =>
  React.createElement('View', { ...props, ref }, children as React.ReactNode),
);
SafeAreaView.displayName = 'SafeAreaView';

export const initialWindowMetrics = {
  frame: { x: 0, y: 0, width: 375, height: 812 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

export default {
  useSafeAreaInsets,
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
};
