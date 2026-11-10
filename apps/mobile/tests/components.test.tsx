import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { Button, Card, ProgressIndicator, MacroIndicator, TextInput } from '../src/components';
import { Text, Pressable, ActivityIndicator, TextInput as RNTextInput, View } from 'react-native';

const renderWithTheme = (ui: React.ReactElement) => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<ThemeProvider initialMode="light">{ui}</ThemeProvider>);
  });
  return renderer!;
};

describe('UI Component: Button', () => {
  it('renders button title and triggers onPress when clicked', () => {
    const handlePress = vi.fn();
    const tree = renderWithTheme(<Button title="Log Meal" onPress={handlePress} />);

    const pressable = tree.root.findByType(Pressable);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Log Meal');

    act(() => {
      pressable.props.onPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onPress when disabled', () => {
    const handlePress = vi.fn();
    const tree = renderWithTheme(
      <Button title="Save Entry" onPress={handlePress} disabled={true} />,
    );

    const pressable = tree.root.findByType(Pressable);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toMatchObject({ disabled: true });
    expect(pressable.props.onPress).toBeUndefined();
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('renders ActivityIndicator when loading=true and disables button', () => {
    const handlePress = vi.fn();
    const tree = renderWithTheme(
      <Button title="Uploading..." onPress={handlePress} loading={true} />,
    );

    const pressable = tree.root.findByType(Pressable);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.onPress).toBeUndefined();

    const indicator = tree.root.findByType(ActivityIndicator);
    expect(indicator).toBeDefined();
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('renders left and right icons when provided', () => {
    const tree = renderWithTheme(
      <Button
        title="With Icons"
        onPress={() => {}}
        leftIcon={<Text testID="left-icon">L</Text>}
        rightIcon={<Text testID="right-icon">R</Text>}
      />,
    );

    expect(tree.root.findByProps({ testID: 'left-icon' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'right-icon' })).toBeDefined();
  });
});

describe('UI Component: ProgressIndicator & Numeric Edge Cases', () => {
  it('renders progress bar clamped accurately for normal ranges', () => {
    const tree = renderWithTheme(
      <ProgressIndicator current={1400} target={2000} label="Calories" unit="kcal" />,
    );

    const container = tree.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(container.props.accessibilityValue).toEqual({
      min: 0,
      max: 2000,
      now: 1400,
      text: '70% completed',
    });
  });

  it('clamps progress ratio when current exceeds target (overflow)', () => {
    const tree = renderWithTheme(
      <ProgressIndicator current={2500} target={2000} label="Calories" />,
    );

    const container = tree.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(container.props.accessibilityValue.text).toBe('100% completed');
  });

  it('clamps progress ratio to 0% for negative current values', () => {
    const tree = renderWithTheme(
      <ProgressIndicator current={-500} target={2000} label="Calories" />,
    );

    const container = tree.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(container.props.accessibilityValue.min).toBe(0);
    expect(container.props.accessibilityValue.now).toBe(0);
    expect(container.props.accessibilityValue.text).toBe('0% completed');
  });

  it('handles zero and negative targets safely without divide-by-zero or NaN', () => {
    const treeZero = renderWithTheme(
      <ProgressIndicator current={500} target={0} label="Zero Target" />,
    );
    const containerZero = treeZero.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(containerZero.props.accessibilityValue.text).toBe('0% completed');
    expect(containerZero.props.accessibilityValue.max).toBe(0);

    const treeNegative = renderWithTheme(
      <ProgressIndicator current={500} target={-100} label="Negative Target" />,
    );
    const containerNegative = treeNegative.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(containerNegative.props.accessibilityValue.text).toBe('0% completed');
    expect(containerNegative.props.accessibilityValue.max).toBe(0);
  });

  it('safely handles non-finite inputs (NaN, Infinity, -Infinity)', () => {
    const treeNaN = renderWithTheme(
      <ProgressIndicator current={NaN} target={2000} label="NaN Test" />,
    );
    const containerNaN = treeNaN.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(containerNaN.props.accessibilityValue.now).toBe(0);
    expect(containerNaN.props.accessibilityValue.text).toBe('0% completed');

    const treeInf = renderWithTheme(
      <ProgressIndicator current={Infinity} target={NaN} label="Infinity Test" />,
    );
    const containerInf = treeInf.root.findByProps({ accessibilityRole: 'progressbar' });
    expect(containerInf.props.accessibilityValue.now).toBe(0);
    expect(containerInf.props.accessibilityValue.max).toBe(0);
    expect(containerInf.props.accessibilityValue.text).toBe('0% completed');
  });
});

describe('UI Component: MacroIndicator', () => {
  it('renders all three macronutrients with accurate percentages and labels', () => {
    const mockMacros = {
      protein: { label: 'Protein', currentGrams: 120, targetGrams: 160 },
      carbs: { label: 'Carbs', currentGrams: 200, targetGrams: 220 },
      fat: { label: 'Fat', currentGrams: 55, targetGrams: 65 },
    };

    const tree = renderWithTheme(
      <MacroIndicator protein={mockMacros.protein} carbs={mockMacros.carbs} fat={mockMacros.fat} />,
    );

    const columns = tree.root.findAll(
      (node: ReactTestRenderer.ReactTestInstance) =>
        node.type === (View as unknown) &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.includes('grams'),
    );
    expect(columns).toHaveLength(3);

    expect(columns[0]!.props.accessibilityLabel).toBe('Protein: 120 of 160 grams, 75%');
    expect(columns[1]!.props.accessibilityLabel).toBe('Carbs: 200 of 220 grams, 91%');
    expect(columns[2]!.props.accessibilityLabel).toBe('Fat: 55 of 65 grams, 85%');
  });

  it('safely handles non-finite (NaN, Infinity) and zero targets in macros', () => {
    const edgeMacros = {
      protein: { label: 'Protein', currentGrams: NaN, targetGrams: 150 },
      carbs: { label: 'Carbs', currentGrams: 100, targetGrams: 0 },
      fat: { label: 'Fat', currentGrams: -20, targetGrams: -50 },
    };

    const tree = renderWithTheme(
      <MacroIndicator protein={edgeMacros.protein} carbs={edgeMacros.carbs} fat={edgeMacros.fat} />,
    );

    const columns = tree.root.findAll(
      (node: ReactTestRenderer.ReactTestInstance) =>
        node.type === (View as unknown) &&
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.includes('grams'),
    );
    expect(columns).toHaveLength(3);
    expect(columns[0]!.props.accessibilityLabel).toBe('Protein: 0 of 150 grams, 0%');
    expect(columns[1]!.props.accessibilityLabel).toBe('Carbs: 100 of 0 grams, 0%');
    expect(columns[2]!.props.accessibilityLabel).toBe('Fat: 0 of 0 grams, 0%');
  });
});

describe('UI Component: TextInput', () => {
  it('renders input with label and forwards text change events', () => {
    const handleChangeText = vi.fn();
    const tree = renderWithTheme(
      <TextInput
        label="Food Name"
        value="Oatmeal"
        onChangeText={handleChangeText}
        placeholder="Enter food name"
      />,
    );

    const input = tree.root.findByType(RNTextInput);
    expect(input.props.value).toBe('Oatmeal');
    expect(input.props.placeholder).toBe('Enter food name');

    act(() => {
      input.props.onChangeText('Blueberry Oatmeal');
    });

    expect(handleChangeText).toHaveBeenCalledWith('Blueberry Oatmeal');
  });

  it('displays validation error message when errorMessage is provided', () => {
    const tree = renderWithTheme(
      <TextInput
        label="Calorie Target"
        value="-100"
        errorMessage="Target must be greater than zero"
      />,
    );

    const input = tree.root.findByType(RNTextInput);
    expect(input.props.value).toBe('-100');

    const errorText = tree.root.findAllByProps({ children: 'Target must be greater than zero' });
    expect(errorText.length).toBeGreaterThan(0);
  });
});

describe('UI Component: Card', () => {
  it('renders pressable card when onPress is provided and handles click', () => {
    const handlePress = vi.fn();
    const tree = renderWithTheme(
      <Card onPress={handlePress} accessibilityLabel="Breakfast Card">
        <Text>Breakfast Content</Text>
      </Card>,
    );

    const pressable = tree.root.findByType(Pressable);
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Breakfast Card');

    act(() => {
      pressable.props.onPress();
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('renders static View when onPress is omitted', () => {
    const tree = renderWithTheme(
      <Card>
        <Text>Static Card Content</Text>
      </Card>,
    );

    const pressables = tree.root.findAllByType(Pressable);
    expect(pressables).toHaveLength(0);
  });
});
