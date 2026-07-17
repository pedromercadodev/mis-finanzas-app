import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  useAnimatedStyle,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../hooks/useThemeColors';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { shadows } from '../theme/shadows';

export type ConfirmType = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ConfirmType;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

const CUSTOM_EASING = Easing.bezier(0.16, 1, 0.3, 1);

const TYPE_CONFIG: Record<ConfirmType, { icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string }> = {
  danger: { icon: 'alert-circle', color: '#DC2626', bgColor: 'rgba(220, 38, 38, 0.12)' },
  warning: { icon: 'warning', color: '#D97706', bgColor: 'rgba(217, 119, 6, 0.12)' },
  info: { icon: 'information-circle', color: '#2563EB', bgColor: 'rgba(37, 99, 235, 0.12)' },
};

/**
 * ConfirmModal — modal de confirmación personalizado que reemplaza Alert.alert()
 *
 * Principios:
 * - Emil §3: multi-layer shadow, sin bordes
 * - Emil §4: custom cubic-bezier para animación de entrada
 * - Apple §16: reduced motion respetado
 * - Accesibilidad: accessibilityLabel en todos los elementos interactivos
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  type = 'info',
  icon,
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  const themeColors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const overlayOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.85);
  const modalTranslateY = useSharedValue(40);

  const config = TYPE_CONFIG[type];
  const displayIcon = icon || config.icon;

  useEffect(() => {
    if (visible) {
      if (reducedMotion) {
        overlayOpacity.value = 1;
        modalScale.value = 1;
        modalTranslateY.value = 0;
      } else {
        overlayOpacity.value = withTiming(1, { duration: 200, easing: CUSTOM_EASING });
        modalScale.value = withSpring(1, { damping: 18, stiffness: 200, mass: 0.7 });
        modalTranslateY.value = withSpring(0, { damping: 20, stiffness: 200, mass: 0.6 });
      }
    } else {
      overlayOpacity.value = 0;
      modalScale.value = 0.85;
      modalTranslateY.value = 40;
    }
  }, [visible, reducedMotion]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: modalScale.value },
      { translateY: modalTranslateY.value },
    ],
    opacity: interpolate(modalScale.value, [0.85, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 32,
          },
          overlayStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: '100%',
              maxWidth: 320,
              backgroundColor: themeColors.surface,
              borderRadius: 24,
              padding: 24,
              alignItems: 'center',
              ...shadows.xl,
              ...Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 24,
                },
                default: {
                  elevation: 12,
                },
              }),
            },
            modalStyle,
          ]}
        >
          {/* Icono */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: config.bgColor,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name={displayIcon} size={28} color={config.color} />
          </View>

          {/* Título */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: themeColors.text,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {title}
          </Text>

          {/* Mensaje */}
          <Text
            style={{
              fontSize: 14,
              color: themeColors.textSecondary,
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>

          {/* Botones */}
          <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityLabel={cancelLabel}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: themeColors.surfaceElevated || (themeColors as any).card || 'rgba(128,128,128,0.1)',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: themeColors.textSecondary,
                }}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              accessibilityLabel={confirmLabel}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: destructive ? '#DC2626' : config.color,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
