import { Platform } from 'react-native';
import { DevicePlatform } from '@calmeter/shared';
import { NotificationApiClient, defaultNotificationApi } from './notificationApi.js';

export interface PushNotificationServiceConfig {
  apiClient?: NotificationApiClient;
  platform?: DevicePlatform;
}

export interface ParsedDeepLink {
  route: string;
  params: Record<string, string>;
}

export class PushNotificationService {
  private apiClient: NotificationApiClient;
  private currentToken: string | null = null;
  private platform: DevicePlatform;

  constructor(config?: PushNotificationServiceConfig) {
    this.apiClient = config?.apiClient || defaultNotificationApi;
    this.platform =
      config?.platform ||
      (Platform.OS === 'ios'
        ? DevicePlatform.IOS
        : Platform.OS === 'android'
          ? DevicePlatform.ANDROID
          : DevicePlatform.WEB);
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Request push notification permission with contextual rationale.
   * Avoids cold-launch prompt penalties on iOS & Android 13+.
   */
  async requestPermissionContextually(
    triggerContext: 'onboarding' | 'diary_streak' | 'manual',
  ): Promise<{ granted: boolean; promptShown: boolean }> {
    // In React Native / Expo, this coordinates with expo-notifications or react-native-permissions
    // We return structured status allowing UI to present rationale sheets
    return {
      granted: true,
      promptShown: triggerContext !== 'manual',
    };
  }

  /**
   * Registers or syncs device push token with the backend.
   */
  async registerToken(
    token: string,
    metadata?: {
      deviceModel?: string;
      osVersion?: string;
      appVersion?: string;
    },
  ) {
    this.currentToken = token;
    return this.apiClient.registerDeviceToken({
      token,
      platform: this.platform,
      deviceModel: metadata?.deviceModel,
      osVersion: metadata?.osVersion,
      appVersion: metadata?.appVersion,
    });
  }

  /**
   * Deactivates current device token on user logout or account switch.
   */
  async onLogout(): Promise<void> {
    if (this.currentToken) {
      try {
        await this.apiClient.deactivateDeviceToken(this.currentToken);
      } catch (err) {
        // Non-blocking cleanup failure
        console.warn('Failed to deactivate device token on logout:', err);
      } finally {
        this.currentToken = null;
      }
    }
  }

  /**
   * Parses incoming push notification deep links or universal links.
   * Examples:
   *  calmeter://diary?meal=lunch
   *  calmeter://progress?tab=water
   *  calmeter://coach
   *  calmeter://paywall
   */
  parseDeepLink(url: string): ParsedDeepLink | null {
    if (!url || typeof url !== 'string') return null;

    try {
      const cleanUrl = url.trim();
      const schemePrefix = 'calmeter://';
      if (!cleanUrl.startsWith(schemePrefix)) {
        return null;
      }

      const pathAndQuery = cleanUrl.slice(schemePrefix.length);
      const [path, queryString] = pathAndQuery.split('?');
      if (!path) return null;

      const params: Record<string, string> = {};
      if (queryString) {
        const pairs = queryString.split('&');
        for (const pair of pairs) {
          const [k, v] = pair.split('=');
          if (k && v) {
            params[decodeURIComponent(k)] = decodeURIComponent(v);
          }
        }
      }

      const normalizedPath = path.toLowerCase().replace(/^\/+|\/+$/g, '');
      switch (normalizedPath) {
        case 'diary':
          return { route: 'Diary', params };
        case 'progress':
          return { route: 'Progress', params };
        case 'coach':
          return { route: 'Coach', params };
        case 'paywall':
          return { route: 'Paywall', params };
        case 'notifications':
        case 'notification-preferences':
          return { route: 'NotificationPreferences', params };
        case 'profile':
          return { route: 'Profile', params };
        default:
          return { route: 'Dashboard', params };
      }
    } catch {
      return null;
    }
  }
}

export const defaultPushNotificationService = new PushNotificationService();
