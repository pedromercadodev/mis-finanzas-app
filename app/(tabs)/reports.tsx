import { useCallback, useEffect, useState } from 'react';
import SegmentedControl from '../../src/components/SegmentedControl';
import PieChartInteractive from '../../src/components/PieChartInteractive';
import type { PieSlice } from '../../src/components/PieChartInteractive';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CashFlowChart from '../../src/components/CashFlowChart';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { ReportsSkeleton } from '../../src/components/Skeleton';
import { formatUSD, formatBS } from '../../src/utils/format';
import {
  getCategoryBreakdown,
  getCashFlowHistory,
  getReportSummary,
  getPeriodComparison,
  CategoryBreakdown,
  CashFlowPoint,
  ReportSummary,
  PeriodComparison,
} from '../../src/services/reports';

const SCREEN_WIDTH = Dimensions.get('window').width;

type PeriodOption = 'month' | 'quarter' | 'year' | 'all';
type ReportTab = 'expense' | 'income' | 'cashflow';

const PERIODS: { key: PeriodOption; label: string }[] = [
  { key: 'month', label: 'Este mes' },
  { key: 'quarter', label: '3 meses' },
  { key: 'year', label: 'Este año' },
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

export default function ReportsScreen() {
  const themeColors = useThemeColors();
  const [period, setPeriod] = useState<PeriodOption>('month');
  const [activeTab, setActiveTab] = useState<ReportTab>('expense');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [cashFlowData, setCashFlowData] = useState<CashFlowPoint[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);

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
  const totalAmount = categoryData.reduce((sum, cat) => sum + (cat.totalUSD > 0 ? cat.totalUSD : cat.totalBS), 0);
  const pieSlices: PieSlice[] = categoryData.slice(0, 8).map((cat) => {
    const value = cat.totalUSD > 0 ? cat.totalUSD : cat.totalBS;
    return {
      id: String(cat.categoryId),
      label: cat.categoryName,
      value,
      color: cat.color || '#999',
      percentage: totalAmount > 0 ? (value / totalAmount) * 100 : 0,
    };
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text }}>
              Reportes
            </Text>
            <Ionicons name="bar-chart" size={28} color={themeColors.primary} />
          </View>

          {/* Selector de período */}
          <View style={{ marginBottom: 20 }}>
            <SegmentedControl
              options={PERIODS}
              selected={period}
              onSelect={setPeriod}
            />
          </View>

          {loading ? (
            <ReportsSkeleton />
          ) : (
            <>
              {/* Resumen del período */}
              {summary && (
                <View
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text, marginBottom: 12 }}>
                    Resumen del período
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: themeColors.successLight, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>Ingresos</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.success }}>
                        {formatUSD(summary.totalIncomeUSD)}
                      </Text>
                      {summary.totalIncomeBS > 0 && (
                        <Text style={{ fontSize: 11, color: themeColors.success, marginTop: 2 }}>
                          {formatBS(summary.totalIncomeBS)}
                        </Text>
                      )}
                      {comparison?.incomeChange !== null && comparison?.incomeChange !== undefined && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                          <Ionicons
                            name={comparison.incomeChange >= 0 ? 'arrow-up' : 'arrow-down'}
                            size={11}
                            color={comparison.incomeChange >= 0 ? themeColors.success : themeColors.danger}
                          />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: comparison.incomeChange >= 0 ? themeColors.success : themeColors.danger }}>
                            {Math.abs(comparison.incomeChange)}%
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: themeColors.dangerLight, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>Gastos</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.danger }}>
                        {formatUSD(summary.totalExpenseUSD)}
                      </Text>
                      {summary.totalExpenseBS > 0 && (
                        <Text style={{ fontSize: 11, color: themeColors.danger, marginTop: 2 }}>
                          {formatBS(summary.totalExpenseBS)}
                        </Text>
                      )}
                      {comparison?.expenseChange !== null && comparison?.expenseChange !== undefined && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                          <Ionicons
                            name={comparison.expenseChange >= 0 ? 'arrow-up' : 'arrow-down'}
                            size={11}
                            color={comparison.expenseChange >= 0 ? themeColors.danger : themeColors.success}
                          />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: comparison.expenseChange >= 0 ? themeColors.danger : themeColors.success }}>
                            {Math.abs(comparison.expenseChange)}%
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, alignItems: 'center', padding: 12, backgroundColor: themeColors.primaryLight, borderRadius: 12 }}>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>Neto</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: summary.netUSD >= 0 ? themeColors.success : themeColors.danger }}>
                        {formatUSD(summary.netUSD)}
                      </Text>
                      {summary.netBS !== 0 && (
                        <Text style={{ fontSize: 11, color: summary.netBS >= 0 ? themeColors.success : themeColors.danger, marginTop: 2 }}>
                          {formatBS(summary.netBS)}
                        </Text>
                      )}
                      {comparison?.netChange !== null && comparison?.netChange !== undefined && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                          <Ionicons
                            name={comparison.netChange >= 0 ? 'arrow-up' : 'arrow-down'}
                            size={11}
                            color={comparison.netChange >= 0 ? themeColors.success : themeColors.danger}
                          />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: comparison.netChange >= 0 ? themeColors.success : themeColors.danger }}>
                            {Math.abs(comparison.netChange)}%
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Tabs: Gastos / Ingresos / Flujo de Caja */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {([
                  { key: 'expense' as ReportTab, label: 'Gastos', icon: 'trending-down' },
                  { key: 'income' as ReportTab, label: 'Ingresos', icon: 'trending-up' },
                  { key: 'cashflow' as ReportTab, label: 'Flujo de Caja', icon: 'swap-horizontal' },
                ]).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleTabChange(tab.key)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: activeTab === tab.key ? themeColors.primary : themeColors.surface,
                    }}>
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={activeTab === tab.key ? '#FFFFFF' : themeColors.textSecondary}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: activeTab === tab.key ? '#FFFFFF' : themeColors.textSecondary,
                      }}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Contenido según tab */}
              {activeTab === 'cashflow' ? (
                /* GRÁFICO DE LÍNEA - Flujo de Caja */
                <View
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text, marginBottom: 16 }}>
                    Historial de Flujo de Caja (USD)
                  </Text>
                  {cashFlowData.length > 0 ? (
                    <CashFlowChart
                      data={cashFlowData}
                      width={SCREEN_WIDTH - 72}
                      height={256}
                    />
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="analytics-outline" size={48} color={themeColors.textSecondary} />
                      <Text style={{ marginTop: 12, color: themeColors.textSecondary, fontSize: 14 }}>
                        No hay datos de flujo de caja en este período
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* GRÁFICO DE PASTEL - Gastos/Ingresos por categoría */
                <View
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text, marginBottom: 16 }}>
                    {activeTab === 'expense' ? 'Gastos por Categoría' : 'Ingresos por Categoría'}
                  </Text>
                  {categoryData.length > 0 ? (
                    <>
                      <PieChartInteractive
                        data={pieSlices}
                        size={SCREEN_WIDTH - 80}
                      />
                    </>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="pie-chart-outline" size={48} color={themeColors.textSecondary} />
                      <Text style={{ marginTop: 12, color: themeColors.textSecondary, fontSize: 14 }}>
                        No hay {activeTab === 'expense' ? 'gastos' : 'ingresos'} en este período
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
    </SafeAreaView>
  );
}
