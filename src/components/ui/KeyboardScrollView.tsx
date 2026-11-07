import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from 'react-native';

const GAP_ABOVE_KEYBOARD = 16;

// How far a form must scroll so an input that ends at inputBottom sits above the keyboard.
export function scrollNeeded(inputBottom: number, keyboardTop: number): number {
  return Math.max(0, inputBottom + GAP_ABOVE_KEYBOARD - keyboardTop);
}

// A form's scroll view: the focused input stays above the keyboard, and tapping a button works first time.
const KeyboardScrollView = forwardRef<ScrollView, ScrollViewProps>(({ onScroll, contentContainerStyle, ...props }, ref) => {
  const scroller = useRef<ScrollView>(null);
  const offset = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useImperativeHandle(ref, () => scroller.current as ScrollView);

  // iOS moves the content by itself; an edge-to-edge Android screen doesn't.
  useEffect(() => {
    if (Platform.OS !== 'android' || props.horizontal) return;
    const shown = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const input = TextInput.State.currentlyFocusedInput() as unknown as { measureInWindow?: (done: (x: number, y: number, width: number, height: number) => void) => void } | null;
      // Waits a frame so the room just added below the form exists to scroll into.
      requestAnimationFrame(() => {
        input?.measureInWindow?.((_x, y, _width, height) => {
          const distance = scrollNeeded(y + height, event.endCoordinates.screenY);
          if (distance > 0) scroller.current?.scrollTo({ y: offset.current + distance, animated: true });
        });
      });
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [props.horizontal]);

  const trackOffset = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
    onScroll?.(event);
  };

  return (
    <ScrollView
      ref={scroller}
      automaticallyAdjustKeyboardInsets={!props.horizontal}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      scrollEventThrottle={16}
      {...props}
      onScroll={trackOffset}
      contentContainerStyle={keyboardHeight > 0 ? [contentContainerStyle, { paddingBottom: keyboardHeight }] : contentContainerStyle}
    />
  );
});

KeyboardScrollView.displayName = 'KeyboardScrollView';

export default KeyboardScrollView;
