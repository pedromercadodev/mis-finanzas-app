import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CashFlowChart from '../../src/components/CashFlowChart';
import PieChartInteractive from '../../src/components/PieChartInteractive';
import type { PieSlice } from '../../src/components/PieChartInteractive';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { ReportsSkeleton } from '../../src/components/Skeleton';
import { formatUSD } from '../../src/utils/format';
import {
  getCategoryBreakdown,
  getCashFlowHistory,
  getReportSummary,
  getPeriodComparison,
  getMonthlyTrends,
  getSavingsProjections,
  getCategoryBudgetAnalysis,
  getExpenseAnalysis,
  CategoryBreakdown,
  CashFlowPoint,
  ReportSummary,
  PeriodComparison,
  MonthlyTrend,
  SavingsProjection,
  CategoryBudgetAnalysis,
  ExpenseAnalysis,
} from '../../src/services/reports';
import { getGoals } from '../../src/services/goals';

const SCREEN_WIDTH = Dimensions.get('window').width;

type PeriodOption = 'month' | 'quarter' | 'year' | 'all';
type ReportTab = 'expense' | 'income' | 'cashflow' | 'trends';

const PERIODS: { key: PeriodOption; label: string }[] = [
  { key: 'month', label: 'Mes' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Año' },
  { key: 'all', label: 'Todo' },
];

function getPeriodRange(period: PeriodOption): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start: string;

  switch (period) {
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = first.toISOString().split('T')[0];
      break;
    }
    case 'quarter': {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      start = threeMonthsAgo.toISOString().split('T')[0];
      break;
    }
    case 'year': {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      start = firstOfYear.toISOString().split('T')[0];
      break;
    }
    case 'all':
    default: {
      start = '2020-01-01';
      break;
    }
  }

  return { start, end };
}

// ─── Emoji → Ionicons mapping ─────────────────────────────────────────────
const EMOJI_TO_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  '🍔': 'restaurant-outline',
  '🚗': 'car-outline',
  '💊': 'medkit-outline',
  '📚': 'book-outline',
  '🎮': 'game-controller-outline',
  '🏠': 'home-outline',
  '💡': 'bulb-outline',
  '👕': 'shirt-outline',
  '💼': 'briefcase-outline',
  '💻': 'laptop-outline',
  '📈': 'trending-up-outline',
  '📦': 'cube-outline',
  '🎵': 'musical-notes-outline',
  '🎬': 'film-outline',
  '✈️': 'airplane-outline',
  '🐕': 'paw-outline',
  '💵': 'cash-outline',
  '🎓': 'school-outline',
  '🛒': 'cart-outline',
  '🍕': 'pizza-outline',
  '☕': 'cafe-outline',
  '🎂': 'gift-outline',
  '🍺': 'beer-outline',
  '🏋️': 'fitness-outline',
  '💰': 'wallet-outline',
  '🏦': 'business-outline',
  '💳': 'card-outline',
  '📱': 'phone-portrait-outline',
  '🌐': 'globe-outline',
  '🏧': 'cash-outline',
  '🎯': 'locate-outline',
  '📊': 'bar-chart-outline',
  '🪙': 'diamond-outline',
  '💎': 'diamond-outline',
  '🐷': 'save-outline',
  '📸': 'camera-outline',
  '⭐': 'star-outline',
  '📁': 'folder-outline',
  '📋': 'clipboard-outline',
};

// ─── Categoría name → Ionicons mapping (fallback por nombre) ──────────────
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Vivienda: 'home-outline',
  Alimentación: 'restaurant-outline',
  Transporte: 'car-outline',
  Compras: 'bag-outline',
  Salud: 'medkit-outline',
  Educación: 'book-outline',
  Entretenimiento: 'game-controller-outline',
  Servicios: 'flash-outline',
  Ropa: 'shirt-outline',
  Salario: 'wallet-outline',
  Freelance: 'laptop-outline',
  Inversiones: 'trending-up-outline',
  'Sin categoría': 'help-outline',
};

function getPeriodLabel(period: PeriodOption): string {
  switch (period) {
    case 'month': return 'vs. mes ant.';
    case 'quarter': return 'vs. trim. ant.';
    case 'year': return 'vs. año ant.';
    case 'all': return 'vs. periodo ant.';
    default: return 'vs. ant.';
  }
}

