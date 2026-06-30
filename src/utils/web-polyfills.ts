/**
 * Polyfills para web de componentes React Native que no funcionan correctamente en navegador.
 *
 * - SafeAreaView: en web no hay "notch" ni "safe area", así que usamos un View normal.
 * - useSafeAreaInsets: en web devuelve { top: 0, bottom: 0, left: 0, right: 0 }.
 * - KeyboardAvoidingView: en web no tiene sentido, usamos un View normal.
 */

import React from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';

const isWeb = Platform.OS === 'web';

// ============================================================
// SafeAreaView polyfill
// ============================================================
export function SafeAreaView(props: ViewProps & { children?: React.ReactNode }) {
  if (isWeb) {
    return React.createElement(View, props);
  }
  // Lazy require para evitar errores en web
  const NativeSafeAreaView = require('react-native-safe-area-context').SafeAreaView;
  return React.createElement(NativeSafeAreaView, props);
}

// ============================================================
// useSafeAreaInsets polyfill
// ============================================================
export function useSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (isWeb) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const { useSafeAreaInsets: nativeHook } = require('react-native-safe-area-context');
  return nativeHook();
}

// ============================================================
// KeyboardAvoidingView polyfill
// ============================================================
interface KeyboardAvoidingViewProps extends ViewProps {
  children?: React.ReactNode;
  behavior?: 'height' | 'position' | 'padding' | undefined;
  keyboardVerticalOffset?: number;
  enabled?: boolean;
}

export function KeyboardAvoidingView(props: KeyboardAvoidingViewProps) {
  if (isWeb) {
    const { behavior, keyboardVerticalOffset, enabled, ...viewProps } = props;
    return React.createElement(View, viewProps);
  }
  const NativeKeyboardAvoidingView = require('react-native').KeyboardAvoidingView;
  return React.createElement(NativeKeyboardAvoidingView, props);
}
