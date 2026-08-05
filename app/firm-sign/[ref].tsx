import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import SignatureInput from '../../src/components/esign/SignatureInput';
import InAppBrowser from '../../src/components/ui/InAppBrowser';
import {
  completeSigner, declineEnvelope, declineSingle, fieldLabel, fillSignerField, getSavedSignature,
  getSignerDetail, getSignerDocument, getSignerEnvelope, markSignerViewed, saveSignatureImage,
  signSingle, SIGNATURE_TYPES, TEXT_TYPES, type SignerField,
} from '../../src/lib/businessSharedApi';
import { BUSINESS_FEATURES_ENABLED } from '../../src/lib/config';
import { colors } from '../../src/theme/colors';
import { spacing, borderRadius } from '../../src/theme/spacing';

/** Local calendar date as YYYY-MM-DD (no UTC off-by-one). */
function isoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Sign a FIRM's signature request in-app (business-network). Reached from a firm's
 * `?sign=<token>` deep link (see services/deepLinking.ts). Branches on `?env=1` (multi-signer
 * envelope) vs a single-signer request, mirroring the business mobile ceremony but re-skinned to
 * the consumer app's native components. Inert unless BUSINESS_FEATURES_ENABLED.
 */
export default function FirmSign() {
  const { ref, env } = useLocalSearchParams<{ ref: string; env?: string }>();
  if (!BUSINESS_FEATURES_ENABLED) return <Gate message="Firm signing isn't available in this build." />;
  if (!ref) return <Gate message="This signing link is missing its reference." />;
  // With an explicit kind (from an in-app inbox), branch directly. A raw `?sign=` deep link has no
  // `env` flag, so probe: try the envelope endpoint and fall back to single-signer if it isn't one.
  if (env === '1') return <EnvelopeSign refId={ref} />;
  if (env === '0') return <SingleSign refId={ref} />;
  return <ProbeSign refId={ref} />;
}

/** Deep-link entry: resolve single vs envelope by probing the envelope endpoint (404 → single). */
function ProbeSign({ refId }: { refId: string }) {
  const [mode, setMode] = useState<'loading' | 'env' | 'single'>('loading');
  useEffect(() => {
    let alive = true;
    getSignerEnvelope(refId)
      .then(() => alive && setMode('env'))
      .catch(() => alive && setMode('single'));
    return () => { alive = false; };
  }, [refId]);
  if (mode === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <Header title="To sign" />
        <View style={styles.center}><ActivityIndicator color={colors.primary[600]} /></View>
      </SafeAreaView>
    );
  }
  return mode === 'env' ? <EnvelopeSign refId={refId} /> : <SingleSign refId={refId} />;
}

function Gate({ message }: { message: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <Header title="To sign" />
      <View style={styles.center}><Text style={styles.muted}>{message}</Text></View>
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.headerRow}>
      <ArrowLeft size={20} color={colors.slate[700]} />
      <Text style={styles.headerText}>{title}</Text>
    </Pressable>
  );
}

