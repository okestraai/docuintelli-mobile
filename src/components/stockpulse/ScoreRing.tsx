import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function getScoreColor(score: number): string {
  if (score >= 80) return colors.primary[600];
  if (score >= 60) return colors.teal[600];
  if (score >= 40) return '#d97706'; // amber
  if (score >= 20) return '#ea580c'; // orange
  return colors.error[600];
}

interface ScoreRingProps {
  score: number;
  size?: number;
}

export default function ScoreRing({ score, size = 48 }: ScoreRingProps) {
  const color = getScoreColor(score);
  const borderWidth = size >= 48 ? 3 : 2;

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.score, { color, fontSize: size >= 48 ? 16 : 12 }]}>
        {Math.round(score)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  score: {
    fontWeight: typography.fontWeight.bold,
  },
});
