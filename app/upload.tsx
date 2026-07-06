import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, Image, Platform,
} from 'react-native';
import { useToast } from '../src/contexts/ToastContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../src/utils/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import {
  Upload, FileText, Link, X, Calendar,
  AlertTriangle, CheckCircle, Plus, Trash2,
  Lock, Zap, RefreshCw, Merge, Cloud,
} from 'lucide-react-native';
import { useAuth } from '../src/hooks/useAuth';
import { useDocuments } from '../src/hooks/useDocuments';
import { uploadMergedDocument } from '../src/lib/api';
import { useSubscription } from '../src/hooks/useSubscription';
import { getCloudProviders, getConnectUrl as connectCloudProvider, type CloudProvider } from '../src/lib/cloudStorageApi';
import { CloudProviderIcon } from '../src/components/CloudProviderIcon';
import Button from '../src/components/ui/Button';
import Card from '../src/components/ui/Card';
import GradientIcon from '../src/components/ui/GradientIcon';
import LoadingSpinner from '../src/components/ui/LoadingSpinner';
import { useGoalBubble } from '../src/hooks/useGoalBubble';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { spacing, borderRadius } from '../src/theme/spacing';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '../src/types/document';
import { linkRelatedDocuments } from '../src/lib/engagementApi';

type UploadTab = 'file' | 'url';

