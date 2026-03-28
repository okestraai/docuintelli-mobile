import React, { useRef, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  Image,
  StyleSheet,
  PanResponder,
  Platform,
} from 'react-native';
import { Check, Pen } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { FIELD_TYPE_LABELS, SIGNER_COLORS } from '../../types/esignature';
import type { FieldType } from '../../types/esignature';

interface FieldChipProps {
  fieldType: FieldType;
  label?: string | null;
  isFilled: boolean;
  /** The filled value — used to render signature/initials images */
  value?: string;
  signerIndex?: number;
  onPress: () => void;
  style?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  mode: 'signing' | 'placement';
  onDelete?: () => void;
  /** Called when field is dragged to a new position (placement mode) */
  onDragEnd?: (deltaXPercent: number, deltaYPercent: number) => void;
  /** Container dimensions for converting pixels to percent */
  containerSize?: { width: number; height: number };
}

export default function FieldChip({
  fieldType,
  label,
  isFilled,
  value,
  signerIndex = 0,
  onPress,
  style,
  mode,
  onDelete,
  onDragEnd,
  containerSize,
}: FieldChipProps) {
  const signerColor = SIGNER_COLORS[signerIndex % SIGNER_COLORS.length];
  const displayLabel = label || FIELD_TYPE_LABELS[fieldType] || fieldType;

  const borderColor = mode === 'placement'
    ? signerColor
    : isFilled
      ? colors.primary[500]
      : colors.warning[500];

  const bgColor = mode === 'placement'
    ? `${signerColor}20`
    : isFilled
      ? colors.primary[50]
      : colors.warning[50];

  // Drag support for placement mode (web uses mouse events, native uses PanResponder)
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const accumDelta = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    mode === 'placement' && onDragEnd && containerSize
      ? PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, gestureState) =>
            Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
          onPanResponderGrant: () => {
            isDragging.current = false;
          },
          onPanResponderMove: (_, gestureState) => {
            if (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3) {
              isDragging.current = true;
            }
          },
          onPanResponderRelease: (_, gestureState) => {
            if (isDragging.current && containerSize) {
              const deltaXPercent = (gestureState.dx / containerSize.width) * 100;
              const deltaYPercent = (gestureState.dy / containerSize.height) * 100;
              onDragEnd?.(deltaXPercent, deltaYPercent);
            } else {
              onPress();
            }
            isDragging.current = false;
          },
        })
      : null
  ).current;

  // Web drag support
  const handleMouseDown = useCallback((e: any) => {
    if (mode !== 'placement' || !onDragEnd || !containerSize) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    accumDelta.current = { x: 0, y: 0 };

    const onMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startPos.current.x;
      const dy = me.clientY - startPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
      }
      accumDelta.current = { x: dx, y: dy };
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (isDragging.current && containerSize) {
        const deltaXPercent = (accumDelta.current.x / containerSize.width) * 100;
        const deltaYPercent = (accumDelta.current.y / containerSize.height) * 100;
        onDragEnd?.(deltaXPercent, deltaYPercent);
      } else {
        onPress();
      }
      isDragging.current = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [mode, onDragEnd, containerSize, onPress]);

  // Web touch drag support
  const handleTouchStart = useCallback((e: any) => {
    if (mode !== 'placement' || !onDragEnd || !containerSize) return;
    e.stopPropagation();
    const touch = e.touches[0];
    isDragging.current = false;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    accumDelta.current = { x: 0, y: 0 };

    const onTouchMove = (te: TouchEvent) => {
      const t = te.touches[0];
      const dx = t.clientX - startPos.current.x;
      const dy = t.clientY - startPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        isDragging.current = true;
        te.preventDefault();
      }
      accumDelta.current = { x: dx, y: dy };
    };

    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      if (isDragging.current && containerSize) {
        const deltaXPercent = (accumDelta.current.x / containerSize.width) * 100;
        const deltaYPercent = (accumDelta.current.y / containerSize.height) * 100;
        onDragEnd?.(deltaXPercent, deltaYPercent);
      } else {
        onPress();
      }
      isDragging.current = false;
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }, [mode, onDragEnd, containerSize, onPress]);

  const webDragProps = Platform.OS === 'web' && mode === 'placement'
    ? { onMouseDown: handleMouseDown, onTouchStart: handleTouchStart }
    : {};

  // Check if this is a filled signature/initials field with image data
  const isImageField = isFilled && mode === 'signing'
    && (fieldType === 'signature' || fieldType === 'initials')
    && value && value.startsWith('data:');

  const chipContent = isImageField ? (
    <>
      <Image
        source={{ uri: value }}
        style={{ width: '100%' as any, height: '100%' as any }}
        resizeMode="contain"
      />
      {/* Small "change" indicator */}
      <View style={styles.changeIndicator}>
        <Pen size={8} color={colors.primary[600]} />
      </View>
    </>
  ) : (
    <>
      <View style={styles.content}>
        {isFilled && mode === 'signing' ? (
          <Check size={10} color={colors.primary[600]} />
        ) : mode === 'signing' ? (
          <Pen size={10} color={colors.warning[600]} />
        ) : null}
        <Text
          style={[styles.label, { color: mode === 'placement' ? signerColor : isFilled ? colors.primary[700] : colors.warning[700] }]}
          numberOfLines={1}
        >
          {isFilled && mode === 'signing' && value && !value.startsWith('data:')
            ? (fieldType === 'checkbox' ? (value === 'true' ? '✓' : '☐') : value)
            : displayLabel}
        </Text>
      </View>

      {mode === 'placement' && onDelete && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteText}>x</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // In placement mode with drag, use View + panResponder instead of TouchableOpacity
  if (mode === 'placement' && onDragEnd) {
    return (
      <View
        style={[
          styles.chip,
          { borderColor, backgroundColor: bgColor, cursor: 'grab' } as any,
          style,
        ]}
        {...(panResponder?.panHandlers || {})}
        {...webDragProps}
      >
        {chipContent}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor, backgroundColor: bgColor },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {chipContent}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    borderWidth: 1.5,
    borderRadius: 3,
    justifyContent: 'center',
    overflow: 'visible',
    minWidth: 20,
    minHeight: 14,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  label: {
    fontSize: 8,
    fontWeight: '600',
  },
  deleteBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  changeIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