function getCategoryIcon(iconOrName: string): keyof typeof Ionicons.glyphMap {
  // First try emoji mapping
  if (EMOJI_TO_ICON[iconOrName]) return EMOJI_TO_ICON[iconOrName];
  // Then try category name mapping
  if (CATEGORY_ICONS[iconOrName]) return CATEGORY_ICONS[iconOrName];
  // Fallback
  return 'ellipse-outline';
}

// ─── Blur Circle Component ─────────────────────────────────────────────────
function BlurCircle({ color, top, right, size }: {
  color: string;
  top: number;
  right: number;
  size: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        top,
        right,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const themeColors = useThemeColors();
  const [period, setPeriod] = useState<PeriodOption>('quarter');
  const [activeTab, setActiveTab] = useState<ReportTab>('expense');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [cashFlowData, setCashFlowData] = useState<CashFlowPoint[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);

  // Tendencias
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [savingsProjection, setSavingsProjection] = useState<SavingsProjection | null>(null);
  const [budgetAnalysis, setBudgetAnalysis] = useState<CategoryBudgetAnalysis[]>([]);
  const [expenseAnalysis, setExpenseAnalysis] = useState<ExpenseAnalysis | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { start, end } = getPeriodRange(period);

      const [summaryResult, expenseBreakdown, incomeBreakdown, cashFlow, comparisonResult] = await Promise.all([
        getReportSummary(start, end),
        getCategoryBreakdown('expense', start, end),
        getCategoryBreakdown('income', start, end),
        getCashFlowHistory(start, end, 'month'),
        getPeriodComparison(period),
      ]);

      setSummary(summaryResult);
      setCategoryData(activeTab === 'expense' ? expenseBreakdown : incomeBreakdown);
      setCashFlowData(cashFlow);

      // Calcular cambios reales con los valores actuales
      if (comparisonResult && summaryResult) {
        const calcChange = (current: number, previous: number): number | null => {
          if (previous === 0) return current > 0 ? 100 : null;
          return Math.round(((current - previous) / previous) * 100);
        };
        setComparison({
          ...comparisonResult,
          incomeChange: calcChange(summaryResult.totalIncomeUSD, comparisonResult.previousIncomeUSD),
          expenseChange: calcChange(summaryResult.totalExpenseUSD, comparisonResult.previousExpenseUSD),
          netChange: calcChange(summaryResult.netUSD, comparisonResult.previousNetUSD),
        });
      } else {
        setComparison(null);
      }

      // Cargar datos de tendencias si el tab está activo
      if (activeTab === 'trends') {
        setTrendsLoading(true);
        try {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const [trends, projections, budgetAnalysisData, expenseAnalysisData, goals] = await Promise.all([
            getMonthlyTrends(6),
            getSavingsProjections(0, 12),
            getCategoryBudgetAnalysis(currentMonth),
            getExpenseAnalysis(start, end),
            getGoals(),
          ]);
          setMonthlyTrends(trends);
          // Recalcular proyecciones con la meta más cercana
          const activeGoal = goals.find(g => g.currentAmount < g.targetAmount);
          if (activeGoal) {
            const projectionsWithGoal = await getSavingsProjections(activeGoal.targetAmount, 12);
            setSavingsProjection(projectionsWithGoal);
          } else {
            setSavingsProjection(projections);
          }
          setBudgetAnalysis(budgetAnalysisData);
          setExpenseAnalysis(expenseAnalysisData);
        } catch (error) {
          console.error('Error loading trends:', error);
        } finally {
          setTrendsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, activeTab]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    loadData();
  }, [period, activeTab]);

  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
  };

  // Preparar datos para PieChartInteractive
  // Convertir todo a USD: si tiene totalUSD usa ese, si no convierte totalBS / 100 (tasa aprox)
  const pieSlices: PieSlice[] = categoryData.slice(0, 8).map((cat) => {
    const valueUSD = cat.totalUSD > 0 ? cat.totalUSD : (cat.totalBS > 0 ? cat.totalBS / 100 : 0);
    return {
      id: String(cat.categoryId),
      label: cat.categoryName,
      value: valueUSD,
      color: cat.color || '#999',
      percentage: cat.percentage, // usar el % ya calculado por el servicio
    };
  });

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ TopAppBar ═══ */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: themeColors.surfaceVariant,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="person" size={22} color={themeColors.textSecondary} />
            </View>
            <Text
              style={{
                fontFamily: 'Inter',
                fontSize: 20,
                fontWeight: '600',
                lineHeight: 28,
                color: themeColors.text,
                letterSpacing: -0.5,
              }}
            >
              Reportes
            </Text>
          </View>
          <TouchableOpacity
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            accessibilityLabel="Notificaciones"
          >
            <Ionicons name="notifications-outline" size={22} color={themeColors.secondary} />
          </TouchableOpacity>
        </View>

        {/* ═══ Period Selector - Glass pill ═══ */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{
            backgroundColor: themeColors.surfaceContainer + '99',
            borderRadius: 999,
            padding: 3,
            flexDirection: 'row',
            shadowColor: '#0A1E3D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 4,
          }}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 2,
                  borderRadius: 999,
                  backgroundColor: period === p.key ? themeColors.secondaryContainer + '33' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                    color: period === p.key ? themeColors.secondary : themeColors.onSurfaceVariant,
                    textAlign: 'center',
                    includeFontPadding: false,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={{ paddingHorizontal: 24 }}>
            <ReportsSkeleton />
          </View>
        ) : (
          <>
            {/* ═══ Summary Cards - Mobile column layout ═══ */}
            {summary && (
              <View style={{ paddingHorizontal: 24, marginBottom: 32, gap: 12 }}>
                {/* Ingresos */}
                <View style={{
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                  overflow: 'hidden',
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 6,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: themeColors.onSurfaceVariant,
                    }}>
                      Ingresos
                    </Text>
                    <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
                      <BlurCircle color={themeColors.secondary + '1A'} top={-10} right={-10} size={36} />
                      <Ionicons name="arrow-up" size={16} color={themeColors.secondary} />
                    </View>
                  </View>
                  <Text style={{
                    fontSize: 28,
                    fontWeight: '700',
                    letterSpacing: -0.5,
                    color: themeColors.text,
                    marginBottom: 8,
                  }}>
                    {formatUSD(summary.totalIncomeUSD > 0 ? summary.totalIncomeUSD : summary.totalIncomeBS / 100)}
                  </Text>
                  {comparison?.incomeChange !== null && comparison?.incomeChange !== undefined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{
                        backgroundColor: themeColors.secondary + '1A',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        <Ionicons
                          name={comparison.incomeChange >= 0 ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={themeColors.secondary}
                        />
                        <Text style={{ fontSize: 11, color: themeColors.secondary }}>
                          {Math.abs(comparison.incomeChange)}%
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: themeColors.onSurfaceVariant }}>
                        {getPeriodLabel(period)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Gastos */}
                <View style={{
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                  overflow: 'hidden',
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 6,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: themeColors.onSurfaceVariant,
                    }}>
                      Gastos
                    </Text>
                    <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
                      <BlurCircle color={themeColors.danger + '1A'} top={-10} right={-10} size={36} />
                      <Ionicons name="arrow-down" size={16} color={themeColors.danger} />
                    </View>
                  </View>
                  <Text style={{
                    fontSize: 28,
                    fontWeight: '700',
                    letterSpacing: -0.5,
                    color: themeColors.text,
                    marginBottom: 8,
                  }}>
                    {formatUSD(summary.totalExpenseUSD > 0 ? summary.totalExpenseUSD : summary.totalExpenseBS / 100)}
                  </Text>
                  {comparison?.expenseChange !== null && comparison?.expenseChange !== undefined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{
                        backgroundColor: themeColors.danger + '1A',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        <Ionicons
                          name={comparison.expenseChange >= 0 ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={themeColors.danger}
                        />
                        <Text style={{ fontSize: 11, color: themeColors.danger }}>
                          {Math.abs(comparison.expenseChange)}%
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: themeColors.onSurfaceVariant }}>
                        {getPeriodLabel(period)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Neto */}
                <LinearGradient
                  colors={[themeColors.surfaceContainerHigh, themeColors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '30',
                    overflow: 'hidden',
                    shadowColor: '#0A1E3D',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 16,
                    elevation: 6,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: themeColors.onSurfaceVariant,
                    }}>
                      Neto
                    </Text>
                    <View style={{ position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
                      <BlurCircle color={themeColors.tertiary + '1A'} top={-10} right={-10} size={36} />
                      <Ionicons name="wallet-outline" size={16} color={themeColors.tertiary} />
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: '700',
                      letterSpacing: -0.5,
                      color: (summary.totalIncomeUSD > 0 ? summary.netUSD : (summary.totalIncomeBS - summary.totalExpenseBS) / 100) >= 0
                        ? themeColors.secondary
                        : themeColors.danger,
                      marginBottom: 8,
                    }}
                  >
                    {formatUSD(summary.totalIncomeUSD > 0 ? summary.netUSD : (summary.totalIncomeBS - summary.totalExpenseBS) / 100)}
                  </Text>
                  {comparison?.netChange !== null && comparison?.netChange !== undefined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{
                        backgroundColor: (comparison.netChange >= 0 ? themeColors.secondary : themeColors.danger) + '1A',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 2,
                      }}>
                        <Ionicons
                          name={comparison.netChange >= 0 ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={comparison.netChange >= 0 ? themeColors.secondary : themeColors.danger}
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            color: comparison.netChange >= 0 ? themeColors.secondary : themeColors.danger,
                          }}
                        >
                          {Math.abs(comparison.netChange)}%
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: themeColors.onSurfaceVariant }}>
                        {getPeriodLabel(period)}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            )}

            {/* ═══ Tab Selector - Border bottom style ═══ */}
            <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -24 }}
                contentContainerStyle={{ paddingHorizontal: 24 }}
              >
                <View style={{
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.surfaceVariant + '80',
                }}>
                  {([
                    { key: 'expense' as ReportTab, label: 'Gastos' },
                    { key: 'income' as ReportTab, label: 'Ingresos' },
                    { key: 'cashflow' as ReportTab, label: 'Flujo' },
                    { key: 'trends' as ReportTab, label: 'Tendencias' },
                  ]).map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => handleTabChange(tab.key)}
                      accessibilityLabel={`Ver ${tab.label.toLowerCase()}`}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth: 2,
                        borderBottomColor: activeTab === tab.key ? themeColors.secondary : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: activeTab === tab.key ? '600' : '400',
                          color: activeTab === tab.key ? themeColors.secondary : themeColors.onSurfaceVariant,
                        }}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* ═══ Tab Content ═══ */}
            <View style={{ paddingHorizontal: 24 }}>
              {activeTab === 'trends' ? (
                /* ─── SECCIÓN DE TENDENCIAS ─── */
                trendsLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color={themeColors.secondary} />
                    <Text style={{ color: themeColors.onSurfaceVariant, marginTop: 12, fontSize: 14 }}>
                      Cargando tendencias...
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* TASA DE AHORRO MENSUAL */}
                    <View style={{
                      backgroundColor: themeColors.surfaceContainer + '99',
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 20,
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '30',
                    }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: themeColors.text,
                        marginBottom: 16,
                      }}>
                        Tasa de Ahorro Mensual
                      </Text>
                      {monthlyTrends.length > 0 ? (
                        <View style={{ gap: 10 }}>
                          {monthlyTrends.map((trend, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={{ width: 70, fontSize: 12, color: themeColors.onSurfaceVariant }}>
                                {trend.label}
                              </Text>
                              <View style={{
                                flex: 1,
                                height: 20,
                                backgroundColor: themeColors.surfaceVariant,
                                borderRadius: 10,
                                overflow: 'hidden',
                              }}>
                                <View style={{
                                  width: `${Math.min(Math.max(trend.savingsRate, 0), 100)}%` as any,
                                  height: '100%',
                                  backgroundColor: trend.savingsRate >= 0 ? themeColors.secondary : themeColors.danger,
                                  borderRadius: 10,
                                }} />
                              </View>
                              <Text
                                style={{
                                  width: 50,
                                  textAlign: 'right',
                                  fontSize: 12,
                                  color: trend.savingsRate >= 0 ? themeColors.secondary : themeColors.danger,
                                }}
                              >
                                {trend.savingsRate}%
                              </Text>
                            </View>
                          ))}
                          <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 8,
                            paddingTop: 8,
                            borderTopWidth: 1,
                            borderTopColor: themeColors.outlineVariant + '50',
                          }}>
                            <Text style={{ fontSize: 12, color: themeColors.onSurfaceVariant }}>
                              Ingreso prom.: {formatUSD(Math.round(monthlyTrends.reduce((s, t) => s + t.incomeUSD, 0) / monthlyTrends.length))}
                            </Text>
                            <Text style={{ fontSize: 12, color: themeColors.onSurfaceVariant }}>
                              Gasto prom.: {formatUSD(Math.round(monthlyTrends.reduce((s, t) => s + t.expenseUSD, 0) / monthlyTrends.length))}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={{ color: themeColors.onSurfaceVariant, textAlign: 'center', paddingVertical: 20, fontSize: 14 }}>
                          No hay datos suficientes para calcular tendencias
                        </Text>
                      )}
                    </View>

                    {/* PROYECCIÓN DE AHORROS */}
                    {savingsProjection && (
                      <View style={{
                        backgroundColor: themeColors.surfaceContainer + '99',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '30',
                      }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: themeColors.text,
                          marginBottom: 12,
                        }}>
                          Proyección de Ahorros
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                          <View style={{
                            flex: 1,
                            alignItems: 'center',
                            padding: 10,
                            backgroundColor: themeColors.surfaceVariant,
                            borderRadius: 12,
                          }}>
                            <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>Ahorro mensual</Text>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.secondary }}>{formatUSD(savingsProjection.monthlySavings)}</Text>
                          </View>
                          {savingsProjection.monthsToGoal !== null && (
                            <View style={{
                              flex: 1,
                              alignItems: 'center',
                              padding: 10,
                              backgroundColor: themeColors.secondary + '1A',
                              borderRadius: 12,
                            }}>
                              <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>Meta en</Text>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.secondary }}>{savingsProjection.monthsToGoal} meses</Text>
                            </View>
                          )}
                        </View>
                        <View style={{ gap: 4 }}>
                          {savingsProjection.projectedMonths.slice(0, 6).map((proj, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: themeColors.onSurfaceVariant }}>{proj.month}</Text>
                              <Text style={{ fontSize: 12, color: themeColors.text }}>{formatUSD(proj.savings)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* ANÁLISIS DE GASTOS VS PRESUPUESTO */}
                    {budgetAnalysis.length > 0 && (
                      <View style={{
                        backgroundColor: themeColors.surfaceContainer + '99',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '30',
                      }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: themeColors.text,
                          marginBottom: 12,
                        }}>
                          Gastos vs Presupuesto
                        </Text>
                        {budgetAnalysis.filter(b => b.budgetUSD > 0).slice(0, 8).map((item, idx) => (
                          <View key={idx} style={{ marginBottom: 10 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: themeColors.text }}>{item.categoryName}</Text>
                              <Text style={{ fontSize: 11, color: item.isOverBudget ? themeColors.danger : themeColors.onSurfaceVariant }}>
                                {formatUSD(item.spentUSD)} / {formatUSD(item.budgetUSD)}
                              </Text>
                            </View>
                            <View style={{
                              height: 8,
                              backgroundColor: themeColors.surfaceVariant,
                              borderRadius: 4,
                              overflow: 'hidden',
                            }}>
                              <View style={{
                                width: `${Math.min(item.percentage, 100)}%` as any,
                                height: '100%',
                                backgroundColor: item.isOverBudget ? themeColors.danger : themeColors.secondary,
                                borderRadius: 4,
                              }} />
                            </View>
                          </View>
                        ))}
                        {budgetAnalysis.filter(b => b.budgetUSD > 0).length === 0 && (
                          <Text style={{ color: themeColors.onSurfaceVariant, textAlign: 'center', paddingVertical: 12, fontSize: 14 }}>
                            No hay presupuestos configurados para este mes
                          </Text>
                        )}
                      </View>
                    )}

                    {/* ANÁLISIS DE GASTOS */}
                    {expenseAnalysis && (
                      <View style={{
                        backgroundColor: themeColors.surfaceContainer + '99',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '30',
                      }}>
                        <Text style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: themeColors.text,
                          marginBottom: 12,
                        }}>
                          Análisis de Gastos
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                          <View style={{
                            flex: 1,
                            alignItems: 'center',
                            padding: 10,
                            backgroundColor: themeColors.danger + '1A',
                            borderRadius: 12,
                          }}>
                            <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>Gasto promedio</Text>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.danger }}>{formatUSD(expenseAnalysis.averageMonthlyExpense)}</Text>
                          </View>
                          <View style={{
                            flex: 1,
                            alignItems: 'center',
                            padding: 10,
                            backgroundColor: themeColors.surfaceVariant,
                            borderRadius: 12,
                          }}>
                            <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>Categorías</Text>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text }}>{expenseAnalysis.expenseCount}</Text>
                          </View>
                        </View>
                        {expenseAnalysis.largestExpense && (
                          <View style={{
                            padding: 10,
                            backgroundColor: themeColors.tertiary + '1A',
                            borderRadius: 12,
                            marginBottom: 12,
                          }}>
                            <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>Mayor gasto</Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.tertiary }}>
                              {expenseAnalysis.largestExpense.categoryName}: {formatUSD(expenseAnalysis.largestExpense.amountUSD)}
                            </Text>
                          </View>
                        )}
                        {expenseAnalysis.topCategories.length > 0 && (
                          <>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.onSurfaceVariant, marginBottom: 8 }}>
                              Top categorías
                            </Text>
                            {expenseAnalysis.topCategories.map((cat, idx) => (
                              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: themeColors.secondary }} />
                                  <Text style={{ fontSize: 12, color: themeColors.text }}>{cat.categoryName}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <Text style={{ fontSize: 12, color: themeColors.text }}>{formatUSD(cat.amountUSD)}</Text>
                                  <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>{cat.percentage}%</Text>
                                </View>
                              </View>
                            ))}
                          </>
                        )}
                      </View>
                    )}
                  </>
                )
              ) : activeTab === 'cashflow' ? (
                /* ─── GRÁFICO DE FLUJO DE CAJA ─── */
                <View style={{
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: themeColors.text,
                    marginBottom: 16,
                  }}>
                    Flujo de Caja (Ingresos vs Gastos)
                  </Text>
                  {cashFlowData.length > 0 ? (
                    <CashFlowChart
                      data={cashFlowData}
                      width={SCREEN_WIDTH - 72}
                      height={256}
                    />
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="analytics-outline" size={48} color={themeColors.onSurfaceVariant} />
                      <Text style={{ color: themeColors.onSurfaceVariant, marginTop: 12, fontSize: 14 }}>
                        No hay datos de flujo de caja en este período
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* ─── GASTOS/INGRESOS POR CATEGORÍA - Mobile layout ─── */
                <>
                  {/* Chart Area - Donut */}
                  <View style={{
                    backgroundColor: themeColors.surfaceContainer + '99',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '30',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300,
                    marginBottom: 16,
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: themeColors.onSurfaceVariant,
                      position: 'absolute',
                      top: 16,
                      left: 16,
                    }}>
                      Distribución por Categoría
                    </Text>
                    {categoryData.length > 0 ? (
                      <PieChartInteractive
                        data={pieSlices}
                        size={SCREEN_WIDTH - 80}
                        innerRadius={60}
                        showLegend={false}
                      />
                    ) : (
                      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <Ionicons name="pie-chart-outline" size={48} color={themeColors.onSurfaceVariant} />
                        <Text style={{ color: themeColors.onSurfaceVariant, marginTop: 12, fontSize: 14 }}>
                          Sin datos
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Top Categories List */}
                  <View style={{
                    backgroundColor: themeColors.surfaceContainer + '99',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '30',
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: themeColors.onSurfaceVariant,
                      marginBottom: 8,
                    }}>
                      Top 8 Categorías
                    </Text>
                    {categoryData.length > 0 ? (
                      <>
                        {categoryData.slice(0, 8).map((cat, idx) => {
                          const valueUSD = cat.totalUSD > 0 ? cat.totalUSD : (cat.totalBS > 0 ? cat.totalBS / 100 : 0);
                          const pct = cat.percentage || 0;
                          const isLast = idx === Math.min(categoryData.length, 8) - 1;
                          return (
                            <View
                              key={cat.categoryId}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                paddingVertical: 8,
                                borderBottomWidth: isLast ? 0 : 1,
                                borderBottomColor: themeColors.outlineVariant + '30',
                              }}
                            >
                              <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: cat.color ? cat.color + '20' : themeColors.surfaceVariant,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}>
                                <Ionicons
                                  name={getCategoryIcon(cat.categoryName)}
                                  size={16}
                                  color={cat.color || themeColors.textSecondary}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '500', color: themeColors.text }}>
                                  {cat.categoryName}
                                </Text>
                                <Text style={{ fontSize: 11, color: themeColors.onSurfaceVariant }}>
                                  {pct.toFixed(1)}% del total
                                </Text>
                              </View>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                                {formatUSD(valueUSD)}
                              </Text>
                            </View>
                          );
                        })}
                        <TouchableOpacity
                          style={{
                            marginTop: 8,
                            paddingVertical: 10,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: '600',
                            color: themeColors.secondary,
                          }}>
                            Ver todas las categorías
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <Ionicons name="list-outline" size={48} color={themeColors.onSurfaceVariant} />
                        <Text style={{ color: themeColors.onSurfaceVariant, marginTop: 12, fontSize: 14 }}>
                          No hay {activeTab === 'expense' ? 'gastos' : 'ingresos'} en este período
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
