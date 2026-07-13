import { useCallback, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedStyle,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shadows } from '../theme/shadows';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TOAST_HEIGHT = 60;

/**
 * Curva custom cubic-bezier(0.16, 1, 0.3, 1) — "emphasized ease"
 */
const CUSTOM_EASING = Easing.bezier(0.16, 1, 0.3, 1);

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const BG_MAP: Record<ToastType, string> = {
  success: '#059669',
  error: '#DC2626',
  info: '#2563EB',
};

/**
 * Toast — notificación con gesto de swipe-to-dismiss.
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
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismissTimer = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      translateY.value = withTiming(120, {
        duration: 200,
        easing: CUSTOM_EASING,
      }, () => {
        opacity.value = 0;
        runOnJS(onDismiss)();
      });
    }, duration);
  }, [duration, onDismiss, translateY, opacity]);

  const cancelDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (visible) {
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 100,
            left: 16,
            right: 16,
            height: TOAST_HEIGHT,
            backgroundColor: BG_MAP[type],
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 10,
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
      </Animated.View>
    </GestureDetector>
  );
}
