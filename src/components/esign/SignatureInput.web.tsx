import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, Pen, Type, Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface SignatureInputProps {
  visible: boolean;
  onSave: (imageData: string) => void;
  onCancel: () => void;
  title?: string;
  type?: 'signature' | 'initials';
}

type InputMode = 'draw' | 'type';

const SIGNATURE_FONTS = [
  { name: 'Dancing Script', label: 'Elegant' },
  { name: 'Great Vibes', label: 'Classic' },
  { name: 'Satisfy', label: 'Casual' },
  { name: 'Pacifico', label: 'Bold' },
];

// ── Web: Direct canvas drawing component ─────────────────────────────────

function WebDrawCanvas({
  canvasRef,
}: {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const t = 'touches' in e ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function onStart(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawingRef.current = true;
      const p = getPos(e);
      ctx!.beginPath();
      ctx!.moveTo(p.x, p.y);
    }
    function onMove(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      if (!drawingRef.current) return;
      const p = getPos(e);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
    }
    function onEnd(e: Event) {
      e.preventDefault();
      drawingRef.current = false;
    }

    canvas.addEventListener('mousedown', onStart);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseup', onEnd);
    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onStart);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseup', onEnd);
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
    };
  }, [canvasRef]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#fff' } as any}
    >
      <canvas
        ref={canvasRef as any}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' } as any}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function SignatureInput({ visible, onSave, onCancel, title, type = 'signature' }: SignatureInputProps) {
  const [mode, setMode] = useState<InputMode>('draw');
  const [typedText, setTypedText] = useState('');
  const [selectedFont, setSelectedFont] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const webCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const heading = title || (type === 'initials' ? 'Enter Your Initials' : 'Enter Your Signature');

  const handleDrawSave = useCallback(() => {
    const canvas = webCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((v, i) => i % 4 === 3 && v > 0);
    if (!hasContent) return;
    const data = canvas.toDataURL('image/png');
    onSave(data);
  }, [onSave]);

  const handleDrawClear = useCallback(() => {
    const canvas = webCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const handleTypeSave = useCallback(() => {
    if (!typedText.trim()) return;

    const fontName = SIGNATURE_FONTS[selectedFont].name;
    const text = typedText.trim();

    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    setIsExporting(true);
    const tryRender = () => {
      const offCanvas = document.createElement('canvas');
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return;

      const font = `48px "${fontName}"`;
      ctx.font = font;
      const metrics = ctx.measureText(text);
      const w = Math.ceil(metrics.width) + 40;
      const h = 80;
      offCanvas.width = w * 2;
      offCanvas.height = h * 2;
      ctx.scale(2, 2);
      ctx.font = font;
      ctx.fillStyle = '#1e293b';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 20, h / 2);
      const data = offCanvas.toDataURL('image/png');
      setIsExporting(false);
      onSave(data);
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(tryRender, 100));
    } else {
      setTimeout(tryRender, 1000);
    }
  }, [typedText, selectedFont, onSave]);

  const modeButtons: { key: InputMode; icon: typeof Pen; label: string }[] = [
    { key: 'draw', icon: Pen, label: 'Draw' },
    { key: 'type', icon: Type, label: 'Type' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{heading}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={20} color={colors.slate[500]} />
            </TouchableOpacity>
          </View>

          {/* Mode tabs */}
          <View style={styles.modeTabs}>
            {modeButtons.map(({ key, icon: Icon, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.modeTab, mode === key && styles.modeTabActive]}
                onPress={() => setMode(key)}
              >
                <Icon size={16} color={mode === key ? colors.primary[600] : colors.slate[400]} />
                <Text style={[styles.modeTabText, mode === key && styles.modeTabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <View style={styles.content}>
            {mode === 'draw' && (
              <View style={styles.canvasContainer}>
                <WebDrawCanvas canvasRef={webCanvasRef} />
                <Text style={styles.hint}>Draw your {type} above</Text>
              </View>
            )}

            {mode === 'type' && (
              <View style={styles.typeContainer}>
                <TextInput
                  style={styles.typeInput}
                  value={typedText}
                  onChangeText={setTypedText}
                  placeholder={type === 'initials' ? 'Enter initials' : 'Type your name'}
                  placeholderTextColor={colors.slate[400]}
                  autoFocus
                />
                <Text style={styles.fontLabel}>Choose a style:</Text>
                <View style={styles.fontGrid}>
                  {SIGNATURE_FONTS.map((font, idx) => (
                    <TouchableOpacity
                      key={font.name}
                      style={[styles.fontOption, selectedFont === idx && styles.fontOptionActive]}
                      onPress={() => setSelectedFont(idx)}
                    >
                      <Text style={styles.fontOptionLabel}>{font.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {mode === 'draw' && (
              <>
                <TouchableOpacity style={styles.clearBtn} onPress={handleDrawClear}>
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleDrawSave}>
                  <Check size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
            {mode === 'type' && (
              <TouchableOpacity
                style={[styles.saveBtn, !typedText.trim() && styles.saveBtnDisabled]}
                onPress={handleTypeSave}
                disabled={!typedText.trim() || isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.slate[900],
  },
  closeBtn: {
    padding: spacing.xs,
  },
  modeTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.slate[100],
    borderRadius: borderRadius.md,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  modeTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate[400],
  },
  modeTabTextActive: {
    color: colors.primary[600],
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  canvasContainer: {
    height: 180,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: borderRadius.md,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.slate[400],
    paddingVertical: 4,
  },
  typeContainer: {
    gap: spacing.md,
  },
  typeInput: {
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 18,
    color: colors.slate[900],
  },
  fontLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.slate[600],
  },
  fontGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fontOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate[200],
    backgroundColor: colors.slate[50],
  },
  fontOptionActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  fontOptionLabel: {
    fontSize: 13,
    color: colors.slate[700],
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  clearBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.slate[300],
  },
  clearBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate[600],
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[600],
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
