import { Dimensions, ScaledSize } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// iPhone 15 width = 390px (base design)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const isSmallDevice = SCREEN_WIDTH < 380;
export const isMediumDevice = SCREEN_WIDTH >= 380 && SCREEN_WIDTH < 430;
export const isLargeDevice = SCREEN_WIDTH >= 430;

/**
 * Scale a size value proportionally to the screen width.
 * Use for paddings, margins, gaps, icon sizes, etc.
 */
export function scale(size: number): number {
  return (SCREEN_WIDTH / BASE_WIDTH) * size;
}

/**
 * Scale font sizes with a less aggressive curve (use for text).
 * Prevents fonts from becoming too small on narrow screens.
 */
export function moderateScale(size: number, factor: number = 0.5): number {
  return size + (scale(size) - size) * factor;
}

/**
 * Returns adjusted font size for the current device.
 * On small devices (<380px), reduces font size.
 * On large devices (>430px), increases font size.
 */
export function responsiveFontSize(size: number): number {
  if (isSmallDevice) return Math.round(size * 0.85);
  if (isLargeDevice) return Math.round(size * 1.1);
  return size;
}

/**
 * Returns adjusted padding/margin for the current device.
 */
export function responsiveSpacing(size: number): number {
  if (isSmallDevice) return Math.round(size * 0.8);
  if (isLargeDevice) return Math.round(size * 1.15);
  return size;
}

/**
 * Returns adjusted gap for the current device.
 */
export function responsiveGap(size: number): number {
  if (isSmallDevice) return Math.max(4, Math.round(size * 0.7));
  if (isLargeDevice) return Math.round(size * 1.2);
  return size;
}

/**
 * Hook to get responsive values. Use in components that need dynamic resizing.
 */
export function useResponsive() {
  return {
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    scale,
    moderateScale,
    font: responsiveFontSize,
    spacing: responsiveSpacing,
    gap: responsiveGap,
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
  };
}
