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
  showLegend?: boolean; // mostrar leyenda debajo del gráfico
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
  endAngle: number,
  innerR: number = 0
): string {
  const angle = endAngle - startAngle;

  // SVG no puede dibujar un arco de 360° con un solo comando A.
  // Para 360° (círculo completo), partimos en dos arcos de 180°.
  if (angle >= 359.99) {
    const mid1 = polarToCartesian(cx, cy, r, startAngle + 180);
    const end1 = polarToCartesian(cx, cy, r, startAngle + 360);

    if (innerR > 0) {
      const innerMid1 = polarToCartesian(cx, cy, innerR, startAngle + 180);
      const innerEnd1 = polarToCartesian(cx, cy, innerR, startAngle + 360);
      return [
        `M ${polarToCartesian(cx, cy, r, startAngle).x} ${polarToCartesian(cx, cy, r, startAngle).y}`,
        `A ${r} ${r} 0 0 0 ${mid1.x} ${mid1.y}`,
        `A ${r} ${r} 0 0 0 ${end1.x} ${end1.y}`,
        `L ${innerEnd1.x} ${innerEnd1.y}`,
        `A ${innerR} ${innerR} 0 0 1 ${innerMid1.x} ${innerMid1.y}`,
        `A ${innerR} ${innerR} 0 0 1 ${polarToCartesian(cx, cy, innerR, startAngle).x} ${polarToCartesian(cx, cy, innerR, startAngle).y}`,
        'Z',
      ].join(' ');
    }
    // Pastel sólido 360°
    const start = polarToCartesian(cx, cy, r, startAngle);
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 0 0 ${mid1.x} ${mid1.y}`,
      `A ${r} ${r} 0 0 0 ${end1.x} ${end1.y}`,
      'Z',
    ].join(' ');
  }

  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = angle > 180 ? 1 : 0;

  if (innerR > 0) {
    // Dona: arco exterior + arco interior (invertido)
    const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
    const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);

    return [
      `M ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArcFlag} 1 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  // Pastel sólido (original)
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function PieChartInteractive({
  data,
  size = SCREEN_WIDTH - 80,
  innerRadius = 0,
  showLegend = true,
}: PieChartInteractiveProps) {
  const themeColors = useThemeColors();
  const chartColors = themeColors.chartColors;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animDone, setAnimDone] = useState(false);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 10;
  // innerRadius se interpreta como porcentaje del outerR si es < outerR
  const innerR = innerRadius > 0 ? Math.min(innerRadius, outerR * 0.85) : 0;

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
            slice.endAngle,
            innerR
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

      {/* Leyenda (opcional) */}
      {showLegend && (
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
      )}
    </View>
  );
}
