import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {
  Building2, FileText, Inbox, FileSignature, ChevronRight, Download,
  Upload, X, Check,
} from 'lucide-react-native';
import {
  getSharedDocumentUrl, listSharedDocuments, listMyIntake, fulfilIntake,
  listMySignatures, getSignatureSignedUrl,
  type SharedDocument, type IntakeForMe, type SignatureForMe,
} from '../src/lib/businessSharedApi';
import { BUSINESS_FEATURES_ENABLED } from '../src/lib/config';
import { getDocuments, type SupabaseDocument } from '../src/lib/auth';
import { uploadDocumentFile } from '../src/lib/api';
import InAppBrowser from '../src/components/ui/InAppBrowser';
import Card from '../src/components/ui/Card';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';

type Tab = 'documents' | 'provide' | 'sign';
const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'provide', label: 'To provide', icon: Inbox },
  { key: 'sign', label: 'To sign', icon: FileSignature },
];

const isPdfName = (name: string) => name.toLowerCase().endsWith('.pdf');

/**
 * "From your firms" — the consumer-side hub mirroring the web FirmSharedPage: documents firms have
 * shared with me, documents they've asked me to provide, and signature requests. JWT-only (every
 * call carries the consumer's token). Inert unless BUSINESS_FEATURES_ENABLED. Reached from Settings,
 * gated on getSharedStatus().isClient (see the Settings menu).
 */
