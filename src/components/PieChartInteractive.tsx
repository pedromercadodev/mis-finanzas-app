import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatUSD } from '../utils/format';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface PieSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartInteractiveProps {
  data: PieSlice[];
  size?: number;
  innerRadius?: number; // 0 = pastel, >0 = dona
}

interface SliceAngles {
  startAngle: number;
  endAngle: number;
  midAngle: number;
}

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

const CHART_COLORS = [
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function PieChartInteractive({
  data,
  size = SCREEN_WIDTH - 80,
  innerRadius = 0,
}: PieChartInteractiveProps) {
  const themeColors = useThemeColors();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animDone, setAnimDone] = useState(false);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 10;

  // Calcular ángulos para cada slice
  const slices: (PieSlice & SliceAngles)[] = [];
  let currentAngle = 0;
  data.forEach((slice) => {
    const sliceAngle = (slice.percentage / 100) * 360;
    slices.push({
      ...slice,
      startAngle: currentAngle,
      endAngle: currentAngle + sliceAngle,
      midAngle: currentAngle + sliceAngle / 2,
    });
    currentAngle += sliceAngle;
  });

  // Animación de entrada: progreso de 0 a 1
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    setAnimDone(false);
    // Animar slices una por una
    progress.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
    const timer = setTimeout(() => setAnimDone(true), 900);
    return () => clearTimeout(timer);
  }, [data]);

  const selectedSlice = selectedId
    ? slices.find((s) => s.id === selectedId)
    : null;

  const handleSlicePress = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // Si no hay datos, mostrar mensaje
  if (data.length === 0) {
    return (
      <View
        style={{
          width: size,
          height: size,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: themeColors.textSecondary, fontSize: 14 }}>
          Sin datos disponibles
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {slices.map((slice, index) => {
          const isSelected = slice.id === selectedId;
          const explodeOffset = isSelected ? 8 : 0;

          // Calcular posición desplazada para el explode
          const explodeRad = ((slice.midAngle - 90) * Math.PI) / 180;
          const dx = explodeOffset * Math.cos(explodeRad);
          const dy = explodeOffset * Math.sin(explodeRad);

          const pathData = describeArc(
            cx + dx,
            cy + dy,
            outerR,
            slice.startAngle,
            slice.endAngle
          );

          return (
            <G key={slice.id}>
              <Path
                d={pathData}
                fill={slice.color}
                opacity={selectedId && !isSelected ? 0.4 : 0.95}
                onPress={() => handleSlicePress(slice.id)}
                stroke={themeColors.surface}
                strokeWidth={2}
              />
            </G>
          );
        })}

        {/* Label del slice seleccionado en el centro */}
        {selectedSlice && (
          <>
            <SvgText
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fontSize={14}
              fontWeight="700"
              fill={themeColors.text}
            >
              {selectedSlice.label}
            </SvgText>
            <SvgText
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fontSize={13}
              fontWeight="600"
              fill={themeColors.textSecondary}
            >
              {selectedSlice.percentage.toFixed(1)}%
            </SvgText>
          </>
        )}
      </Svg>

      {/* Tooltip / detalle del slice seleccionado */}
      {selectedSlice && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: themeColors.surface,
            borderRadius: 12,
            padding: 14,
            width: '100%',
            borderWidth: 1,
            borderColor: themeColors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: selectedSlice.color,
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: themeColors.text,
              }}
            >
              {selectedSlice.label}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: themeColors.textSecondary,
                marginTop: 2,
              }}
            >
              {formatUSD(selectedSlice.value)} · {selectedSlice.percentage.toFixed(1)}%
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSelectedId(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ color: themeColors.textSecondary, fontSize: 18 }}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Leyenda */}
      <View style={{ marginTop: 16, width: '100%', gap: 6 }}>
        {slices.slice(0, 8).map((slice) => (
          <TouchableOpacity
            key={slice.id}
            onPress={() => handleSlicePress(slice.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              opacity: selectedId && slice.id !== selectedId ? 0.5 : 1,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: slice.color,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                color: themeColors.text,
              }}
              numberOfLines={1}
            >
              {slice.label}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: themeColors.textSecondary,
              }}
            >
              {slice.percentage.toFixed(1)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
