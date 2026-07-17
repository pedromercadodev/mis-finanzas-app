import { useCallback, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, Platform, View } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedStyle,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
  useDerivedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shadows } from '../theme/shadows';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TOAST_HEIGHT = 64;

/**
 * Curva custom cubic-bezier(0.16, 1, 0.3, 1) — "emphasized ease"
 */
const CUSTOM_EASING = Easing.bezier(0.16, 1, 0.3, 1);

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

const BG_MAP: Record<ToastType, string> = {
  success: '#059669',
  error: '#DC2626',
  info: '#2563EB',
  warning: '#D97706',
};

/**
 * Toast — notificación con gesto de swipe-to-dismiss y barra de progreso.
 *
 * Principios aplicados:
 * - Emil §3: multi-layer shadow (shadows.xl + shadow tintada), sin bordes
 * - Emil §4: custom cubic-bezier para entrada/salida
 * - Emil §5: gesture interruptible (pan gesture con interpolación)
 * - Apple §12: fondo semi-translúcido en iOS
 * - Apple §16: reduced motion respetado
 */
export default function Toast({
  message,
  visible,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const progress = useSharedValue(1);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressStart = useRef<number>(0);

  const startDismissTimer = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    progressStart.current = Date.now();
    progress.value = withTiming(0, {
      duration,
      easing: Easing.linear,
    });
    dismissTimer.current = setTimeout(() => {
      translateY.value = withTiming(120, {
        duration: 200,
        easing: CUSTOM_EASING,
      }, () => {
        opacity.value = 0;
        runOnJS(onDismiss)();
      });
    }, duration);
  }, [duration, onDismiss, translateY, opacity, progress]);

  const cancelDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    // Pausar la barra de progreso
    const elapsed = Date.now() - progressStart.current;
    const remaining = Math.max(0, 1 - elapsed / duration);
    progress.value = remaining;
  }, [duration, progress]);

  const resumeDismissTimer = useCallback(() => {
    if (dismissTimer.current) return;
    const elapsed = Date.now() - progressStart.current;
    const remaining = Math.max(0, duration - elapsed);
    if (remaining <= 0) {
      runOnJS(onDismiss)();
      return;
    }
    progress.value = withTiming(0, {
      duration: remaining,
      easing: Easing.linear,
    });
    dismissTimer.current = setTimeout(() => {
      translateY.value = withTiming(120, {
        duration: 200,
        easing: CUSTOM_EASING,
      }, () => {
        opacity.value = 0;
        runOnJS(onDismiss)();
      });
    }, remaining);
  }, [duration, onDismiss, translateY, opacity, progress]);

  useEffect(() => {
    if (visible) {
      progress.value = 1;
      if (reducedMotion) {
        translateY.value = 0;
        opacity.value = 1;
        scale.value = 1;
        startDismissTimer();
      } else {
        translateY.value = withSpring(0, {
          damping: 16,
          stiffness: 220,
          mass: 0.7,
        });
        opacity.value = withTiming(1, { duration: 180, easing: CUSTOM_EASING });
        scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 });
        startDismissTimer();
      }
    } else {
      translateY.value = 120;
      opacity.value = 0;
      scale.value = 0.85;
      progress.value = 1;
      cancelDismissTimer();
    }
    return () => cancelDismissTimer();
  }, [visible, reducedMotion]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (reducedMotion) return;
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        opacity.value = interpolate(
          event.translationY,
          [0, 80],
          [1, 0],
          Extrapolation.CLAMP
        );
        scale.value = interpolate(
          event.translationY,
          [0, 80],
          [1, 0.9],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((event) => {
      if (reducedMotion) {
        runOnJS(onDismiss)();
        return;
      }
      if (event.translationY > 50 || event.velocityY > 500) {
        translateY.value = withTiming(120, { duration: 180, easing: CUSTOM_EASING }, () => {
          opacity.value = 0;
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 16, stiffness: 220, mass: 0.7 });
        opacity.value = withTiming(1, { duration: 120, easing: CUSTOM_EASING });
        scale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 });
        runOnJS(startDismissTimer)();
      }
    });

  const tapGesture = Gesture.Tap()
    .onBegin(() => {
      runOnJS(cancelDismissTimer)();
    })
    .onEnd(() => {
      runOnJS(resumeDismissTimer)();
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 100,
            left: 16,
            right: 16,
            minHeight: TOAST_HEIGHT,
            backgroundColor: BG_MAP[type],
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 18,
            gap: 10,
            overflow: 'hidden',
            // Multi-layer shadow: sombra base + tintada
            ...shadows.xl,
            // Sombra tintada adicional para profundidad extra
            ...Platform.select({
              ios: {
                shadowColor: BG_MAP[type],
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
              },
              default: {},
            }),
            zIndex: 9999,
          },
          animatedStyle,
        ]}
      >
        <Ionicons name={ICON_MAP[type]} size={24} color="#FFF" />
        <Text
          style={{
            flex: 1,
            color: '#FFF',
            fontSize: 14,
            fontWeight: '600',
          }}
          numberOfLines={2}
        >
          {message}
        </Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Cerrar notificación"
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        {/* Barra de progreso */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              height: 3,
              backgroundColor: 'rgba(255,255,255,0.35)',
              borderBottomLeftRadius: 16,
            },
            progressBarStyle,
          ]}
        />
      </Animated.View>
    </GestureDetector>
  );
}
