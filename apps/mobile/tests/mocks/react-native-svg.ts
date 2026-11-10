import React from 'react';

const createSvgComponent = (name: string) => {
  const Component = React.forwardRef<unknown, React.PropsWithChildren<Record<string, unknown>>>(
    ({ children, ...props }, ref) =>
      React.createElement(name, { ...props, ref }, children as React.ReactNode),
  );
  Component.displayName = name;
  return Component;
};

export const Svg = createSvgComponent('Svg');
export const Path = createSvgComponent('Path');
export const Rect = createSvgComponent('Rect');
export const Circle = createSvgComponent('Circle');
export const Line = createSvgComponent('Line');
export const Polygon = createSvgComponent('Polygon');
export const Polyline = createSvgComponent('Polyline');
export const G = createSvgComponent('G');
export const Text = createSvgComponent('SvgText');
export const TSpan = createSvgComponent('TSpan');
export const TextPath = createSvgComponent('TextPath');
export const Use = createSvgComponent('Use');
export const Image = createSvgComponent('SvgImage');
export const Symbol = createSvgComponent('Symbol');
export const Defs = createSvgComponent('Defs');
export const LinearGradient = createSvgComponent('LinearGradient');
export const RadialGradient = createSvgComponent('RadialGradient');
export const Stop = createSvgComponent('Stop');
export const ClipPath = createSvgComponent('ClipPath');
export const Pattern = createSvgComponent('Pattern');
export const Mask = createSvgComponent('Mask');

export default Svg;