export default function FirmHub() {
  const [tab, setTab] = useState<Tab>('documents');

  if (!BUSINESS_FEATURES_ENABLED) {
    return (
      <>
        <Stack.Screen options={{ title: 'From your firms', headerShown: true }} />
        <SafeAreaView style={styles.safe} edges={['bottom']}>
          <View style={styles.center}>
            <Text style={styles.muted}>This feature isn't available in this build.</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'From your firms', headerShown: true }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* In-content header */}
        <View style={styles.pageHeader}>
          <View style={styles.headerIconBox}>
            <Building2 size={22} color={colors.primary[700]} strokeWidth={2} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.pageTitle}>From your firms</Text>
            <Text style={styles.pageSubtitle}>Documents and requests from the firms you work with.</Text>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((x) => {
            const on = x.key === tab;
            const Icon = x.icon;
            return (
              <TouchableOpacity
                key={x.key}
                onPress={() => setTab(x.key)}
                style={[styles.tabBtn, on && styles.tabBtnOn]}
                activeOpacity={0.7}
              >
                <Icon size={15} color={on ? colors.primary[700] : colors.slate[500]} strokeWidth={2} />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{x.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'documents' ? <DocumentsTab /> : tab === 'provide' ? <ToProvideTab /> : <ToSignTab />}
      </SafeAreaView>
    </>
  );
}

// ── Documents shared with me ──────────────────────────────────────────────────
function DocumentsTab() {
  const [docs, setDocs] = useState<SharedDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      const r = await listSharedDocuments();
      setDocs(r.items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function open(d: SharedDocument) {
    setOpening(d.businessDocumentId);
    try {
      const { url } = await getSharedDocumentUrl(d.businessDocumentId);
      setViewer({ url, name: d.name });
    } catch (e: any) {
      Alert.alert('Could not open', e?.message || 'Please try again.');
    } finally {
      setOpening(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;
  if (!docs || docs.length === 0) {
    return <Empty title="Nothing shared yet" hint="Documents firms share with you will appear here." />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} tintColor={colors.primary[600]} />}
      >
        {docs.map((d) => (
          <Card key={d.grantId ?? d.businessDocumentId} style={styles.rowCard}>
            <TouchableOpacity onPress={() => open(d)} style={styles.row} activeOpacity={0.7}>
              <View style={styles.rowIcon}><FileText size={18} color={colors.primary[600]} strokeWidth={2} /></View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{d.name}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {d.category} · from {d.sharedBy}
                </Text>
              </View>
              {opening === d.businessDocumentId
                ? <ActivityIndicator size="small" color={colors.primary[600]} />
                : <ChevronRight size={18} color={colors.slate[400]} />}
            </TouchableOpacity>
          </Card>
        ))}
      </ScrollView>
      <InAppBrowser
        url={viewer?.url ?? null}
        isPdf={viewer ? isPdfName(viewer.name) : false}
        title={viewer?.name}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

// ── To provide (intake requests addressed to me) ──────────────────────────────
function ToProvideTab() {
  const [items, setItems] = useState<IntakeForMe[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providing, setProviding] = useState<IntakeForMe | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      const r = await listMyIntake();
      setItems(r.items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;
  if (!items || items.length === 0) {
    return <Empty title="Nothing to provide" hint="Documents firms ask you to provide will appear here." />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} tintColor={colors.primary[600]} />}
      >
        {items.map((r) => (
          <Card key={r.id} style={styles.rowCard}>
            <View style={styles.row}>
              <View style={styles.rowIcon}><Inbox size={18} color={colors.primary[600]} strokeWidth={2} /></View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  Requested by {r.requestedBy}{r.dueDate ? ` · due ${r.dueDate.slice(0, 10)}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.provideBtn} onPress={() => setProviding(r)} activeOpacity={0.7}>
              <FileText size={14} color={colors.primary[700]} strokeWidth={2.5} />
              <Text style={styles.provideBtnText}>Provide</Text>
            </TouchableOpacity>
          </Card>
        ))}
      </ScrollView>
      <ProvideModal
        request={providing}
        onClose={() => setProviding(null)}
        onDone={() => { setProviding(null); load(); }}
      />
    </>
  );
}

/**
 * Fulfil an intake request. Mirrors consumer web's ProvideModal: provide EITHER an existing vault
 * document OR a freshly-uploaded file (saved to the user's own vault AND linked to the firm's
 * request). fulfilIntake needs a consumer document id the caller owns — the server checks ownership.
 */
function ProvideModal({ request, onClose, onDone }: {
  request: IntakeForMe | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'existing' | 'upload'>('existing');
  const [myDocs, setMyDocs] = useState<SupabaseDocument[] | null>(null);
  const [picked, setPicked] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!request) return;
    // Reset state each time the modal opens for a request.
    setMode('existing'); setPicked(null); setSelectedId(''); setError(null); setDone(false); setMyDocs(null);
    getDocuments()
      .then((d) => { setMyDocs(d); if (d.length === 0) setMode('upload'); })
      .catch(() => setMyDocs([]));
  }, [request]);

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const f = res.assets[0];
    setPicked({ uri: f.uri, name: f.name, mimeType: f.mimeType ?? 'application/octet-stream' });
  }

  const canSubmit = mode === 'existing' ? Boolean(selectedId) : Boolean(picked);

  async function submit() {
    if (!request || busy || !canSubmit) return;
    setBusy(true); setError(null);
    try {
      let documentId = selectedId;
      if (mode === 'upload' && picked) {
        const up = await uploadDocumentFile(picked.uri, picked.name, picked.mimeType, picked.name.replace(/\.[^/.]+$/, ''), 'other');
        if (!up.success || !up.data?.document_id) throw new Error(up.error || 'Could not upload the file');
        documentId = up.data.document_id;
      }
      await fulfilIntake(request.id, documentId);
      setDone(true);
      setTimeout(onDone, 900);
    } catch (e: any) {
      setError(e?.message || 'Could not provide this document');
      setBusy(false);
    }
  }

  return (
    <Modal visible={request !== null} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Provide a document</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.modalClose}><X size={20} color={colors.slate[500]} /></TouchableOpacity>
        </View>

        {done ? (
          <View style={styles.center}>
            <View style={styles.doneCircle}><Check size={24} color={colors.primary[600]} /></View>
            <Text style={styles.doneTitle}>Provided</Text>
            <Text style={styles.muted}>{request?.requestedBy} can now see your document.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.modalBody}>
            {request && (
              <View style={styles.requestBox}>
                <Text style={styles.rowTitle}>{request.title}</Text>
                <Text style={styles.rowSub}>Requested by {request.requestedBy}</Text>
              </View>
            )}

            {/* Mode toggle */}
            <View style={styles.modeRow}>
              <TouchableOpacity onPress={() => setMode('existing')} style={[styles.modeBtn, mode === 'existing' && styles.modeBtnOn]} activeOpacity={0.7}>
                <FileText size={15} color={mode === 'existing' ? colors.primary[700] : colors.slate[500]} />
                <Text style={[styles.modeText, mode === 'existing' && styles.modeTextOn]}>From your vault</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('upload')} style={[styles.modeBtn, mode === 'upload' && styles.modeBtnOn]} activeOpacity={0.7}>
                <Upload size={15} color={mode === 'upload' ? colors.primary[700] : colors.slate[500]} />
                <Text style={[styles.modeText, mode === 'upload' && styles.modeTextOn]}>Upload a file</Text>
              </TouchableOpacity>
            </View>

            {mode === 'existing' ? (
              myDocs === null ? (
                <Loading />
              ) : myDocs.length === 0 ? (
                <Text style={styles.muted}>Your vault is empty — switch to "Upload a file".</Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {myDocs.map((d) => {
                    const on = selectedId === d.id;
                    return (
                      <TouchableOpacity key={d.id} onPress={() => setSelectedId(d.id)} style={[styles.docPick, on && styles.docPickOn]} activeOpacity={0.7}>
                        <FileText size={16} color={on ? colors.primary[600] : colors.slate[400]} />
                        <Text style={[styles.docPickText, on && styles.docPickTextOn]} numberOfLines={1}>{d.name}</Text>
                        {on && <Check size={16} color={colors.primary[600]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )
            ) : (
              <TouchableOpacity onPress={pickFile} style={styles.uploadBox} activeOpacity={0.7}>
                <Upload size={20} color={colors.slate[400]} />
                <Text style={styles.uploadText}>{picked ? picked.name : 'Choose a file to upload'}</Text>
                <Text style={styles.uploadHint}>Saved to your vault and provided to the firm</Text>
              </TouchableOpacity>
            )}

            {error && <Text style={styles.danger}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryBtn, (!canSubmit || busy) && styles.btnDisabled]}
              disabled={!canSubmit || busy}
              onPress={submit}
              activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>{mode === 'upload' ? 'Upload & provide' : 'Provide'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── To sign (reuses the firm-sign ceremony + signed-copy download) ────────────
function ToSignTab() {
  const [items, setItems] = useState<SignatureForMe[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setLoading(true);
    setError(null);
    try {
      const r = await listMySignatures();
      setItems(r.items);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);
  // Refresh on focus so a just-signed item shows its new status when returning from firm-sign.
  useFocusEffect(useCallback(() => { load(true); }, [load]));
  useEffect(() => { load(); }, [load]);

  async function download(item: SignatureForMe) {
    setDownloading(item.id);
    try {
      const { url } = await getSignatureSignedUrl(item.id);
      setViewer({ url, name: item.documentName });
    } catch (e: any) {
      Alert.alert('Not ready', e?.message || 'The signed copy is not ready yet.');
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={() => load()} />;
  if (!items || items.length === 0) {
    return <Empty title="Nothing to sign" hint="Documents awaiting your signature will appear here." />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(true)} tintColor={colors.primary[600]} />}
      >
        {items.map((s) => {
          const pending = s.status !== 'completed' && s.status !== 'declined' && s.status !== 'voided';
          return (
            <Card key={s.id} style={styles.rowCard}>
              <TouchableOpacity
                // Typed routes are stale for firm-* paths (see src/services/deepLinking.ts) — cast, as the repo does.
                onPress={() => router.push({ pathname: '/firm-sign/[ref]', params: { ref: s.id, env: s.isEnvelope ? '1' : '0' } } as any)}
                style={styles.row}
                activeOpacity={0.7}
              >
                <View style={styles.rowIcon}>
                  <FileSignature size={18} color={pending ? colors.primary[600] : colors.slate[400]} strokeWidth={2} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{s.documentName}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    From {s.requestedBy} · {s.status}{s.expiresAt ? ` · expires ${s.expiresAt.slice(0, 10)}` : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.slate[400]} />
              </TouchableOpacity>
              {s.signedCopyReady && (
                <TouchableOpacity
                  onPress={() => download(s)}
                  disabled={downloading === s.id}
                  style={styles.downloadBtn}
                  activeOpacity={0.7}
                >
                  {downloading === s.id
                    ? <ActivityIndicator size="small" color={colors.primary[600]} />
                    : <Download size={16} color={colors.primary[600]} />}
                  <Text style={styles.downloadText}>Download signed copy</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}
      </ScrollView>
      <InAppBrowser
        url={viewer?.url ?? null}
        isPdf={viewer ? isPdfName(viewer.name) : false}
        title={viewer?.name}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

// ── Shared small bits ─────────────────────────────────────────────────────────
function Loading() {
  return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary[600]} /></View>;
}
function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.muted}>{hint}</Text>
    </View>
  );
}
function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.danger}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryBtn} activeOpacity={0.7}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  muted: { fontSize: typography.fontSize.sm, color: colors.slate[500], textAlign: 'center' },
  danger: { fontSize: typography.fontSize.sm, color: colors.error[600], fontWeight: typography.fontWeight.medium, textAlign: 'center' },

  // Page header
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md },
  headerIconBox: {
    width: 44, height: 44, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center',
  },
  headerTextCol: { flex: 1 },
  pageTitle: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.slate[900] },
  pageSubtitle: { fontSize: typography.fontSize.sm, color: colors.slate[500], marginTop: 2 },

  // Tab bar
  tabBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate[200],
  },
  tabBtnOn: { backgroundColor: colors.primary[50], borderColor: colors.primary[200] },
  tabText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.slate[500] },
  tabTextOn: { color: colors.primary[700] },

  // List
  list: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm, flexGrow: 1 },
  rowCard: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  rowSub: { fontSize: typography.fontSize.xs, color: colors.slate[500], marginTop: 2, textTransform: 'capitalize' },

  // Provide button (in "To provide" card)
  provideBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate[100],
  },
  provideBtnText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[700] },

  // Download button (in "To sign" card)
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.slate[100],
  },
  downloadText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[600] },

  // Empty / error
  emptyBox: {
    margin: spacing.lg, alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing['3xl'], paddingHorizontal: spacing.xl,
    backgroundColor: colors.white, borderRadius: borderRadius['2xl'],
    borderWidth: 1, borderColor: colors.slate[200],
  },
  emptyTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  retryBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.primary[50] },
  retryText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.primary[700] },

  // Provide modal
  modalSafe: { flex: 1, backgroundColor: colors.slate[50] },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.slate[100],
  },
  modalTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  modalClose: { padding: 4 },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  requestBox: { backgroundColor: colors.slate[100], borderRadius: borderRadius.lg, padding: spacing.md },

  modeRow: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.slate[100], borderRadius: borderRadius.lg, padding: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  modeBtnOn: { backgroundColor: colors.white },
  modeText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, color: colors.slate[500] },
  modeTextOn: { color: colors.slate[900] },

  docPick: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.slate[200], backgroundColor: colors.white,
  },
  docPickOn: { borderColor: colors.primary[400], backgroundColor: colors.primary[50] },
  docPickText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.slate[700] },
  docPickTextOn: { color: colors.slate[900], fontWeight: typography.fontWeight.medium },

  uploadBox: {
    alignItems: 'center', gap: 4, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    borderWidth: 2, borderColor: colors.slate[300], borderStyle: 'dashed', borderRadius: borderRadius.xl,
  },
  uploadText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.slate[700], textAlign: 'center' },
  uploadHint: { fontSize: typography.fontSize.xs, color: colors.slate[400], textAlign: 'center' },

  primaryBtn: {
    backgroundColor: colors.primary[600], borderRadius: borderRadius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.white, fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold },
  btnDisabled: { opacity: 0.5 },

  doneCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary[50],
    alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
});
