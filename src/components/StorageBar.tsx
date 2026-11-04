import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors } from '../theme/colors';
import { formatStorage, useStorage } from '../lib/freePlan';

/** Storage used on the storage-based Free plan. Shows nothing until the figure has loaded. */
export default function StorageBar({ refreshKey }: { refreshKey?: unknown }) {
  const { storage, failed, retry } = useStorage(true, refreshKey);

  // An append or finished processing changes the figure without changing the document count.
  useFocusEffect(useCallback(() => retry(), []));

  if (failed && !storage) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>Storage</Text>
        <TouchableOpacity onPress={retry} accessibilityRole="button">
          <Text style={styles.retry}>Couldn't load. Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!storage || !storage.limitBytes) return null;

  const percent = Math.min((storage.usedBytes / storage.limitBytes) * 100, 100);
  const over = storage.usedBytes > storage.limitBytes;

  return (
    <View accessibilityLabel={`Storage used ${Math.round(percent)} percent`}>
      <View style={styles.row}>
        <Text style={styles.label}>Storage</Text>
        <Text style={styles.value}>
          {formatStorage(storage.usedBytes)} / {formatStorage(storage.limitBytes)}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(2, percent)}%`, backgroundColor: percent >= 80 ? colors.error[500] : colors.primary[600] },
          ]}
        />
      </View>
      {over && <Text style={styles.over}>You're over your storage. Your documents still work, but new uploads need more space.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.slate[700] },
  value: { fontSize: 13, fontWeight: '600', color: colors.slate[900] },
  retry: { fontSize: 13, color: colors.primary[600], textDecorationLine: 'underline' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.slate[200], overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  over: { marginTop: 6, fontSize: 12, color: colors.error[600] },
});
