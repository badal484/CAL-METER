import { describe, it, expect, vi } from 'vitest';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { PushNotificationService } from '../src/services/pushNotificationService';
import { NotificationPreferencesView } from '../src/features/profile/NotificationPreferencesView';
import { DevicePlatform } from '@calmeter/shared';

describe('Push Notifications Mobile Features (Part 13)', () => {
  describe('PushNotificationService', () => {
    it('registers token with client and stores in memory', async () => {
      const mockApi = {
        registerDeviceToken: vi.fn().mockResolvedValue({
          id: 'dev-123',
          platform: 'ANDROID',
          isActive: true,
          updatedAt: '2026-11-10T12:00:00Z',
        }),
        deactivateDeviceToken: vi.fn().mockResolvedValue(undefined),
      } as any;

      const service = new PushNotificationService({
        apiClient: mockApi,
        platform: DevicePlatform.ANDROID,
      });

      await service.registerToken('test-token-fcm-123', {
        deviceModel: 'Pixel 8',
        osVersion: 'Android 14',
        appVersion: '1.0.0',
      });

      expect(service.getCurrentToken()).toBe('test-token-fcm-123');
      expect(mockApi.registerDeviceToken).toHaveBeenCalledWith({
        token: 'test-token-fcm-123',
        platform: DevicePlatform.ANDROID,
        deviceModel: 'Pixel 8',
        osVersion: 'Android 14',
        appVersion: '1.0.0',
      });
    });

    it('deactivates token and clears state on logout', async () => {
      const mockApi = {
        registerDeviceToken: vi.fn().mockResolvedValue({}),
        deactivateDeviceToken: vi.fn().mockResolvedValue(undefined),
      } as any;

      const service = new PushNotificationService({ apiClient: mockApi });
      await service.registerToken('test-logout-token');
      expect(service.getCurrentToken()).toBe('test-logout-token');

      await service.onLogout();
      expect(mockApi.deactivateDeviceToken).toHaveBeenCalledWith('test-logout-token');
      expect(service.getCurrentToken()).toBeNull();
    });

    it('parses deep links accurately for push notification routing', () => {
      const service = new PushNotificationService();

      const diaryLink = service.parseDeepLink('calmeter://diary?meal=lunch');
      expect(diaryLink).toEqual({
        route: 'Diary',
        params: { meal: 'lunch' },
      });

      const progressLink = service.parseDeepLink('calmeter://progress?tab=water');
      expect(progressLink).toEqual({
        route: 'Progress',
        params: { tab: 'water' },
      });

      const coachLink = service.parseDeepLink('calmeter://coach');
      expect(coachLink).toEqual({
        route: 'Coach',
        params: {},
      });

      const paywallLink = service.parseDeepLink('calmeter://paywall');
      expect(paywallLink).toEqual({
        route: 'Paywall',
        params: {},
      });

      const invalidLink = service.parseDeepLink('https://example.com/not-calmeter');
      expect(invalidLink).toBeNull();
    });
  });

  describe('NotificationPreferencesView Component', () => {
    it('loads and renders notification preference controls', async () => {
      const mockPref = {
        enabled: true,
        mealReminders: true,
        breakfastReminder: true,
        lunchReminder: true,
        dinnerReminder: true,
        waterReminders: true,
        dailySummary: true,
        weeklySummary: true,
        weightReminders: true,
        coachInsights: true,
        subscriptionUpdates: true,
        breakfastTime: '08:30',
        lunchTime: '13:00',
        dinnerTime: '20:00',
        dailySummaryTime: '21:30',
        weightReminderTime: '08:00',
        weeklySummaryDay: 0,
        waterIntervalHours: 2,
        waterStartTime: '09:00',
        waterEndTime: '21:00',
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        timezone: 'Asia/Kolkata',
      };

      const mockApi = {
        getPreferences: vi.fn().mockResolvedValue(mockPref),
        updatePreferences: vi.fn().mockResolvedValue(mockPref),
        sendTestNotification: vi.fn().mockResolvedValue({ status: 'SENT' }),
      } as any;

      let root: any;
      await act(async () => {
        root = ReactTestRenderer.create(
          <ThemeProvider>
            <NotificationPreferencesView notificationClient={mockApi} />
          </ThemeProvider>,
        );
      });

      expect(mockApi.getPreferences).toHaveBeenCalled();

      // Find save button and trigger press
      const saveBtn = root.root.findByProps({ testID: 'save-preferences-btn' });
      expect(saveBtn).toBeDefined();

      await act(async () => {
        saveBtn.props.onPress();
      });

      expect(mockApi.updatePreferences).toHaveBeenCalled();
    });
  });
});
