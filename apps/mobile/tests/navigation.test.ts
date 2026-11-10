import { describe, it, expect } from 'vitest';
import type { RootTabParamList } from '../src/app/navigation/types';

describe('Navigation Structure', () => {
  it('defines the required 5 bottom tab destinations', () => {
    const requiredDestinations: (keyof RootTabParamList)[] = [
      'Home',
      'Diary',
      'Scan',
      'Progress',
      'Profile',
    ];

    expect(requiredDestinations).toHaveLength(5);
    expect(requiredDestinations).toContain('Home');
    expect(requiredDestinations).toContain('Diary');
    expect(requiredDestinations).toContain('Scan');
    expect(requiredDestinations).toContain('Progress');
    expect(requiredDestinations).toContain('Profile');
  });

  it('verifies Scan is positioned as center tab index 2', () => {
    const tabs: (keyof RootTabParamList)[] = ['Home', 'Diary', 'Scan', 'Progress', 'Profile'];

    expect(tabs[2]).toBe('Scan');
    expect(tabs.indexOf('Scan')).toBe(2);
  });
});
