import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import FieldChip from './FieldChip';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { EsignField, PlacedField, SignerEntry, FieldType } from '../../types/esignature';

interface PdfFieldOverlayProps {
  pdfUrl: string;
  authToken?: string;
  mode: 'signing' | 'placement';
  fields?: EsignField[];
  filledFields?: Record<string, string>;
  onFieldPress?: (field: EsignField) => void;
  placedFields?: PlacedField[];
  signers?: SignerEntry[];
  selectedFieldType?: FieldType | null;
  selectedSignerEmail?: string | null;
  onPlaceField?: (xPercent: number, yPercent: number, pageNumber: number) => void;
  onDeleteField?: (fieldId: string) => void;
  onMoveField?: (fieldId: string, deltaXPercent: number, deltaYPercent: number) => void;
  onFieldPress2?: (field: PlacedField) => void;
}

const SCREEN_WIDTH = require('../../utils/dimensions').getScreenWidth();
const PDF_VIEW_WIDTH = SCREEN_WIDTH;

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── Web: Offscreen PDF → Image approach ──────────────────────────────────

function useWebPdfAsImage(pdfUrl: string, currentPage: number, authToken?: string) {
  const pdfDocRef = useRef<any>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImageUri, setPageImageUri] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load pdf.js library
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if ((window as any).pdfjsLib) return;

    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
    };
    document.head.appendChild(script);
  }, []);

  // Load PDF document
  useEffect(() => {
    if (Platform.OS !== 'web' || !pdfUrl) return;
    let cancelled = false;

    const waitForLib = () => new Promise<void>((resolve) => {
      if ((window as any).pdfjsLib) { resolve(); return; }
      const interval = setInterval(() => {
        if ((window as any).pdfjsLib) { clearInterval(interval); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(interval); resolve(); }, 15000);
    });

    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        await waitForLib();

        const pdfjsLib = (window as any).pdfjsLib;
        if (!pdfjsLib) { setError('PDF library failed to load'); return; }

        const fetchOpts: RequestInit = authToken
          ? { headers: { 'Authorization': `Bearer ${authToken}` } }
          : {};
        const resp = await fetch(pdfUrl, fetchOpts);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const ab = await resp.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: ab }).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setTotalPages(doc.numPages);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load PDF');
      }
    })();

    return () => { cancelled = true; };
  }, [pdfUrl, authToken]);

  // Render current page to offscreen canvas → data URL
  useEffect(() => {
    if (Platform.OS !== 'web' || !pdfDocRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        setIsLoading(true);
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = PDF_VIEW_WIDTH / baseViewport.width;
        const renderScale = fitScale * 2;
        const viewport = page.getViewport({ scale: renderScale });

        const offCanvas = document.createElement('canvas');
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;

        const dataUrl = offCanvas.toDataURL('image/png');
        const displayW = PDF_VIEW_WIDTH;
        const displayH = Math.round(baseViewport.height * fitScale);

        setPageImageUri(dataUrl);
        setPageSize({ width: displayW, height: displayH });
        setIsLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          console.error('PDF render error:', err);
          setError('Failed to render page');
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentPage, pdfDocRef.current ? 'loaded' : 'pending']);

  return { totalPages, pageImageUri, pageSize, isLoading, error };
}

// ── Native: WebView HTML for pdf.js ──────────────────────────────────────

