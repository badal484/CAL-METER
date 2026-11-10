import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, BookOpen, ScanLine, TrendingUp, User } from 'lucide-react-native';
import { useTheme } from '../providers/ThemeProvider';

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const getIcon = (routeName: string, color: string, size: number) => {
    switch (routeName) {
      case 'Home':
        return <House size={size} color={color} strokeWidth={2} />;
      case 'Diary':
        return <BookOpen size={size} color={color} strokeWidth={2} />;
      case 'Scan':
        return <ScanLine size={size} color={color} strokeWidth={2.2} />;
      case 'Progress':
        return <TrendingUp size={size} color={color} strokeWidth={2} />;
      case 'Profile':
        return <User size={size} color={color} strokeWidth={2} />;
      default:
        return null;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.tabBarBackground,
          borderTopColor: theme.colors.tabBarBorder,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) {
          return null;
        }

        const { options } = descriptor;
        const isFocused = state.index === index;
        const isScan = route.name === 'Scan';

        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        if (isScan) {
          return (
            <View key={route.key} style={styles.scanTabSlot}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel="Scan Food or Barcode"
                accessibilityHint="Opens the AI food recognition, barcode scanner, and nutrition label OCR camera"
                testID="tab-scan"
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                  styles.scanButton,
                  {
                    backgroundColor: theme.colors.tabBarActive,
                    transform: [{ scale: pressed ? 0.95 : 1.0 }],
                  },
                  theme.shadows.md,
                ]}
              >
                {getIcon(route.name, theme.colors.background, 24)}
              </Pressable>
              <Text
                style={[
                  styles.scanLabel,
                  {
                    color: isFocused ? theme.colors.tabBarActive : theme.colors.tabBarInactive,
                  },
                ]}
              >
                Scan
              </Text>
            </View>
          );
        }

        const activeColor = theme.colors.tabBarActive;
        const inactiveColor = theme.colors.tabBarInactive;
        const currentColor = isFocused ? activeColor : inactiveColor;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={`${label as string} Tab`}
            testID={`tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [styles.tabItem, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={styles.iconContainer}>{getIcon(route.name, currentColor, 20)}</View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: currentColor,
                  fontWeight: isFocused ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {typeof label === 'string' ? label : route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    minHeight: 64,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingVertical: 2,
  },
  iconContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  scanTabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
  },
  scanButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  scanLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
