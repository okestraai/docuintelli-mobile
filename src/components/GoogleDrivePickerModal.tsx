import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Modal as RNModal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { X, Cloud, Check, AlertCircle } from 'lucide-react-native';
import { CloudProviderIcon } from './CloudProviderIcon';
import { importCloudFiles, getPickerToken, ImportResult } from '../lib/cloudStorageApi';
import { GOOGLE_PICKER_API_KEY } from '../lib/config';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, borderRadius } from '../theme/spacing';

// App ID = Google Cloud project number
const GOOGLE_APP_ID = '245301325809';

interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
}

interface GoogleDrivePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const CATEGORIES = [
  { value: 'warranty', label: 'Warranty' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'lease', label: 'Lease Agreement' },
  { value: 'employment', label: 'Employment Contract' },
  { value: 'contract', label: 'Service Contract' },
  { value: 'other', label: 'Other' },
];

const PICKER_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
].join(',');

/** Generate Picker HTML that uses a pre-fetched OAuth token (no GIS needed) */
function getPickerHTML(oauthToken: string, appId: string, apiKey: string, mimeTypes: string): string {
  // Get screen dimensions for proper Picker sizing
  const screen = Dimensions.get('window');
  const pickerWidth = Math.min(1051, Math.floor(screen.width));
  const pickerHeight = Math.min(650, Math.floor(screen.height - 120));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #f8fafc;
      font-family: -apple-system, sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: #64748b;
      font-size: 15px;
    }
    .error { text-align: center; color: #dc2626; font-size: 15px; padding: 20px; }
    .spinner {
      width: 28px; height: 28px;
      border: 3px solid #e2e8f0; border-top-color: #059669;
      border-radius: 50%; animation: spin 1s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Force Google Picker dialog to fill the viewport */
    .picker-dialog { max-width: 100% !important; max-height: 100% !important; width: 100% !important; }
    .picker-dialog-content { max-width: 100% !important; max-height: 100% !important; }
    .picker-dialog-frame { width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>
  <div class="loading" id="status">
    <div class="spinner"></div>
    <div>Opening Google Drive...</div>
  </div>
  <script src="https://apis.google.com/js/api.js"
    onerror="document.getElementById('status').innerHTML='<div class=error>Failed to load Google APIs.<br>Please check your connection.</div>'">
  </script>
  <script>
    function initPicker() {
      try {
        var docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes('${mimeTypes}');

        var picker = new google.picker.PickerBuilder()
          .addView(docsView)
          .setOAuthToken('${oauthToken}')
          .setDeveloperKey('${apiKey}')
          .setAppId('${appId}')
          .setOrigin(window.location.protocol + '//' + window.location.host)
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .enableFeature(google.picker.Feature.NAV_HIDDEN)
          .setTitle('Select documents to import')
          .setSize(${pickerWidth}, ${pickerHeight})
          .setCallback(function(data) {
            if (data.action === google.picker.Action.PICKED) {
              var files = data.docs.map(function(doc) {
                return { id: doc.id, name: doc.name, mimeType: doc.mimeType };
              });
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'picked', files: files }));
            } else if (data.action === google.picker.Action.CANCEL) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cancel' }));
            }
          })
          .build();

        picker.setVisible(true);

        // Hide the loading status once the Picker is visible
        document.getElementById('status').style.display = 'none';
      } catch(e) {
        document.getElementById('status').innerHTML = '<div class="error">Picker error: ' + e.message + '</div>';
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
      }
    }

    gapi.load('picker', initPicker);
  </script>