const CATEGORY_ICONS: Record<DocumentCategory, { emoji: string }> = {
  warranty: { emoji: '\u{1F6E1}' },
  insurance: { emoji: '\u{1F4CB}' },
  lease: { emoji: '\u{1F3E0}' },
  employment: { emoji: '\u{1F4BC}' },
  contract: { emoji: '\u{1F4DD}' },
  other: { emoji: '\u{1F4C1}' },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadScreen() {
  const { isAuthenticated } = useAuth();
  const { uploadDocuments } = useDocuments(isAuthenticated);
  const { subscription, loading: subLoading, canUploadDocument, incrementMonthlyUploads, documentCount, featureFlags } = useSubscription();
  const { showToast } = useToast();

  // Feature gating (source of truth = backend feature flags)
  const canIngestUrl = featureFlags.url_ingestion;
  // OCR/image uploads are paid. Free plan cannot upload images at all — hide the
  // image source, restrict the picker to non-image types, and block any image
  // that slips through client-side with the same message the backend returns.
  const canUploadImages = featureFlags.ocr_enabled;
  const IMAGE_MIME_RE = /^image\//i;
  const IMAGE_BLOCK_MSG = 'Your current plan does not support image uploads. Upgrade to enable OCR for images.';

  // Renewal context from DocumentHealthPanel
  const { renewalDocId, renewalName, renewalCategory } = useLocalSearchParams<{
    renewalDocId?: string;
    renewalName?: string;
    renewalCategory?: string;
  }>();
  const isRenewal = !!renewalDocId;

  const [tab, setTab] = useState<UploadTab>('file');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory | ''>(
    (renewalCategory as DocumentCategory) || ''
  );
  const [expirationDate, setExpirationDate] = useState('');
  const [loading, setLoading] = useState(false);

  // File-specific
  const [fileUri, setFileUri] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState('');

  // Multi-file + merge
  const [additionalFiles, setAdditionalFiles] = useState<Array<{ uri: string; name: string; size: number; mimeType: string }>>([]);
  const [mergeAsOne, setMergeAsOne] = useState(false);

  // URL-specific
  const [url, setUrl] = useState('');

  // Cloud import
  const [cloudProviders, setCloudProviders] = useState<CloudProvider[]>([]);
  // Cloud import (Google Drive / Dropbox / …) is a Pro/Family feature.
  const cloudEnabled = featureFlags.cloud_import;

  React.useEffect(() => {
    if (cloudEnabled) {
      getCloudProviders().then(setCloudProviders).catch(() => {});
    }
  }, [cloudEnabled]);

  const { completeStepById } = useGoalBubble();
  const isFree = subscription?.plan === 'free';

  // Non-image types are always allowed. Images require OCR (paid plans only).
  const NON_IMAGE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  const pickerTypes = canUploadImages ? [...NON_IMAGE_TYPES, 'image/*'] : NON_IMAGE_TYPES;

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Belt-and-suspenders: block images client-side for Free (some pickers
        // ignore the type filter) with the same message the backend returns.
        if (!canUploadImages && IMAGE_MIME_RE.test(asset.mimeType || '')) {
          showToast(IMAGE_BLOCK_MSG, 'warning');
          return;
        }
        setFileUri(asset.uri);
        setFileName(asset.name);
        setFileSize(asset.size || 0);
        setMimeType(asset.mimeType || 'application/octet-stream');
        if (!name) setName(asset.name.replace(/\.[^/.]+$/, ''));
      }
    } catch {
      showToast('Failed to pick file', 'error');
    }
  };

  const handleRemoveFile = () => {
    setFileUri('');
    setFileName('');
    setFileSize(0);
    setMimeType('');
    setAdditionalFiles([]);
    setMergeAsOne(false);
  };

  const handlePickAdditionalFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!canUploadImages && IMAGE_MIME_RE.test(asset.mimeType || '')) {
          showToast(IMAGE_BLOCK_MSG, 'warning');
          return;
        }
        setAdditionalFiles(prev => [...prev, {
          uri: asset.uri,
          name: asset.name,
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/octet-stream',
        }]);
      }
    } catch {
      showToast('Failed to pick file', 'error');
    }
  };

  const handleRemoveAdditionalFile = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const allFilesCount = (fileUri ? 1 : 0) + additionalFiles.length;

  // ---- Upload handler ----

  const handleUpload = async () => {
    if (!name.trim()) {
      showToast('Please enter a document name', 'warning');
      return;
    }
    if (!category) {
      showToast('Please select a category', 'warning');
      return;
    }
    if (!canUploadDocument) {
      showToast('Upload limit reached. Please upgrade your plan.', 'warning');
      return;
    }

    setLoading(true);
    try {
      let uploadedIds: string[] = [];

      if (tab === 'file') {
        if (!fileUri) {
          showToast('Please select a file', 'warning');
          setLoading(false);
          return;
        }

        // Merge upload: combine primary + additional files into one document
        if (mergeAsOne && additionalFiles.length > 0) {
          const allFiles = [
            { uri: fileUri, name: fileName, mimeType },
            ...additionalFiles.map(f => ({ uri: f.uri, name: f.name, mimeType: f.mimeType })),
          ];
          const result = await uploadMergedDocument(allFiles, name.trim(), category as DocumentCategory, expirationDate || undefined);
          if (!result.success || !result.data) throw new Error(result.error || 'Merge upload failed');
          uploadedIds = [result.data.document_id];
        } else {
          uploadedIds = await uploadDocuments([{
            type: 'file', name: name.trim(), category: category as DocumentCategory, fileUri, fileName, mimeType,
            expirationDate: expirationDate || undefined,
          }]);
        }
      } else if (tab === 'url') {
        if (!url.trim()) {
          showToast('Please enter a URL', 'warning');
          setLoading(false);
          return;
        }
        uploadedIds = await uploadDocuments([{
          type: 'url', name: name.trim(), category: category as DocumentCategory, url: url.trim(),
          expirationDate: expirationDate || undefined,
        }]);
      }

      await incrementMonthlyUploads();

      // If this was a renewal upload, link the new document to the original
      if (isRenewal && renewalDocId && uploadedIds.length > 0) {
        try {
          for (const newDocId of uploadedIds) {
            await linkRelatedDocuments(newDocId, renewalDocId, 'supersedes');
          }
        } catch (linkErr) {
          console.error('Failed to link renewal:', linkErr);
        }
      }

      showToast(isRenewal ? 'Renewal uploaded successfully' : 'Document uploaded successfully', 'success');
      if (expirationDate) completeStepById('set-expiration');
      goBack('/(tabs)/vault');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: UploadTab; label: string; icon: (active: boolean) => React.ReactNode; locked: boolean }[] = [
    { key: 'file', label: 'File', icon: (a) => <FileText size={14} color={a ? colors.white : colors.slate[600]} />, locked: false },
    { key: 'url', label: 'URL', icon: (a) => <Link size={14} color={a ? colors.white : colors.slate[600]} />, locked: !canIngestUrl },
  ];

  const canSubmit =
    name.trim() &&
    category !== '' &&
    ((tab === 'file' && fileUri) ||
      (tab === 'url' && url.trim()));

  if (subLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Upload Document', headerShown: true, presentation: 'modal' }} />
        <LoadingSpinner fullScreen />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: isRenewal ? 'Upload Renewal' : 'Upload Document', headerShown: true, presentation: 'modal' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Renewal Banner */}
          {isRenewal && (
            <View style={styles.renewalBanner}>
              <RefreshCw size={16} color={colors.primary[600]} />
              <Text style={styles.renewalBannerText}>
                Uploading renewal for <Text style={styles.renewalBannerBold}>{renewalName}</Text>
              </Text>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <GradientIcon size={48}>
              <Upload size={24} color={colors.white} />
            </GradientIcon>
            <Text style={styles.headerTitle}>{isRenewal ? 'Upload Renewal' : 'Upload Document'}</Text>
            <Text style={styles.headerSubtitle}>
              {isRenewal ? 'Upload a new version of this document' : 'Add a new document to your vault'}
            </Text>
          </View>

          {/* Tab Switcher - Segmented Control */}
          <View style={styles.segmentedControl}>
            {tabs.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                activeOpacity={0.7}
                style={[styles.segmentTab, tab === t.key && styles.segmentTabActive]}
              >
                {tab === t.key ? (
                  <LinearGradient
                    colors={[...colors.gradient.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.segmentGradient}
                  >
                    {t.icon(true)}
                    <Text style={styles.segmentTextActive}>{t.label}</Text>
                    {t.locked && <Lock size={10} color={colors.white} strokeWidth={2.5} />}
                  </LinearGradient>
                ) : (
                  <View style={styles.segmentInner}>
                    {t.icon(false)}
                    <Text style={styles.segmentText}>{t.label}</Text>
                    {t.locked && <Lock size={10} color={colors.slate[400]} strokeWidth={2.5} />}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Locked tab upgrade prompt */}
          {tab === 'url' && !canIngestUrl && (
            <Card style={styles.upgradeCard}>
              <View style={styles.upgradeCardContent}>
                <GradientIcon size={48}>
                  <Link size={24} color={colors.white} />
                </GradientIcon>
                <View style={styles.upgradeBadge}>
                  <Lock size={10} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.upgradeBadgeText}>STARTER FEATURE</Text>
                </View>
                <Text style={styles.upgradeTitle}>URL Ingestion</Text>
                <Text style={styles.upgradeDescription}>
                  Import documents directly from web URLs. We'll fetch, process, and store the content for you.
                </Text>
                <Button
                  title="Upgrade to Starter"
                  onPress={() => router.push('/billing')}
                  variant="primary"
                  size="md"
                  fullWidth
                  icon={<Zap size={16} color={colors.white} />}
                />
                <Text style={styles.upgradePriceHint}>Starting at $9/mo · Cancel anytime</Text>
              </View>
            </Card>
          )}

          {/* File Tab */}
          {tab === 'file' && (
            <View>
              {!fileUri ? (
                <View style={styles.dropZone}>
                  <View style={styles.dropZoneIconWrap}>
                    <Upload size={28} color={colors.primary[400]} />
                  </View>
                  <Text style={styles.dropZoneTitle}>Upload Document</Text>
                  <Text style={styles.dropZoneHint}>
                    Choose a source below
                  </Text>

                  {/* Source buttons */}
                  <View style={styles.sourceButtonsWrap}>
                    <TouchableOpacity onPress={handlePickFile} activeOpacity={0.7} style={styles.sourceBtn}>
                      <FileText size={18} color={colors.primary[600]} />
                      <Text style={styles.sourceBtnText}>Choose File</Text>
                    </TouchableOpacity>

                    {cloudEnabled && Platform.OS === 'web' && cloudProviders.map(p => (
                      <TouchableOpacity
                        key={p.name}
                        onPress={async () => {
                          if (p.connected) {
                            router.push('/(tabs)/vault');
                          } else {
                            const url = await connectCloudProvider(p.name);
                            if (url) {
                              window.location.href = url;
                            }
                          }
                        }}
                        activeOpacity={0.7}
                        style={styles.sourceBtn}
                      >
                        <CloudProviderIcon provider={p.name} size={18} />
                        <Text style={styles.sourceBtnText}>{p.displayName}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.fileTypeRow}>
                    {(canUploadImages ? ['PDF', 'DOC', 'IMG', 'TXT'] : ['PDF', 'DOC', 'TXT']).map((ext) => (
                      <View key={ext} style={styles.fileTypeBadge}>
                        <Text style={styles.fileTypeBadgeText}>{ext}</Text>
                      </View>
                    ))}
                  </View>
                  {!canUploadImages && (
                    <Text style={styles.imageHint}>
                      Image uploads (OCR) require a paid plan
                    </Text>
                  )}
                </View>
              ) : (<>
                <Card style={styles.fileCard}>
                  <View style={styles.fileCardRow}>
                    <View style={styles.fileCardIconWrap}>
                      <FileText size={22} color={colors.primary[600]} />
                    </View>
                    <View style={styles.fileCardInfo}>
                      <Text style={styles.fileCardName} numberOfLines={1}>
                        {fileName}
                      </Text>
                      {fileSize > 0 && (
                        <Text style={styles.fileCardSize}>
                          {formatFileSize(fileSize)}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={handleRemoveFile}
                      style={styles.fileRemoveBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={18} color={colors.slate[400]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.fileSuccessRow}>
                    <CheckCircle size={14} color={colors.success[600]} />
                    <Text style={styles.fileSuccessText}>File selected</Text>
                  </View>
                </Card>

                {/* Additional files list */}
                {additionalFiles.map((af, idx) => (
                  <Card key={idx} style={[styles.fileCard, { marginTop: 8 }]}>
                    <View style={styles.fileCardRow}>
                      <View style={styles.fileCardIconWrap}>
                        <FileText size={22} color={colors.primary[600]} />
                      </View>
                      <View style={styles.fileCardInfo}>
                        <Text style={styles.fileCardName} numberOfLines={1}>{af.name}</Text>
                        {af.size > 0 && (
                          <Text style={styles.fileCardSize}>{formatFileSize(af.size)}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveAdditionalFile(idx)}
                        style={styles.fileRemoveBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={18} color={colors.slate[400]} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}

                {/* Add more files button */}
                <TouchableOpacity
                  onPress={handlePickAdditionalFile}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start' }}
                >
                  <Plus size={16} color={colors.primary[600]} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary[600] }}>Add More Files</Text>
                </TouchableOpacity>


                {/* Merge checkbox — visible when 2+ files */}
                {allFilesCount >= 2 && (
                  <TouchableOpacity
                    onPress={() => setMergeAsOne(!mergeAsOne)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: mergeAsOne ? colors.primary[50] : colors.slate[50], borderRadius: 8, borderWidth: 1, borderColor: mergeAsOne ? colors.primary[200] : colors.slate[200] }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: mergeAsOne ? colors.primary[600] : colors.slate[400], backgroundColor: mergeAsOne ? colors.primary[600] : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {mergeAsOne && <CheckCircle size={14} color={colors.white} />}
                    </View>
                    <Merge size={16} color={colors.primary[600]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.slate[800] }}>Merge as one document</Text>
                      <Text style={{ fontSize: 11, color: colors.slate[500] }}>Combine {allFilesCount} files into a single document</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>)}
            </View>
          )}

          {/* URL Tab - requires url_ingestion */}
          {tab === 'url' && canIngestUrl && (
            <Card>
              <Text style={styles.inputLabel}>Document URL</Text>
              <View style={styles.urlInputWrap}>
                <Link size={18} color={colors.slate[400]} />
                <TextInput
                  style={styles.urlInput}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="Paste document URL..."
                  placeholderTextColor={colors.slate[400]}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.urlHint}>
                Supports web pages, PDF links, and public documents
              </Text>
            </Card>
          )}

          {/* Document Details */}
          <Card>
            <Text style={styles.sectionTitle}>Document Details</Text>

            {/* Name */}
            <Text style={styles.inputLabel}>Document Name</Text>
            <View style={styles.nameInputWrap}>
              <FileText size={18} color={colors.slate[400]} />
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter document name"
                placeholderTextColor={colors.slate[400]}
              />
            </View>

            {/* Category Grid — compact 3×2 */}
            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>Category *</Text>
            <View style={styles.categoryGrid}>
              {DOCUMENT_CATEGORIES.map((c) => {
                const isSelected = category === c.value;
                const catColors = colors.category[c.value];
                return (
                  <TouchableOpacity
                    key={c.value}
                    onPress={() => setCategory(c.value)}
                    activeOpacity={0.7}
                    style={[
                      styles.categoryBtn,
                      {
                        backgroundColor: isSelected ? catColors.bg : colors.slate[50],
                        borderColor: isSelected ? catColors.border : colors.slate[200],
                      },
                    ]}
                  >
                    <Text style={styles.categoryEmoji}>
                      {CATEGORY_ICONS[c.value].emoji}
                    </Text>
                    <Text
                      style={[
                        styles.categoryText,
                        { color: isSelected ? catColors.text : colors.slate[600] },
                      ]}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Expiration Date */}
            <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>
              Expiration Date{' '}
              <Text style={styles.optionalTag}>(optional)</Text>
            </Text>
            <View style={styles.nameInputWrap}>
              <Calendar size={18} color={colors.slate[400]} />
              <TextInput
                style={styles.nameInput}
                value={expirationDate}
                onChangeText={setExpirationDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.slate[400]}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </Card>

          {/* Upload Limit Warning — all plans */}
          {!canUploadDocument && (
            <Card style={styles.warningCard}>
              <View style={styles.warningRow}>
                <View style={styles.warningIconWrap}>
                  <AlertTriangle size={20} color={colors.warning[600]} />
                </View>
                <View style={styles.warningContent}>
                  <Text style={styles.warningTitle}>Upload Limit Reached</Text>
                  <Text style={styles.warningText}>
                    Your {subscription?.plan || 'current'} plan allows {(subscription?.document_limit ?? 3) >= 99999 ? 'unlimited' : (subscription?.document_limit ?? 3)} documents and{' '}
                    {(subscription?.monthly_upload_limit ?? 3) >= 99999 ? 'unlimited' : (subscription?.monthly_upload_limit ?? 3)} uploads/month.{' '}
                    {isFree ? 'Upgrade to continue.' : 'You have reached your limit for this period.'}
                  </Text>
                </View>
              </View>
              {isFree && (
                <Button
                  title="Upgrade Plan"
                  onPress={() => router.push('/billing')}
                  variant="primary"
                  size="sm"
                  fullWidth
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          )}

          {/* Approaching limit warning — all plans */}
          {canUploadDocument && subscription && (subscription.monthly_upload_limit ?? 3) < 99999 && (subscription.monthly_uploads_used ?? 0) >= (subscription.monthly_upload_limit ?? 3) * 0.8 && (
            <View style={styles.approachingLimitRow}>
              <AlertTriangle size={14} color={colors.warning[600]} />
              <Text style={styles.approachingLimitText}>
                Approaching upload limit: {subscription.monthly_uploads_used} / {subscription.monthly_upload_limit} uploads this month
              </Text>
            </View>
          )}

          {/* Usage indicator — all plans */}
          {canUploadDocument && (
            <View style={styles.usageRow}>
              <View style={styles.usageDot} />
              <Text style={styles.usageText}>
                {documentCount} / {(subscription?.document_limit ?? 3) >= 99999 ? 'Unlimited' : (subscription?.document_limit ?? 3)} documents used
                {' \u2022 '}
                {subscription?.monthly_uploads_used ?? 0} / {(subscription?.monthly_upload_limit ?? 3) >= 99999 ? 'Unlimited' : (subscription?.monthly_upload_limit ?? 3)} uploads this month
              </Text>
            </View>
          )}

          {/* Submit Button */}
          <Button
            title="Upload Document"
            onPress={handleUpload}
            loading={loading}
            disabled={loading || !canSubmit || !canUploadDocument}
            size="lg"
            fullWidth
            icon={<Upload size={20} color={colors.white} />}
          />

          <View style={{ height: spacing['2xl'] }} />
        </ScrollView>
      </SafeAreaView>

    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.slate[50],
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },

  // Renewal Banner
  renewalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  renewalBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
  },
  renewalBannerBold: {
    fontWeight: typography.fontWeight.semibold,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginTop: spacing.sm,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },

  // Segmented Control
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.slate[100],
    borderRadius: borderRadius.lg,
    padding: 4,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  segmentTabActive: {
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
  },
  segmentTextActive: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  segmentText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },

  // Drop Zone (shared by file + scan)
  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary[300],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropZoneIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  dropZoneTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[700],
  },
  dropZoneHint: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
  },
  sourceButtonsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  sourceBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  fileTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  fileTypeBadge: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  fileTypeBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  imageHint: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: spacing.xs,
  },

  // File Card
  fileCard: {
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  fileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fileCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileCardInfo: {
    flex: 1,
  },
  fileCardName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[800],
  },
  fileCardSize: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 2,
  },
  fileRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.slate[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  fileSuccessText: {
    fontSize: typography.fontSize.xs,
    color: colors.success[600],
    fontWeight: typography.fontWeight.medium,
  },

  // URL Input
  urlInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  urlInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
  },
  urlHint: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
    marginTop: spacing.sm,
  },

  // Labels
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[700],
    marginBottom: spacing.sm,
  },
  optionalTag: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
    color: colors.slate[400],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    marginBottom: spacing.lg,
  },

  // Name Input
  nameInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
  },
  nameInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.slate[900],
  },

  // Category Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryBtn: {
    flexBasis: '31%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  categoryEmoji: {
    fontSize: 16,
  },
  categoryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },

  // Warning Card
  warningCard: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  warningRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  warningIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.warning[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    marginBottom: 4,
  },
  warningText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    lineHeight: 18,
  },

  // Approaching Limit
  approachingLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  approachingLimitText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Usage Row
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  usageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary[500],
  },
  usageText: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
  },

  // Upgrade Card (inline for locked tabs)
  upgradeCard: {
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.white,
  },
  upgradeCardContent: {
    alignItems: 'center' as const,
    gap: spacing.md,
  },
  upgradeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  upgradeBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  upgradeTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.slate[900],
    textAlign: 'center' as const,
  },
  upgradeDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  upgradePriceHint: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[400],
  },
});
