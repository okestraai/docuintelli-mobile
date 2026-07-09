import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Users, Crown, X, Mail, LogOut } from 'lucide-react-native';
import Card from '../../src/components/ui/Card';
import Button from '../../src/components/ui/Button';
import LoadingSpinner from '../../src/components/ui/LoadingSpinner';
import { useToast } from '../../src/contexts/ToastContext';
import {
  getFamily, getFamilyInvites, inviteFamilyMember, acceptFamilyInvite,
  declineFamilyInvite, removeFamilyMember, leaveFamily,
  type FamilyOverview, type FamilyInvite, type FamilyPoolUsage,
} from '../../src/lib/familyApi';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing, borderRadius } from '../../src/theme/spacing';

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

function UsageBar({ label, usage }: { label: string; usage: FamilyPoolUsage }) {
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const barColor = pct >= 100 ? colors.error[500] : pct >= 80 ? colors.warning[500] : colors.success[500];
  return (
    <View style={styles.usageRow}>
      <View style={styles.usageLabels}>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>{fmtNum(usage.used)} / {fmtNum(usage.limit)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

export default function FamilyScreen() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, inv] = await Promise.all([getFamily(), getFamilyInvites()]);
      setOverview(o);
      setInvites(inv);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load family', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    try {
      await inviteFamilyMember(trimmed);
      setEmail('');
      showToast(`Invite sent to ${trimmed}`, 'success');
      await load();
    } catch (err: any) {
      showToast(err?.message || 'Failed to send invite', 'error');
    } finally {
      setInviting(false);
    }
  };

  const run = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusyId(id);
    try { await fn(); showToast(ok, 'success'); await load(); }
    catch (err: any) { showToast(err?.message || 'Something went wrong', 'error'); }
    finally { setBusyId(null); }
  };

  const confirmRemove = (id: string, label: string) =>
    Alert.alert('Remove member', `Remove ${label} from your family? They'll move back to the Free plan.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(id, () => removeFamilyMember(id), 'Member removed') },
    ]);

  const confirmLeave = () =>
    Alert.alert('Leave family plan', "You'll move back to the Free plan. Continue?", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => run('leave', () => leaveFamily(), 'You left the family plan') },
    ]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Family' }} />
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.center}><LoadingSpinner /></View>
        </SafeAreaView>
      </>
    );
  }

  const role = overview?.role || 'none';

  return (
    <>
      <Stack.Screen options={{ title: 'Family' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Pending invites inbox */}
          {invites.length > 0 && (
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Mail size={18} color={colors.primary[600]} strokeWidth={2} />
                <Text style={styles.cardTitle}>Family plan invites</Text>
              </View>
              {invites.map((inv) => (
                <View key={inv.id} style={styles.inviteRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.name}>{inv.owner_name}</Text>
                    <Text style={styles.subtle}>{inv.owner_email} invited you</Text>
                  </View>
                  <View style={styles.inviteActions}>
                    <Button
                      title="Accept" size="sm"
                      loading={busyId === `accept:${inv.id}`}
                      disabled={!!busyId && busyId.endsWith(inv.id)}
                      onPress={() => run(`accept:${inv.id}`, () => acceptFamilyInvite(inv.id), 'You joined the family plan')}
                    />
                    <Button
                      title="Decline" size="sm" variant="ghost"
                      loading={busyId === `decline:${inv.id}`}
                      disabled={!!busyId && busyId.endsWith(inv.id)}
                      onPress={() => run(`decline:${inv.id}`, () => declineFamilyInvite(inv.id), 'Invite declined')}
                    />
                  </View>
                </View>
              ))}
            </Card>
          )}

          {/* Owner view */}
          {role === 'owner' && overview && (
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Users size={18} color={colors.primary[600]} strokeWidth={2} />
                <Text style={styles.cardTitle}>Family Members</Text>
              </View>
              <Text style={styles.subtle}>{overview.seatsUsed} of {overview.seatLimit} seats used (including you)</Text>

              <Text style={styles.fieldLabel}>Add a member by email</Text>
              <View style={styles.inviteInputRow}>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.slate[400]}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={overview.seatsUsed < overview.seatLimit}
                />
                <Button
                  title="Invite" size="sm"
                  loading={inviting}
                  disabled={!email.trim() || overview.seatsUsed >= overview.seatLimit}
                  onPress={handleInvite}
                />
              </View>
              <Text style={styles.hint}>They need a free DocuIntelli account. Joining upgrades them to your Family plan.</Text>

              <View style={styles.roster}>
                <View style={styles.memberRow}>
                  <Crown size={16} color={colors.success[600]} strokeWidth={2} />
                  <Text style={styles.memberEmail}>You (owner)</Text>
                </View>
                {overview.members.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <View style={styles.flex1}>
                      <Text style={styles.memberEmail}>{m.email}</Text>
                      <Text style={[styles.badge, m.status === 'active' ? styles.badgeActive : styles.badgePending]}>
                        {m.status === 'active' ? 'Active' : 'Pending'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => confirmRemove(m.id, m.email)} disabled={busyId === m.id} hitSlop={8}>
                      {busyId === m.id
                        ? <ActivityIndicator size="small" color={colors.error[500]} />
                        : <X size={18} color={colors.error[500]} />}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {overview.pool && (
                <View style={styles.usageBlock}>
                  <Text style={styles.usageHeading}>Shared across your family</Text>
                  <UsageBar label="Documents" usage={overview.pool.documents} />
                  <UsageBar label="Uploads this month" usage={overview.pool.uploads} />
                  <UsageBar label="AI tokens this month" usage={overview.pool.tokens} />
                </View>
              )}
            </Card>
          )}

          {/* Member view */}
          {role === 'member' && overview && (
            <Card style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Users size={18} color={colors.primary[600]} strokeWidth={2} />
                <Text style={styles.cardTitle}>Family plan</Text>
              </View>
              <Text style={styles.subtle}>You&apos;re on {overview.owner?.name?.trim() || 'a'}&apos;s Family plan</Text>
              {overview.pool && (
                <View style={styles.usageBlock}>
                  <Text style={styles.usageHeading}>Shared across your family</Text>
                  <UsageBar label="Documents" usage={overview.pool.documents} />
                  <UsageBar label="Uploads this month" usage={overview.pool.uploads} />
                  <UsageBar label="AI tokens this month" usage={overview.pool.tokens} />
                </View>
              )}
              <Button
                title="Leave family plan" variant="outline" icon={<LogOut size={16} color={colors.error[600]} />}
                loading={busyId === 'leave'} onPress={confirmLeave} style={styles.leaveBtn}
              />
            </Card>
          )}

          {/* No family */}
          {role === 'none' && invites.length === 0 && (
            <Card style={styles.card}>
              <View style={styles.center}>
                <Users size={40} color={colors.slate[300]} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>You&apos;re not on a Family plan</Text>
                <Text style={styles.emptyBody}>The Family plan lets you share documents, uploads, and AI usage across up to 5 people.</Text>
                <Button title="View plans" size="sm" onPress={() => router.push('/billing')} style={styles.viewPlansBtn} />
              </View>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  card: { gap: spacing.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  subtle: { fontSize: typography.fontSize.sm, color: colors.slate[500] },
  flex1: { flex: 1, minWidth: 0 },
  name: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  fieldLabel: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[700], marginTop: spacing.sm },
  inviteInputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderColor: colors.slate[300], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.base, color: colors.slate[900],
  },
  hint: { fontSize: typography.fontSize.xs, color: colors.slate[500] },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  inviteActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  roster: { marginTop: spacing.sm, gap: spacing.sm },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  memberEmail: { fontSize: typography.fontSize.base, color: colors.slate[900] },
  badge: { alignSelf: 'flex-start', marginTop: 2, fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: borderRadius.sm, overflow: 'hidden' },
  badgeActive: { color: colors.success[700], backgroundColor: colors.success[50] },
  badgePending: { color: colors.warning[700], backgroundColor: colors.warning[50] },
  usageBlock: { marginTop: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate[100], paddingTop: spacing.md },
  usageHeading: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[800] },
  usageRow: { gap: 4 },
  usageLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  usageLabel: { fontSize: typography.fontSize.sm, color: colors.slate[700], fontWeight: typography.fontWeight.medium },
  usageValue: { fontSize: typography.fontSize.sm, color: colors.slate[500] },
  track: { height: 8, backgroundColor: colors.slate[200], borderRadius: borderRadius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: borderRadius.full },
  leaveBtn: { marginTop: spacing.md },
  emptyTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, color: colors.slate[900], marginTop: spacing.sm },
  emptyBody: { fontSize: typography.fontSize.sm, color: colors.slate[500], textAlign: 'center', paddingHorizontal: spacing.lg },
  viewPlansBtn: { marginTop: spacing.sm },
});