</body>
</html>`;
}

export function GoogleDrivePickerModal({
  visible,
  onClose,
  onImportComplete,
}: GoogleDrivePickerModalProps) {
  const [phase, setPhase] = useState<'loading' | 'picker' | 'category' | 'importing' | 'results'>('loading');
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickerHTML, setPickerHTML] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPhase('loading');
      setPickedFiles([]);
      setSelectedCategory('');
      setImportResults([]);
      setError(null);
      setPickerHTML(null);
      // Fetch the backend OAuth token then build the Picker HTML
      fetchTokenAndBuildPicker();
    }
  }, [visible]);

  const fetchTokenAndBuildPicker = useCallback(async (retryCount = 0) => {
    try {
      setError(null);
      setPhase('loading');
      const token = await getPickerToken('google_drive');
      const html = getPickerHTML(token, GOOGLE_APP_ID, GOOGLE_PICKER_API_KEY, PICKER_MIME_TYPES);
      setPickerHTML(html);
      setPhase('picker');
    } catch (err: any) {
      // Auto-retry once — the first attempt after OAuth can fail while tokens settle
      if (err.needsReconnect && retryCount < 1) {
        setTimeout(() => fetchTokenAndBuildPicker(retryCount + 1), 1500);
        return;
      }
      setError(err.needsReconnect
        ? 'Google Drive needs to be reconnected. Tap "Try Again" or reconnect from the Vault.'
        : err.message || 'Failed to load Google Drive');
      setPhase('loading');
    }
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'picked' && data.files?.length > 0) {
        setPickedFiles(data.files);
        setPhase('category');
      } else if (data.type === 'cancel') {
        onClose();
      } else if (data.type === 'error') {
        setError(data.message || 'Picker failed');
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, [onClose]);

  const handleImport = async () => {
    if (!selectedCategory || pickedFiles.length === 0) return;
    setPhase('importing');
    setImporting(true);
    setError(null);
    try {
      const filesToImport = pickedFiles.map(f => ({
        fileId: f.id,
        name: f.name,
        category: selectedCategory,
      }));
      // Backend uses its stored token — setAppId links Picker selection to drive.file grant
      const results = await importCloudFiles('google_drive', filesToImport);
      setImportResults(results);
      setPhase('results');
      if (results.some(r => r.status === 'imported')) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setPhase('category');
    } finally {
      setImporting(false);
    }
  };

  return (
    <RNModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <CloudProviderIcon provider="google_drive" size={20} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Google Drive</Text>
              <Text style={styles.headerSubtitle}>
                {phase === 'loading' || phase === 'picker' ? 'Select files to import' :
                 phase === 'category' ? `${pickedFiles.length} file${pickedFiles.length === 1 ? '' : 's'} selected` :
                 phase === 'importing' ? 'Importing...' : 'Import complete'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.slate[400]} />
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
              <AlertCircle size={16} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity
              onPress={() => fetchTokenAndBuildPicker(0)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary[600], borderRadius: 6 }}
            >
              <Text style={{ color: colors.white, fontSize: 13, fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phase: Loading token */}
        {phase === 'loading' && !error && (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.importingText}>Connecting to Google Drive...</Text>
          </View>
        )}

        {/* Phase: Picker WebView */}
        {phase === 'picker' && pickerHTML && (
          <WebView
            source={{ html: pickerHTML, baseUrl: 'https://docuintelli.com' }}
            style={styles.webview}
            onMessage={handleWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            sharedCookiesEnabled
            originWhitelist={['*']}
            mixedContentMode="compatibility"
            // Software rendering fixes touch event propagation in cross-origin
            // iframes on Android. Hardware acceleration causes coordinate
            // translation issues between the WebView and the Picker's iframe.
            androidLayerType="software"
            // Let the Picker determine its own scaling — a desktop-style UA
            // prevents Android WebView from applying mobile DPI downscaling
            // that makes the Picker render tiny on high-DPI phones.
            userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            setSupportMultipleWindows={false}
            nestedScrollEnabled
            scalesPageToFit={false}
            // Ensure the WebView fills the modal and isn't clipped
            overScrollMode="never"
          />
        )}

        {/* Phase: Category selection */}
        {phase === 'category' && (
          <View style={styles.categoryContainer}>
            <FlatList
              data={pickedFiles}
              keyExtractor={item => item.id}
              style={styles.fileList}
              renderItem={({ item }) => (
                <View style={styles.fileRow}>
                  <Check size={16} color={colors.primary[600]} />
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                </View>
              )}
            />

            <Text style={styles.categoryLabel}>Choose a category for all files:</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setSelectedCategory(cat.value)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === cat.value && styles.categoryChipActive,
                  ]}
                >
                  <Text style={[
                    styles.categoryChipText,
                    selectedCategory === cat.value && styles.categoryChipTextActive,
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleImport}
              disabled={!selectedCategory}
              style={[styles.importBtn, !selectedCategory && styles.importBtnDisabled]}
            >
              <Cloud size={18} color="#fff" />
              <Text style={styles.importBtnText}>
                Import {pickedFiles.length} {pickedFiles.length === 1 ? 'File' : 'Files'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phase: Importing */}
        {phase === 'importing' && (
          <View style={styles.centeredContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.importingText}>Importing files...</Text>
          </View>
        )}

        {/* Phase: Results */}
        {phase === 'results' && (
          <View style={styles.resultsContainer}>
            <FlatList
              data={importResults}
              keyExtractor={(item, i) => `${item.fileId}-${i}`}
              renderItem={({ item }) => {
                const file = pickedFiles.find(f => f.id === item.fileId);
                const isSuccess = item.status === 'imported';
                const isExists = item.status === 'already_imported';
                return (
                  <View style={[
                    styles.resultRow,
                    isSuccess ? styles.resultSuccess : isExists ? styles.resultWarn : styles.resultError,
                  ]}>
                    <Text style={styles.resultFileName} numberOfLines={1}>{file?.name || item.fileId}</Text>
                    <Text style={[
                      styles.resultBadge,
                      isSuccess ? styles.resultBadgeSuccess : isExists ? styles.resultBadgeWarn : styles.resultBadgeError,
                    ]}>
                      {isSuccess ? 'Imported' : isExists ? 'Already exists' : item.error || 'Failed'}
                    </Text>
                  </View>
                );
              }}
            />
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[200],
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    backgroundColor: colors.slate[100],
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[500],
    marginTop: 1,
  },
  closeBtn: { padding: spacing.xs },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    flex: 1,
  },
  webview: { flex: 1 },
  categoryContainer: { flex: 1, padding: spacing.lg },
  fileList: { maxHeight: 200, marginBottom: spacing.md },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.slate[50],
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  fileName: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[800],
    flex: 1,
  },
  categoryLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.slate[900],
    marginBottom: spacing.sm,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  categoryChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.slate[200],
    backgroundColor: colors.white,
  },
  categoryChipActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  categoryChipText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.slate[600],
  },
  categoryChipTextActive: { color: colors.primary[700] },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  centeredContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  importingText: {
    fontSize: typography.fontSize.sm,
    color: colors.slate[500],
    marginTop: spacing.md,
  },
  resultsContainer: { flex: 1, padding: spacing.lg },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  resultSuccess: { backgroundColor: colors.success[50], borderColor: colors.success[200] },
  resultWarn: { backgroundColor: colors.warning[50], borderColor: colors.warning[200] },
  resultError: { backgroundColor: colors.error[50], borderColor: colors.error[200] },
  resultFileName: {
    fontSize: typography.fontSize.xs,
    color: colors.slate[700],
    flex: 1,
  },
  resultBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 99,
    overflow: 'hidden',
  },
  resultBadgeSuccess: { backgroundColor: colors.success[100], color: colors.success[700] },
  resultBadgeWarn: { backgroundColor: colors.warning[100], color: colors.warning[700] },
  resultBadgeError: { backgroundColor: colors.error[100], color: colors.error[700] },
  doneBtn: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  doneBtnText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
