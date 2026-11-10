import { Platform, PermissionsAndroid } from 'react-native';
import CameraKit from 'react-native-camera-kit';

/**
 * Checks whether camera permission is currently granted.
 */
export async function checkCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    try {
      if (
        CameraKit &&
        typeof (CameraKit as any).checkDeviceCameraAuthorizationStatus === 'function'
      ) {
        const status = await (CameraKit as any).checkDeviceCameraAuthorizationStatus();
        return Boolean(status);
      }
      return true;
    } catch {
      return true;
    }
  }

  return true;
}

/**
 * Requests camera permission from the operating system.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Access Required',
        message:
          'CAL METER uses your camera to scan barcodes on packaged food items for quick nutrition logging.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Grant Access',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    try {
      if (CameraKit && typeof (CameraKit as any).requestDeviceCameraAuthorization === 'function') {
        const authorized = await (CameraKit as any).requestDeviceCameraAuthorization();
        return Boolean(authorized);
      }
      return true;
    } catch {
      return true;
    }
  }

  return true;
}
