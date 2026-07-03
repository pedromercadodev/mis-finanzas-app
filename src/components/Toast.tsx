import { useCallback, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TOAST_HEIGHT = 60;
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

export default function Toast({
  message,
  visible,
  type = 'info',
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const themeColors = useThemeColors();
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDismissTimer = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      translateY.value = withTiming(120, { duration: 250, easing: Easing.in(Easing.ease) }, () => {
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
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 200,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      startDismissTimer();
    } else {
      translateY.value = 120;
      opacity.value = 0;
      scale.value = 0.8;
      cancelDismissTimer();
    }
    return () => cancelDismissTimer();
  }, [visible]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
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
          [1, 0.85],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((event) => {
      if (event.translationY > 50 || event.velocityY > 500) {
        translateY.value = withTiming(120, { duration: 200 }, () => {
          opacity.value = 0;
          runOnJS(onDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
        opacity.value = withTiming(1, { duration: 150 });
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
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
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 10,
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
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}
