import React from 'react';

export const CameraType = {
  Front: 'front',
  Back: 'back',
};

export const Camera = React.forwardRef<any, any>((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    capture: async () => ({
      uri: 'mock://photo.jpg',
      name: 'photo.jpg',
      height: 1080,
      width: 1920,
    }),
    requestDeviceCameraAuthorization: async () => true,
    checkDeviceCameraAuthorizationStatus: async () => true,
  }));

  return React.createElement(
    'Camera',
    {
      ...props,
      testID: props.testID || 'camera-kit-camera',
    },
    props.children,
  );
});
Camera.displayName = 'Camera';

export const CameraKit = {
  requestDeviceCameraAuthorization: async () => true,
  checkDeviceCameraAuthorizationStatus: async () => true,
};

export const Orientation = {
  PORTRAIT: 0,
  LANDSCAPE_LEFT: 1,
  PORTRAIT_UPSIDE_DOWN: 2,
  LANDSCAPE_RIGHT: 3,
};

export default CameraKit;