// ── Single-signer request ─────────────────────────────────────────────────────
function SingleSign({ refId }: { refId: string }) {
  const [detail, setDetail] = useState<{ documentName: string; requestedBy: string; canView?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [savedImage, setSavedImage] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [method, setMethod] = useState<'typed' | 'drawn'>('typed');
  const [image, setImage] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSignerDetail(refId)
      .then((d) => { if (alive) { setDetail(d); setLoading(false); } })
      .catch((e) => { if (alive) { setLoadErr(e?.message || 'Could not load this request.'); setLoading(false); } });
    markSignerViewed(refId).catch(() => {});
    getSavedSignature('signature').then((r) => alive && setSavedImage(r.imageData)).catch(() => {});
    return () => { alive = false; };
  }, [refId]);

  async function openDoc() {
    try { const { url } = await getSignerDocument(refId); setDocUrl(url); }
    catch { setMsg('Could not open the document.'); }
  }

  async function onSign() {
    if (busy) return;
    if (!name.trim()) { setMsg('Type your full name to sign.'); return; }
    if (method === 'drawn' && !image) { setMsg('Draw your signature or switch to typed.'); return; }
    setMsg(null); setBusy(true);
    try {
      await signSingle(refId, { name: name.trim(), method, signatureImage: method === 'drawn' ? image ?? undefined : undefined });
      if (method === 'drawn' && image) saveSignatureImage('signature', image).catch(() => {});
      router.replace('/');
    } catch (e: any) {
      setMsg(e?.message || 'Could not sign. Please try again.');
      setBusy(false);
    }
  }

  async function onDecline() {
    if (busy) return;
    setBusy(true);
    try { await declineSingle(refId); router.replace('/'); }
    catch (e: any) { setMsg(e?.message || 'Could not decline.'); setBusy(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="To sign" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary[600]} /></View>
      ) : loadErr ? (
        <View style={styles.center}><Text style={styles.danger}>{loadErr}</Text></View>
      ) : detail ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{detail.documentName}</Text>
          <Text style={styles.muted}>From {detail.requestedBy}</Text>

          {detail.canView !== false && (
            <Pressable style={styles.secondaryBtn} onPress={openDoc}><Text style={styles.secondaryBtnText}>View document</Text></Pressable>
          )}

          <View style={styles.card}>
            <Text style={styles.label}>Your full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.slate[400]} />
            <View style={styles.methodRow}>
              {(['typed', 'drawn'] as const).map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} style={[styles.chip, m === method && styles.chipOn]}>
                  <Text style={[styles.chipText, m === method && styles.chipTextOn]}>{m === 'typed' ? 'Type' : 'Draw'}</Text>
                </Pressable>
              ))}
            </View>
            {method === 'drawn' && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {image ? <Text style={styles.brandNote}>Signature captured ✓</Text> : null}
                <Pressable style={styles.secondaryBtn} onPress={() => setShowPad(true)}><Text style={styles.secondaryBtnText}>{image ? 'Redraw signature' : 'Draw signature'}</Text></Pressable>
                {!image && savedImage && (
                  <Pressable style={styles.ghostBtn} onPress={() => setImage(savedImage)}><Text style={styles.ghostBtnText}>Use saved signature</Text></Pressable>
                )}
              </View>
            )}
          </View>

          {msg && <Text style={styles.danger}>{msg}</Text>}
          <Pressable style={[styles.primaryBtn, (!name.trim() || busy) && styles.btnDisabled]} disabled={!name.trim() || busy} onPress={onSign}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Sign document</Text>}
          </Pressable>
          <Pressable style={styles.ghostBtn} disabled={busy} onPress={onDecline}><Text style={styles.ghostBtnText}>Decline</Text></Pressable>
        </ScrollView>
      ) : null}

      <SignatureInput visible={showPad} type="signature" onCancel={() => setShowPad(false)} onSave={(d) => { setImage(d); setShowPad(false); }} />
      <InAppBrowser url={docUrl} isPdf onClose={() => setDocUrl(null)} title={detail?.documentName} />
    </SafeAreaView>
  );
}

// ── Envelope (multi-signer, placed fields) ────────────────────────────────────
function EnvelopeSign({ refId }: { refId: string }) {
  const [env, setEnv] = useState<Awaited<ReturnType<typeof getSignerEnvelope>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [padField, setPadField] = useState<SignerField | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const myTurn = env?.myTurn ?? false;
  const readOnly = !myTurn || busy;

  useEffect(() => {
    let alive = true;
    getSignerEnvelope(refId)
      .then((e) => { if (!alive) return; setEnv(e); setValues(Object.fromEntries(e.myFields.map((f) => [f.id, f.value ?? '']))); setLoading(false); })
      .catch((e) => { if (alive) { setLoadErr(e?.message || 'Could not load this request.'); setLoading(false); } });
    markSignerViewed(refId).catch(() => {});
    return () => { alive = false; };
  }, [refId]);

  async function fill(field: SignerField, value: string) {
    const prev = values[field.id] ?? '';
    setValues((v) => ({ ...v, [field.id]: value }));
    try { await fillSignerField(refId, field.id, value); }
    catch (e: any) { setValues((v) => ({ ...v, [field.id]: prev })); setMsg(e?.message || 'Could not save that field.'); }
  }

  async function onSignatureDone(dataUrl: string) {
    const field = padField; setPadField(null);
    if (!field) return;
    await fill(field, dataUrl);
    if (field.fieldType === 'signature' || field.fieldType === 'initials') saveSignatureImage(field.fieldType, dataUrl).catch(() => {});
  }

  async function openDoc() {
    try { const { url } = await getSignerDocument(refId); setDocUrl(url); }
    catch { setMsg('Could not open the document.'); }
  }

  async function finish() {
    setBusy(true); setMsg(null);
    try { await completeSigner(refId); router.replace('/'); }
    catch (e: any) { setMsg(e?.message || 'Could not complete signing.'); setBusy(false); }
  }

  async function onDecline() {
    if (busy) return;
    setBusy(true);
    try { await declineEnvelope(refId); router.replace('/'); }
    catch (e: any) { setMsg(e?.message || 'Could not decline.'); setBusy(false); }
  }

  const fields = env?.myFields ?? [];
  const isFilled = (f: SignerField) => (f.fieldType === 'checkbox' ? values[f.id] === 'true' : (values[f.id] ?? '').length > 0);
  const allRequiredFilled = fields.filter((f) => f.required).every(isFilled);

  return (
    <SafeAreaView style={styles.safe}>
      <Header title="To sign" />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary[600]} /></View>
      ) : loadErr ? (
        <View style={styles.center}><Text style={styles.danger}>{loadErr}</Text></View>
      ) : env ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{env.documentName}</Text>
          <Text style={styles.muted}>From {env.requestedBy}</Text>

          {env.canView && <Pressable style={styles.secondaryBtn} onPress={openDoc}><Text style={styles.secondaryBtnText}>View document</Text></Pressable>}

          {!myTurn && (
            <View style={[styles.card, { borderColor: colors.primary[200] }]}>
              <Text style={styles.muted}>Waiting for an earlier signer. You'll be able to sign once it's your turn.</Text>
            </View>
          )}

          {fields.length === 0 ? (
            <View style={styles.card}><Text style={styles.muted}>No fields assigned to you on this document.</Text></View>
          ) : (
            fields.map((f) => (
              <FieldRow key={f.id} field={f} value={values[f.id] ?? ''} readOnly={readOnly}
                onText={(v) => fill(f, v)} onSignature={() => setPadField(f)}
                onToday={() => fill(f, isoDate())} onToggle={() => fill(f, values[f.id] === 'true' ? 'false' : 'true')} />
            ))
          )}

          {msg && <Text style={styles.danger}>{msg}</Text>}
          {myTurn && fields.length > 0 && (
            <Pressable style={[styles.primaryBtn, (!allRequiredFilled || busy) && styles.btnDisabled]} disabled={!allRequiredFilled || busy} onPress={finish}>
              {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Finish signing</Text>}
            </Pressable>
          )}
          <Pressable style={styles.ghostBtn} disabled={busy} onPress={onDecline}><Text style={styles.ghostBtnText}>Decline</Text></Pressable>
        </ScrollView>
      ) : null}

      <SignatureInput visible={!!padField} type={padField?.fieldType === 'initials' ? 'initials' : 'signature'} onCancel={() => setPadField(null)} onSave={onSignatureDone} />
      <InAppBrowser url={docUrl} isPdf onClose={() => setDocUrl(null)} title={env?.documentName} />
    </SafeAreaView>
  );
}

