import React, { useCallback, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  Circle,
  Line,
  vec,
} from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useThemeColors } from '../hooks/useThemeColors';

// Skia v2: Circle acepta {cx, cy, r} (ScalarCircleDef) o {c, r} (PointCircleDef)
// Line acepta {p1: Vector, p2: Vector}
// Path acepta {path: SkPath, start, end, color, style, strokeWidth, ...}
// opacity se pasa como prop directa en DrawingNodeProps

export interface CashFlowChartData {
  date: string;
  balanceUSD: number;
  incomeUSD: number;
  expenseUSD: number;
}

interface CashFlowChartProps {
  data: CashFlowChartData[];
  width: number;
  height: number;
}

const PADDING = { top: 20, right: 16, bottom: 40, left: 50 };
const LINE_COLORS = {
  balance: '#6366F1',
  income: '#10B981',
  expense: '#EF4444',
};

export default function CashFlowChart({ data, width, height }: CashFlowChartProps) {
  const themeColors = useThemeColors();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // Calcular valores mínimos y máximos para escalar
  const { minVal, maxVal } = useMemo(() => {
    if (data.length === 0) return { minVal: 0, maxVal: 100 };
    const allValues = data.flatMap((d) => [d.balanceUSD, d.incomeUSD, d.expenseUSD]);
    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);
    const padding = (max - min) * 0.1 || 10;
    return { minVal: min - padding, maxVal: max + padding };
  }, [data]);

  const scaleY = useCallback(
    (value: number) =>
      PADDING.top + chartHeight - ((value - minVal) / (maxVal - minVal)) * chartHeight,
    [chartHeight, minVal, maxVal]
  );

  const scaleX = useCallback(
    (index: number) => {
      if (data.length <= 1) return PADDING.left + chartWidth / 2;
      return PADDING.left + (index / (data.length - 1)) * chartWidth;
    },
    [chartWidth, data.length]
  );

  // Generar paths para las 3 líneas con curvas suaves
  const paths = useMemo(() => {
    if (data.length === 0) return { balance: null, income: null, expense: null };

    const buildPath = (key: 'balanceUSD' | 'incomeUSD' | 'expenseUSD') => {
      const path = Skia.Path.Make();
      data.forEach((point, i) => {
        const x = scaleX(i);
        const y = scaleY(point[key]);
        if (i === 0) {
          path.moveTo(x, y);
        } else {
          const prevX = scaleX(i - 1);
          const prevY = scaleY(data[i - 1][key]);
          const cp1x = prevX + (x - prevX) / 3;
          const cp2x = prevX + (2 * (x - prevX)) / 3;
          path.cubicTo(cp1x, prevY, cp2x, y, x, y);
        }
      });
      return path;
    };

    return {
      balance: buildPath('balanceUSD'),
      income: buildPath('incomeUSD'),
      expense: buildPath('expenseUSD'),
    };
  }, [data, scaleX, scaleY]);

  // Líneas de cuadrícula Y
  const gridLines = useMemo(() => {
    const lines: { value: number; y: number; label: string }[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const value = minVal + ((maxVal - minVal) * i) / steps;
      lines.push({
        value,
        y: scaleY(value),
        label: value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0),
      });
    }
    return lines;
  }, [minVal, maxVal, scaleY]);

  // Gesture para scrubbing
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const touchX = event.x;
      let closestIdx = 0;
      let closestDist = Infinity;
      data.forEach((_, i) => {
        const x = scaleX(i);
        const dist = Math.abs(touchX - x);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });
      setSelectedIndex(closestIdx);
    })
    .onEnd(() => {
      setSelectedIndex(null);
    });

  const selectedPoint = selectedIndex !== null ? data[selectedIndex] : null;

  if (data.length === 0) {
    return (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: themeColors.textSecondary, fontSize: 14 }}>Sin datos disponibles</Text>
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      {/* Grid labels (React Native overlay) */}
      {gridLines.map((line, i) => (
        <Text
          key={`label-${i}`}
          style={{
            position: 'absolute',
            left: 4,
            top: line.y - 6,
            fontSize: 10,
            color: themeColors.textSecondary,
          }}
        >
          {line.label}
        </Text>
      ))}

      <GestureDetector gesture={panGesture}>
        <Canvas style={{ width, height }}>
          {/* Líneas de cuadrícula Y */}
          {gridLines.map((line, i) => (
            <Line
              key={`grid-${i}`}
              p1={vec(PADDING.left, line.y)}
              p2={vec(width - PADDING.right, line.y)}
              color={themeColors.border}
              style="stroke"
              strokeWidth={1}
            />
          ))}

          {/* Líneas de datos */}
          {paths.expense && (
            <SkiaPath
              path={paths.expense}
              color={LINE_COLORS.expense}
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
          {paths.income && (
            <SkiaPath
              path={paths.income}
              color={LINE_COLORS.income}
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
          {paths.balance && (
            <SkiaPath
              path={paths.balance}
              color={LINE_COLORS.balance}
              style="stroke"
              strokeWidth={2.5}
              strokeCap="round"
              strokeJoin="round"
            />
          )}

          {/* Punto seleccionado (scrubbing) */}
          {selectedPoint && selectedIndex !== null && (
            <>
              <Line
                p1={vec(scaleX(selectedIndex), PADDING.top)}
                p2={vec(scaleX(selectedIndex), height - PADDING.bottom)}
                color={themeColors.textSecondary}
                style="stroke"
                strokeWidth={1}
                opacity={0.5}
              />
              <Circle
                cx={scaleX(selectedIndex)}
                cy={scaleY(selectedPoint.balanceUSD)}
                r={5}
                color={LINE_COLORS.balance}
              />
              <Circle
                cx={scaleX(selectedIndex)}
                cy={scaleY(selectedPoint.incomeUSD)}
                r={4}
                color={LINE_COLORS.income}
              />
              <Circle
                cx={scaleX(selectedIndex)}
                cy={scaleY(selectedPoint.expenseUSD)}
                r={4}
                color={LINE_COLORS.expense}
              />
            </>
          )}
        </Canvas>
      </GestureDetector>

      {/* Tooltip flotante */}
      {selectedPoint && selectedIndex !== null && (
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: Math.max(8, Math.min(scaleX(selectedIndex) - 60, width - 130)),
            backgroundColor: themeColors.surface,
            borderRadius: 10,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1,
            borderColor: themeColors.border,
            minWidth: 120,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: themeColors.text, marginBottom: 4 }}>
            {selectedPoint.date}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LINE_COLORS.balance }} />
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
              Balance: <Text style={{ fontWeight: '600', color: LINE_COLORS.balance }}>${selectedPoint.balanceUSD.toFixed(0)}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LINE_COLORS.income }} />
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
              Ingresos: <Text style={{ fontWeight: '600', color: LINE_COLORS.income }}>${selectedPoint.incomeUSD.toFixed(0)}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LINE_COLORS.expense }} />
            <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
              Gastos: <Text style={{ fontWeight: '600', color: LINE_COLORS.expense }}>${selectedPoint.expenseUSD.toFixed(0)}</Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
