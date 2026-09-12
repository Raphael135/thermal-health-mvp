import {
  ActivityIndicator,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
} from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/typography';

export function Screen({ style, ...props }: ViewProps) {
  return (
    <View
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      {...props}
    />
  );
}

export function Heading({ style, ...props }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary }, style]}
      {...props}
    />
  );
}

export function Subtitle({ style, ...props }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }, style]}
      {...props}
    />
  );
}

export function Label({ style, ...props }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }, style]}
      {...props}
    />
  );
}

export function BodyText({ style, ...props }: TextProps) {
  return <Text style={[{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }, style]} {...props} />;
}

export function AppTextInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
        },
        style,
      ]}
      {...props}
    />
  );
}

interface AppButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function AppButton({ label, loading, variant = 'primary', style, disabled, ...props }: AppButtonProps) {
  const backgrounds = {
    primary: colors.primary,
    secondary: colors.textPrimary,
    ghost: 'transparent',
  } as const;
  const textColors = {
    primary: colors.surface,
    secondary: colors.surface,
    ghost: colors.primaryDark,
  } as const;

  return (
    <TouchableOpacity
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: backgrounds[variant],
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || loading ? 0.6 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} />
      ) : (
        <Text style={{ fontFamily: fonts.semiBold, fontSize: 15, color: textColors[variant] }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ style, ...props }: ViewProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 18,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function ErrorText({ style, ...props }: TextProps) {
  return <Text style={[{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }, style]} {...props} />;
}
