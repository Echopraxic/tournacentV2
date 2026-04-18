// Tournacent Design System (Full)
// React Native + Expo + Reanimated + Variant System

import React, { createContext, useContext } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// ------------------ DESIGN TOKENS ------------------

export const tokens = {
  colors: {
    dark: {
      background: '#0B0F14',
      surface: '#121821',
      primary: '#00E38C',
      text: '#FFFFFF',
      subtext: '#8A94A6',
      danger: '#FF5C5C',
    },
    light: {
      background: '#F7F9FC',
      surface: '#FFFFFF',
      primary: '#00A86B',
      text: '#0F172A',
      subtext: '#5B6472',
      danger: '#DC2626',
    },
  },
  spacing: [4, 8, 12, 16, 20, 24, 32],
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
  },
};

// ------------------ THEME CONTEXT ------------------

const ThemeContext = createContext(tokens.colors.dark);

export const ThemeProvider = ({ children, mode = 'dark' }) => {
  const theme = tokens.colors[mode];
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// ------------------ BUTTON ------------------

export const Button = ({ title, onPress, variant = 'primary' }) => {
  const theme = useTheme();

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const variants = {
    primary: { backgroundColor: theme.primary, color: '#000' },
    secondary: { borderWidth: 1, borderColor: theme.subtext, color: theme.text },
    danger: { backgroundColor: theme.danger, color: '#fff' },
  };

  const style = variants[variant];

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          padding: 14,
          borderRadius: 16,
          alignItems: 'center',
          ...style,
        }}
      >
        <Text style={{ color: style.color, fontWeight: '600' }}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ------------------ CARD ------------------

export const Card = ({ children }) => {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
      }}
    >
      {children}
    </View>
  );
};

// ------------------ PROGRESS BAR ------------------

export const ProgressBar = ({ progress }) => {
  const theme = useTheme();

  return (
    <View style={{ height: 6, backgroundColor: '#333', borderRadius: 999 }}>
      <View
        style={{
          width: `${progress * 100}%`,
          height: 6,
          backgroundColor: theme.primary,
          borderRadius: 999,
        }}
      />
    </View>
  );
};

// ------------------ SWIPEABLE TASK CARD ------------------

export const TaskCard = ({ title, points, onComplete }) => {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleSwipe = () => {
    translateX.value = withSpring(200);
    onComplete();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onLongPress={handleSwipe}
        style={{
          backgroundColor: theme.surface,
          padding: 16,
          borderRadius: 16,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: theme.text, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: theme.subtext }}>+{points} pts</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ------------------ LEADERBOARD ROW (ANIMATED) ------------------

export const LeaderboardRow = ({ rank, name, points }) => {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12 }}>
        <Text style={{ color: theme.text }}>#{rank}</Text>
        <Text style={{ color: theme.text }}>{name}</Text>
        <Text style={{ color: theme.primary }}>{points}</Text>
      </View>
    </Animated.View>
  );
};

// ------------------ BALANCE DISPLAY ------------------

export const BalanceDisplay = ({ amount }) => {
  const theme = useTheme();

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: theme.subtext }}>Balance</Text>
      <Text style={{ color: theme.text, fontSize: 32, fontWeight: '700' }}>
        ${amount}
      </Text>
    </View>
  );
};

// ------------------ EXPORT ------------------

export default {
  ThemeProvider,
  Button,
  Card,
  ProgressBar,
  TaskCard,
  LeaderboardRow,
  BalanceDisplay,
};