function FieldRow({ field, value, readOnly, onText, onSignature, onToday, onToggle }: {
  field: SignerField; value: string; readOnly: boolean;
  onText: (v: string) => void; onSignature: () => void; onToday: () => void; onToggle: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const filled = value.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.fieldHead}>
        <Text style={styles.label}>{fieldLabel(field)}{field.required ? ' *' : ''}</Text>
        {filled && <Check size={16} color={colors.success[600]} />}
      </View>

      {SIGNATURE_TYPES.includes(field.fieldType) ? (
        <Pressable style={[styles.secondaryBtn, readOnly && styles.btnDisabled]} disabled={readOnly} onPress={onSignature}>
          <Text style={styles.secondaryBtnText}>{filled ? 'Change signature' : `Add ${field.fieldType === 'initials' ? 'initials' : 'signature'}`}</Text>
        </Pressable>
      ) : field.fieldType === 'date_signed' ? (
        filled ? <Text style={styles.muted}>{value.slice(0, 10)}</Text>
          : <Pressable style={[styles.secondaryBtn, readOnly && styles.btnDisabled]} disabled={readOnly} onPress={onToday}><Text style={styles.secondaryBtnText}>Apply today's date</Text></Pressable>
      ) : field.fieldType === 'checkbox' ? (
        <Pressable onPress={onToggle} disabled={readOnly} style={styles.checkRow}>
          <View style={[styles.checkbox, value === 'true' && styles.checkboxOn]}>{value === 'true' && <Check size={14} color={colors.white} />}</View>
          <Text style={styles.muted}>Check to confirm</Text>
        </Pressable>
      ) : TEXT_TYPES.includes(field.fieldType) ? (
        <TextInput style={styles.input} placeholder={fieldLabel(field)} placeholderTextColor={colors.slate[400]}
          value={draft} editable={!readOnly} onChangeText={setDraft} onEndEditing={() => draft !== value && onText(draft)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  body: { padding: spacing.lg, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.lg },
  headerText: { fontSize: 15, fontWeight: '600', color: colors.slate[800] },
  title: { fontSize: 20, fontWeight: '700', color: colors.slate[900] },
  muted: { fontSize: 14, color: colors.slate[500] },
  danger: { fontSize: 14, color: '#dc2626', fontWeight: '500' },
  brandNote: { fontSize: 13, color: colors.primary[600] },
  label: { fontSize: 13, color: colors.slate[500], marginBottom: 4 },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.slate[200], padding: spacing.lg },
  input: { backgroundColor: colors.slate[100], color: colors.slate[900], borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, marginTop: 4 },
  methodRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chip: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.slate[100] },
  chipOn: { backgroundColor: colors.primary[600] },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.slate[600] },
  chipTextOn: { color: colors.white },
  primaryBtn: { backgroundColor: colors.primary[600], borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  secondaryBtn: { backgroundColor: colors.slate[100], borderRadius: borderRadius.md, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { color: colors.slate[800], fontSize: 14, fontWeight: '600' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { color: colors.slate[500], fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.primary[600], alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary[600] },
});
