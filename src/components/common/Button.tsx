import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator, View, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { colors, spacing, roundness, typography, palette } = useTheme();

  const handlePress = () => {
    if (!loading && !disabled) {
      onPress();
    }
  };

  const getButtonStyles = (): ViewStyle => {
    const base: ViewStyle = {
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      borderRadius: roundness.lg,
    };

    // Padding based on size
    switch (size) {
      case 'sm':
        base.paddingVertical = spacing.sm;
        base.paddingHorizontal = spacing.md;
        break;
      case 'lg':
        base.paddingVertical = spacing.lg;
        base.paddingHorizontal = spacing.xxl;
        break;
      case 'md':
      default:
        base.paddingVertical = spacing.md;
        base.paddingHorizontal = spacing.xl;
        break;
    }

    // Color based on variant (non-gradient variants)
    if (variant === 'primary') {
      base.backgroundColor = colors.primary;
    } else if (variant === 'secondary') {
      base.backgroundColor = colors.surfaceSecondary;
    } else if (variant === 'outline') {
      base.backgroundColor = 'transparent';
      base.borderWidth = 1;
      base.borderColor = colors.border;
    } else if (variant === 'ghost') {
      base.backgroundColor = 'transparent';
    }

    if (disabled) {
      base.opacity = 0.5;
    }

    return base;
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontSize: size === 'sm' ? typography.sizes.sm : typography.sizes.md,
      fontWeight: typography.weights.semibold,
      textAlign: 'center',
    };

    if (variant === 'primary' || variant === 'gradient') {
      base.color = palette.white;
    } else if (variant === 'outline' || variant === 'ghost') {
      base.color = colors.primary;
    } else if (variant === 'secondary') {
      base.color = colors.text;
    }

    return base;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'gradient' ? palette.white : colors.primary}
        />
      );
    }

    return <Text style={[getTextStyle(), textStyle]}>{title}</Text>;
  };

  if (variant === 'gradient' && !disabled) {
    const btnStyle = getButtonStyles();
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={[styles.gradientWrapper, style]}
      >
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientMiddle, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[btnStyle, styles.gradientBg]}
        >
          {renderContent()}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[getButtonStyles(), style]}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gradientWrapper: {
    overflow: 'hidden',
  },
  gradientBg: {
    width: '100%',
  },
});
export default Button;
