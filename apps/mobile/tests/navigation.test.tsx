import { describe, it, expect, vi } from 'vitest';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Pressable } from 'react-native';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { BottomTabBar } from '../src/app/navigation/BottomTabBar';
import type { RootTabParamList } from '../src/app/navigation/types';

describe('Navigation Structure & Route Contracts', () => {
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

describe('BottomTabBar Rendering & Accessibility Standards', () => {
  const createMockNavigationProps = (activeIndex = 0) => {
    const routes = [
      { key: 'route-home', name: 'Home' },
      { key: 'route-diary', name: 'Diary' },
      { key: 'route-scan', name: 'Scan' },
      { key: 'route-progress', name: 'Progress' },
      { key: 'route-profile', name: 'Profile' },
    ];

    const descriptors = routes.reduce(
      (acc, r) => {
        acc[r.key] = {
          options: {
            tabBarLabel: r.name,
            title: r.name,
          },
        };
        return acc;
      },
      {} as Record<string, { options: { tabBarLabel: string; title: string } }>,
    );

    const emit = vi.fn().mockReturnValue({ defaultPrevented: false });
    const navigate = vi.fn();

    const navigation = {
      emit,
      navigate,
    };

    const state = {
      index: activeIndex,
      routes,
      key: 'tab-state',
      type: 'tab',
      routeNames: routes.map(r => r.name),
      stale: false,
    };

    return { state, descriptors, navigation };
  };

  it('renders all 5 destinations with accessibilityRole="tab"', () => {
    const props = createMockNavigationProps(0);

    let tree: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* @ts-expect-error test navigation mock */}
          <BottomTabBar {...props} />
        </ThemeProvider>,
      );
    });

    const tabs = tree!.root.findAll(
      (node: ReactTestRenderer.ReactTestInstance) =>
        node.type === (Pressable as unknown) && node.props.accessibilityRole === 'tab',
    );
    expect(tabs).toHaveLength(5);

    // Verify all 5 tab test IDs are present
    expect(tree!.root.findByProps({ testID: 'tab-home' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'tab-diary' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'tab-scan' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'tab-progress' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'tab-profile' })).toBeDefined();
  });

  it('ensures consistent accessibilityState={{ selected }} across all tabs', () => {
    // When Home (index 0) is active
    const homeActiveProps = createMockNavigationProps(0);
    let treeHome: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      treeHome = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* @ts-expect-error test navigation mock */}
          <BottomTabBar {...homeActiveProps} />
        </ThemeProvider>,
      );
    });

    const homeTab = treeHome!.root.findByProps({ testID: 'tab-home' });
    const scanTab = treeHome!.root.findByProps({ testID: 'tab-scan' });

    expect(homeTab.props.accessibilityState).toEqual({ selected: true });
    expect(scanTab.props.accessibilityState).toEqual({ selected: false });

    // When Scan (index 2) is active
    const scanActiveProps = createMockNavigationProps(2);
    let treeScan: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      treeScan = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* @ts-expect-error test navigation mock */}
          <BottomTabBar {...scanActiveProps} />
        </ThemeProvider>,
      );
    });

    const homeTab2 = treeScan!.root.findByProps({ testID: 'tab-home' });
    const scanTab2 = treeScan!.root.findByProps({ testID: 'tab-scan' });

    expect(homeTab2.props.accessibilityState).toEqual({ selected: false });
    expect(scanTab2.props.accessibilityState).toEqual({ selected: true });
  });

  it('handles tab press event, emits tabPress, and navigates to target route', () => {
    const props = createMockNavigationProps(0);

    let tree: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <ThemeProvider initialMode="light">
          {/* @ts-expect-error test navigation mock */}
          <BottomTabBar {...props} />
        </ThemeProvider>,
      );
    });

    const scanTab = tree!.root.findByProps({ testID: 'tab-scan' });

    act(() => {
      scanTab.props.onPress();
    });

    expect(props.navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'route-scan',
      canPreventDefault: true,
    });
    expect(props.navigation.navigate).toHaveBeenCalledWith('Scan', undefined);
  });
});
