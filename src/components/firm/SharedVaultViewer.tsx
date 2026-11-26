import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Lock, X } from 'lucide-react-native';
import { fetchSharedVaultView, getSharedVaultDownload, type ViewAs } from '../../lib/businessSharedApi';
import { PDFJS_SCRIPT_TAGS, PDFJS_WORKER_INIT } from '../../lib/pdfjs';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { useSharePresence } from './useSharePresence';

let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

export interface SharedFileRef {
  documentId: string;
  name: string;
  viewAs: ViewAs;
}

/**
 * pdf.js page fed the PDF's bytes INLINE (base64) — the WebView never sees a URL or a token, and
 * pdf.js draws to canvases with no toolbar, so a view-only file has no save or print control.
 */
function pdfHtml(base64: string): string {
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<style>html,body{margin:0;padding:0;background:#f1f5f9;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}#c{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px}canvas{width:100%;box-shadow:0 1px 4px rgba(0,0,0,.15);background:#fff}#e{font:14px -apple-system,sans-serif;color:#64748b;padding:24px;text-align:center}</style>
${PDFJS_SCRIPT_TAGS}</head><body><div id="c"></div><div id="e" style="display:none">Unable to display this document.</div>
<script id="pdfdata" type="text/plain">${base64}</script>
<script>
(function(){
  function fail(){ document.getElementById('e').style.display='block'; }
  if(!window.pdfjsLib){ fail(); return; }
  ${PDFJS_WORKER_INIT}
  var raw=atob(document.getElementById('pdfdata').textContent);var bytes=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  var scale=(window.devicePixelRatio||1)*(window.innerWidth/612);
  pdfjsLib.getDocument({data:bytes}).promise.then(function(pdf){
    var c=document.getElementById('c');var chain=Promise.resolve();
    for(var p=1;p<=pdf.numPages;p++){(function(n){chain=chain.then(function(){return pdf.getPage(n).then(function(page){
      var vp=page.getViewport({scale:scale});var cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;c.appendChild(cv);
      return page.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;});});})(p);}
    return chain;
  }).catch(fail);
})();
</script></body></html>`;
}

/**
 * The in-app viewer for a file a firm shared (business DECISIONS D9). View only = no download
 * control and no file link; Full access adds Download (opened in the system browser, which saves it).
 */
export function SharedVaultViewer({
  shareId,
  file,
  firmName,
  canDownload,
  onClose,
  trackPresence = true,
}: {
  shareId: string;
  file: SharedFileRef | null;
  firmName: string;
  canDownload: boolean;
  onClose: () => void;
  /** False when a folder browser around this viewer already reports where the person is. */
  trackPresence?: boolean;
}) {
  const [content, setContent] = useState<{ text: string } | { base64: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  useSharePresence(trackPresence && file ? shareId : null, { documentId: file?.documentId });

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setContent(null);
    setError(null);
    if (file.viewAs === 'none') {
      setError(canDownload ? 'This kind of file can’t be shown here. Download it to open it.' : 'This kind of file can’t be shown here, and this share is view only.');
      return;
    }
    fetchSharedVaultView(file.documentId, file.viewAs)
      .then((c) => alive && setContent(c))
      .catch((e) => alive && setError(e?.message || 'Could not open the file'));
    return () => {
      alive = false;
    };
  }, [file?.documentId, file?.viewAs, canDownload]);

  async function download() {
    if (!file) return;
    setDownloading(true);
    try {
      const { url } = await getSharedVaultDownload(file.documentId);
      await Linking.openURL(url);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  if (!file) return null;
  const body = (() => {
    if (error) return <Text style={styles.message}>{error}</Text>;
    if (!content) return <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary[600]} />;
    if ('text' in content && file.viewAs === 'text') {
      return (
        <ScrollView contentContainerStyle={styles.textWrap}>
          <Text selectable={canDownload} style={styles.text}>{content.text}</Text>
        </ScrollView>
      );
    }
    if (!WebView && file.viewAs !== 'image') {
      return <Text style={styles.message}>Open this file on docuintelli.com to view it.</Text>;
    }
    if ('text' in content) {
      // Word converted to HTML: shown with JavaScript off, so nothing in it can run.
      return <WebView originWhitelist={['*']} source={{ html: content.text }} javaScriptEnabled={false} style={styles.web} />;
    }
    if (file.viewAs === 'image') {
      return <Image source={{ uri: `data:image/*;base64,${content.base64}` }} resizeMode="contain" style={styles.image} />;
    }
    return <WebView originWhitelist={['*']} source={{ html: pdfHtml(content.base64) }} javaScriptEnabled style={styles.web} />;
  })();

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.toolbar}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close">
            <X size={20} color={colors.slate[700]} />
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.title} numberOfLines={1}>{file.name}</Text>
            <Text style={styles.sub} numberOfLines={1}>Shared by {firmName}</Text>
          </View>
          {canDownload ? (
            <TouchableOpacity onPress={download} style={styles.downloadBtn} disabled={downloading} accessibilityLabel="Download">
              {downloading ? <ActivityIndicator size="small" color="#fff" /> : <Download size={16} color="#fff" />}
            </TouchableOpacity>
          ) : (
            <View style={styles.viewOnly}>
              <Lock size={12} color={colors.slate[600]} />
              <Text style={styles.viewOnlyText}>View only</Text>
            </View>
          )}
        </View>
        <View style={styles.body}>{body}</View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.slate[100] },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.slate[200],
  },
  iconBtn: { padding: 6 },
  titleCol: { flex: 1 },
  title: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.semibold, color: colors.slate[900] },
  sub: { fontSize: 12, color: colors.slate[500] },
  downloadBtn: { backgroundColor: colors.primary[600], borderRadius: borderRadius.md, padding: 8 },
  viewOnly: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.slate[100],
    borderRadius: borderRadius.full, paddingHorizontal: 8, paddingVertical: 4,
  },
  viewOnlyText: { fontSize: 11, color: colors.slate[600] },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.slate[100] },
  image: { flex: 1, width: '100%' },
  textWrap: { padding: spacing.md },
  text: { fontSize: 14, color: colors.slate[800], backgroundColor: '#fff', padding: spacing.md, borderRadius: borderRadius.md },
  message: { textAlign: 'center', color: colors.slate[600], marginTop: 60, paddingHorizontal: spacing.lg },
});
