import React, { forwardRef } from 'react';
import { Platform, ScrollView, type ScrollViewProps } from 'react-native';

// A form's scroll view: the focused input stays above the keyboard, and tapping a button works first time.
const KeyboardScrollView = forwardRef<ScrollView, ScrollViewProps>((props, ref) => (
  <ScrollView
    ref={ref}
    automaticallyAdjustKeyboardInsets={!props.horizontal}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    {...props}
  />
));

KeyboardScrollView.displayName = 'KeyboardScrollView';

export default KeyboardScrollView;
