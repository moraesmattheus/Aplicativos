// Pequenos componentes de UI reutilizáveis, tematizados (claro/escuro).

import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useTheme();
  return <Text style={[styles.section, { color: c.text }, style]}>{children}</Text>;
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useTheme();
  return (
    <Text style={[styles.muted, { color: c.textSecondary }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Chip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'ok' | 'miss';
}) {
  const c = useTheme();
  const bg =
    tone === 'ok' ? 'rgba(48,209,88,0.15)' : tone === 'miss' ? 'rgba(217,45,32,0.12)' : c.backgroundSelected;
  const fg = tone === 'ok' ? c.success : tone === 'miss' ? c.danger : c.textSecondary;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  const c = useTheme();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.barTrack, { backgroundColor: c.backgroundSelected }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color ?? c.tint }]} />
    </View>
  );
}

/** Badge circular com a % de match, cor conforme a faixa. */
export function ScoreBadge({ score, color }: { score: number; color: string }) {
  return (
    <View style={[styles.scoreBadge, { borderColor: color }]}>
      <Text style={[styles.scoreText, { color }]}>{score}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  section: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  muted: {
    fontSize: 13,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: 160,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    flex: 1,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  scoreBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
