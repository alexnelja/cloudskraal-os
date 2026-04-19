import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestNotificationPermission,
  isNotificationEnabled,
  sendNotification,
  notifyOverdueTasks,
  notifyWeatherUnblock,
} from './notifications';

const mockNotification = vi.fn();

function stubNotification(permission: NotificationPermission, requestResult?: NotificationPermission) {
  vi.stubGlobal(
    'Notification',
    Object.assign(mockNotification, {
      permission,
      requestPermission: vi.fn().mockResolvedValue(requestResult ?? permission),
    }),
  );
}

beforeEach(() => {
  mockNotification.mockClear();
});

describe('requestNotificationPermission', () => {
  it('returns true when already granted', async () => {
    stubNotification('granted');
    expect(await requestNotificationPermission()).toBe(true);
  });

  it('returns false when denied', async () => {
    stubNotification('denied');
    expect(await requestNotificationPermission()).toBe(false);
  });

  it('requests permission when default and returns true if granted', async () => {
    stubNotification('default', 'granted');
    expect(await requestNotificationPermission()).toBe(true);
    expect(Notification.requestPermission).toHaveBeenCalled();
  });

  it('returns false when user denies the prompt', async () => {
    stubNotification('default', 'denied');
    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('isNotificationEnabled', () => {
  it('returns true when granted', () => {
    stubNotification('granted');
    expect(isNotificationEnabled()).toBe(true);
  });

  it('returns false when denied', () => {
    stubNotification('denied');
    expect(isNotificationEnabled()).toBe(false);
  });
});

describe('sendNotification', () => {
  it('creates a Notification with correct title and options', () => {
    stubNotification('granted');
    sendNotification('Test Title', { body: 'Test body' });
    expect(mockNotification).toHaveBeenCalledWith('Test Title', {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      body: 'Test body',
    });
  });

  it('does nothing when permission is not granted', () => {
    stubNotification('denied');
    sendNotification('Ignored');
    expect(mockNotification).not.toHaveBeenCalled();
  });
});

describe('notifyOverdueTasks', () => {
  it('sends notification with singular when count is 1', () => {
    stubNotification('granted');
    notifyOverdueTasks(1);
    expect(mockNotification).toHaveBeenCalledWith('1 overdue task', expect.objectContaining({
      body: 'Check your task list for items past due.',
      tag: 'overdue-reminder',
    }));
  });

  it('sends notification with plural when count > 1', () => {
    stubNotification('granted');
    notifyOverdueTasks(3);
    expect(mockNotification).toHaveBeenCalledWith('3 overdue tasks', expect.objectContaining({
      tag: 'overdue-reminder',
    }));
  });
});

describe('notifyWeatherUnblock', () => {
  it('sends notification with field name and condition', () => {
    stubNotification('granted');
    notifyWeatherUnblock('Block A', 'Wind below 15 km/h');
    expect(mockNotification).toHaveBeenCalledWith('Spray window open — Block A', expect.objectContaining({
      body: 'Wind below 15 km/h. Tasks unblocked.',
      tag: 'weather-Block A',
    }));
  });
});