// Build WebView HTML that receives PDF data via postMessage (no fetch needed)
function makePdfViewerHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="${PDFJS_CDN}"><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#fff}
  canvas{display:block;width:100%;background:#fff}
  .loading{color:#64748b;font-family:system-ui;font-size:14px;text-align:center;padding:40px}
  .error{color:#dc2626}
</style>
</head>
<body>
<div class="loading" id="loading">Preparing PDF...</div>
<canvas id="canvas" style="display:none"></canvas>
<script>
  pdfjsLib.GlobalWorkerOptions.workerSrc='${PDFJS_WORKER_CDN}';
  var postMsg=function(d){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(d);}catch(e){}};
  var pdfDoc=null,currentPage=1;

  async function loadPdfFromData(base64){
    try{
      var raw=atob(base64);
      var arr=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i);
      pdfDoc=await pdfjsLib.getDocument({data:arr}).promise;
      postMsg(JSON.stringify({type:'pdfLoaded',totalPages:pdfDoc.numPages}));
      renderPage(1);
    }catch(e){
      document.getElementById('loading').textContent='Failed: '+(e.message||'Unknown error');
      document.getElementById('loading').className='loading error';
      postMsg(JSON.stringify({type:'error',message:e.message||'PDF load failed'}));
    }
  }

  async function renderPage(num){
    if(!pdfDoc)return;
    currentPage=num;
    var page=await pdfDoc.getPage(num);
    var canvas=document.getElementById('canvas');
    var ctx=canvas.getContext('2d');
    var bv=page.getViewport({scale:1});
    var dw=document.body.clientWidth;
    var scale=dw/bv.width;
    var sv=page.getViewport({scale:scale});
    canvas.width=sv.width;canvas.height=sv.height;
    canvas.style.width=dw+'px';canvas.style.height=sv.height+'px';
    document.getElementById('loading').style.display='none';
    canvas.style.display='block';
    await page.render({canvasContext:ctx,viewport:sv}).promise;
    postMsg(JSON.stringify({type:'pageRendered',page:num,width:dw,height:sv.height}));
  }

  document.getElementById('canvas').addEventListener('click',function(e){
    var r=e.target.getBoundingClientRect();
    var xPct=((e.clientX-r.left)/r.width)*100;
    var yPct=((e.clientY-r.top)/r.height)*100;
    postMsg(JSON.stringify({type:'tap',xPercent:xPct,yPercent:yPct,page:currentPage}));
  });

  window.addEventListener('message',function(e){
    try{
      var m=JSON.parse(e.data);
      if(m.type==='goToPage'&&pdfDoc)renderPage(m.page);
      if(m.type==='loadPdf')loadPdfFromData(m.data);
    }catch(ex){}
  });
  document.addEventListener('message',function(e){
    try{
      var m=JSON.parse(e.data);
      if(m.type==='goToPage'&&pdfDoc)renderPage(m.page);
      if(m.type==='loadPdf')loadPdfFromData(m.data);
    }catch(ex){}
  });

  postMsg(JSON.stringify({type:'ready'}));
<\/script>
</body>
</html>`;
}

// ── Field overlay layer (shared between web and native) ──────────────────

function FieldOverlays({
  mode,
  isLoading,
  hasSize,
  currentFields,
  canvasSize,
  filledFields,
  signers,
  onFieldPress,
  onFieldPress2,
  onDeleteField,
  onMoveField,
}: {
  mode: 'signing' | 'placement';
  isLoading: boolean;
  hasSize: boolean;
  currentFields: (EsignField | PlacedField)[];
  canvasSize: { width: number; height: number };
  filledFields: Record<string, string>;
  signers: SignerEntry[];
  onFieldPress?: (field: EsignField) => void;
  onFieldPress2?: (field: PlacedField) => void;
  onDeleteField?: (fieldId: string) => void;
  onMoveField?: (fieldId: string, deltaXPercent: number, deltaYPercent: number) => void;
}) {
  if (isLoading || !hasSize) return null;

  const signerEmailIndex = (email: string) => {
    const idx = signers.findIndex((s) => s.email === email);
    return idx >= 0 ? idx : 0;
  };

  const fieldStyle = (xPct: number, yPct: number, wPct: number, hPct: number) => ({
    left: (xPct / 100) * canvasSize.width,
    top: (yPct / 100) * canvasSize.height,
    width: (wPct / 100) * canvasSize.width,
    height: (hPct / 100) * canvasSize.height,
  });

  if (mode === 'signing') {
    return (
      <>
        {(currentFields as EsignField[]).map((field) => (
          <FieldChip
            key={field.id}
            fieldType={field.field_type}
            label={field.label}
            isFilled={!!filledFields[field.id]}
            value={filledFields[field.id]}
            onPress={() => onFieldPress?.(field)}
            mode="signing"
            style={fieldStyle(field.x_percent, field.y_percent, field.width_percent, field.height_percent)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {(currentFields as PlacedField[]).map((field) => (
        <FieldChip
          key={field.id}
          fieldType={field.fieldType}
          label={field.label}
          isFilled={false}
          signerIndex={signerEmailIndex(field.signerEmail)}
          onPress={() => onFieldPress2?.(field)}
          onDelete={() => onDeleteField?.(field.id)}
          onDragEnd={(dx, dy) => onMoveField?.(field.id, dx, dy)}
          containerSize={canvasSize}
          mode="placement"
          style={fieldStyle(field.xPercent, field.yPercent, field.widthPercent, field.heightPercent)}
        />
      ))}
    </>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function PdfFieldOverlay({
  pdfUrl,
  authToken,
  mode,
  fields = [],
  filledFields = {},
  onFieldPress,
  placedFields = [],
  signers = [],
  selectedFieldType,
  selectedSignerEmail,
  onPlaceField,
  onDeleteField,
  onMoveField,
  onFieldPress2,
}: PdfFieldOverlayProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: PDF_VIEW_WIDTH, height: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  // Use refs for values that the WebView onMessage callback needs,
  // since the callback is captured once and doesn't update with re-renders
  const selectedFieldTypeRef = useRef(selectedFieldType);
  const selectedSignerEmailRef = useRef(selectedSignerEmail);
  const onPlaceFieldRef = useRef(onPlaceField);
  const modeRef = useRef(mode);
  selectedFieldTypeRef.current = selectedFieldType;
  selectedSignerEmailRef.current = selectedSignerEmail;
  onPlaceFieldRef.current = onPlaceField;
  modeRef.current = mode;

  // Web: use offscreen pdf→image hook
  const webPdf = useWebPdfAsImage(pdfUrl, currentPage, authToken);

  // Sync web PDF state into component state
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setTotalPages(webPdf.totalPages);
    if (webPdf.pageSize.height > 0) {
      setCanvasSize(webPdf.pageSize);
    }
    setIsLoading(webPdf.isLoading);
  }, [webPdf.totalPages, webPdf.pageSize.width, webPdf.pageSize.height, webPdf.isLoading]);

  // Pre-fetch PDF as base64 using expo-file-system (avoids CORS/auth/btoa issues)
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const webViewReady = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !pdfUrl) return;
    let cancelled = false;
    (async () => {
      try {
        // Use fetch to get the PDF as blob
        // Include auth header only for API URLs (not SAS URLs which reject it)
        const fetchOpts: RequestInit = {};
        if (authToken && pdfUrl.includes('/api/')) {
          fetchOpts.headers = { Authorization: `Bearer ${authToken}` };
        }
        const res = await fetch(pdfUrl, fetchOpts);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        // Convert blob to base64 via FileReader
        const b64: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            // Strip "data:application/pdf;base64," prefix
            resolve(dataUrl.split(',')[1] || dataUrl);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (!cancelled) {
          setPdfBase64(b64);
          if (webViewReady.current && webViewRef.current) {
            const msg = JSON.stringify({ type: 'loadPdf', data: b64 });
            webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(msg)},'*');true;`);
          }
        }
      } catch (err: any) {
        console.error('[PdfFieldOverlay] Failed to fetch PDF:', err.message);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pdfUrl, authToken]);

  // Native: WebView message handler — uses refs to always read latest values
  const pdfBase64Ref = useRef(pdfBase64);
  pdfBase64Ref.current = pdfBase64;

  const handleNativeMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'ready':
          webViewReady.current = true;
          if (pdfBase64Ref.current && webViewRef.current) {
            const payload = JSON.stringify({ type: 'loadPdf', data: pdfBase64Ref.current });
            webViewRef.current.injectJavaScript(`window.postMessage(${JSON.stringify(payload)},'*');true;`);
          }
          break;
        case 'pdfLoaded':
          setTotalPages(msg.totalPages);
          break;
        case 'pageRendered':
          setCurrentPage(msg.page);
          if (msg.width && msg.height) setCanvasSize({ width: msg.width, height: msg.height });
          setIsLoading(false);
          break;
        case 'tap':
          if (modeRef.current === 'placement' && selectedFieldTypeRef.current && selectedSignerEmailRef.current && onPlaceFieldRef.current) {
            onPlaceFieldRef.current(msg.xPercent, msg.yPercent, msg.page);
          }
          break;
        case 'error':
          setIsLoading(false);
          break;
      }
    } catch {}
  }, []);

  // Web: handle tap on the image to place fields
  const handleImagePress = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    if (mode !== 'placement' || !selectedFieldType || !selectedSignerEmail || !onPlaceField) return;

    const nativeEvent = e.nativeEvent || e;
    const target = nativeEvent.target || nativeEvent.currentTarget;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = (nativeEvent.clientX || nativeEvent.pageX) - rect.left;
    const y = (nativeEvent.clientY || nativeEvent.pageY) - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    onPlaceField(xPercent, yPercent, currentPage);
  }, [mode, selectedFieldType, selectedSignerEmail, onPlaceField, currentPage]);

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setIsLoading(true);
    if (Platform.OS !== 'web') {
      const msg = JSON.stringify({ type: 'goToPage', page });
      webViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(msg)},'*');true;`);
    }
  }, [totalPages]);

  const currentFields = mode === 'signing'
    ? fields.filter((f) => f.page_number === currentPage)
    : placedFields.filter((f) => f.pageNumber === currentPage);

  const hasSize = canvasSize.height > 0;

  // ── Web render: absolute-positioned div with CSS overflow ──
  // Uses position:absolute to fill parent (bypasses flex chain issues on RN Web)
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          } as any}
        >
          {/* PDF page as image + field overlays */}
          <div style={{ position: 'relative', width: canvasSize.width } as any}>
            {webPdf.pageImageUri ? (
              <img
                src={webPdf.pageImageUri}
                onClick={handleImagePress}
                style={{
                  display: 'block',
                  width: canvasSize.width,
                  height: canvasSize.height,
                  cursor: selectedFieldType && selectedSignerEmail ? 'crosshair' : 'default',
                  userSelect: 'none',
                } as any}
                draggable={false}
                alt="PDF page"
              />
            ) : webPdf.error ? (
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>{webPdf.error}</Text>
              </View>
            ) : null}

            {/* Field overlays */}
            <FieldOverlays
              mode={mode}
              isLoading={isLoading}
              hasSize={hasSize}
              currentFields={currentFields}
              canvasSize={canvasSize}
              filledFields={filledFields}
              signers={signers}
              onFieldPress={onFieldPress}
              onFieldPress2={onFieldPress2}
              onDeleteField={onDeleteField}
              onMoveField={onMoveField}
            />
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        )}

        {/* Page navigation */}
        {totalPages > 1 && !isLoading && (
          <View style={styles.pageNav}>
            <TouchableOpacity
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={[styles.pageNavBtn, currentPage <= 1 && styles.pageNavBtnDisabled]}
            >
              <ChevronLeft size={14} color={currentPage <= 1 ? '#ccc' : '#fff'} />
            </TouchableOpacity>
            <Text style={styles.pageIndicator}>
              {currentPage} / {totalPages}
            </Text>
            <TouchableOpacity
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={[styles.pageNavBtn, currentPage >= totalPages && styles.pageNavBtnDisabled]}
            >
              <ChevronRight size={14} color={currentPage >= totalPages ? '#ccc' : '#fff'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // ── Native render: ScrollView + WebView ──
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollArea} bounces={false}>
        <View style={[styles.pdfWrapper, hasSize && { height: canvasSize.height }]}>
          <WebView
            ref={webViewRef}
            source={{ html: makePdfViewerHtml(), baseUrl: 'https://docuintelli.com' }}
            style={styles.webview}
            scrollEnabled={false}
            bounces={false}
            onMessage={handleNativeMessage}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['https://*']}
            mixedContentMode="never"
          />

          <FieldOverlays
            mode={mode}
            isLoading={isLoading}
            hasSize={hasSize}
            currentFields={currentFields}
            canvasSize={canvasSize}
            filledFields={filledFields}
            signers={signers}
            onFieldPress={onFieldPress}
            onFieldPress2={onFieldPress2}
            onDeleteField={onDeleteField}
            onMoveField={onMoveField}
          />
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}

      {totalPages > 1 && !isLoading && (
        <View style={styles.pageNav}>
          <TouchableOpacity
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            style={[styles.pageNavBtn, currentPage <= 1 && styles.pageNavBtnDisabled]}
          >
            <ChevronLeft size={14} color={currentPage <= 1 ? '#ccc' : '#fff'} />
          </TouchableOpacity>
          <Text style={styles.pageIndicator}>
            {currentPage} / {totalPages}
          </Text>
          <TouchableOpacity
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={[styles.pageNavBtn, currentPage >= totalPages && styles.pageNavBtnDisabled]}
          >
            <ChevronRight size={14} color={currentPage >= totalPages ? '#ccc' : '#fff'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[100],
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
  },
  pdfWrapper: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  errorWrap: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.error[500],
  },
  pageNav: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pageNavBtn: {
    padding: 2,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageIndicator: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.slate[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: colors.slate[500],
  },
});
