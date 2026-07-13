import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook que detecta si el usuario prefiere movimiento reducido
 * (accesibilidad: prefers-reduced-motion).
 *
 * Útil para deshabilitar o simplificar animaciones cuando
 * el usuario tiene esta preferencia activada en el sistema.
 *
 * @returns {boolean} true si el usuario prefiere movimiento reducido
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Consultar el valor inicial
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setPrefersReducedMotion(enabled);
    });

    // Suscribirse a cambios en la preferencia
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setPrefersReducedMotion(enabled);
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return prefersReducedMotion;
}
