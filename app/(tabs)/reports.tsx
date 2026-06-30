import { useCallback, useEffect, useState, useWindowDimensions } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  LineChart,
  PieChart,
  Line,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { formatUSD, formatBS } from '../../src/utils/format';
import {
  getCategoryBreakdown,
  getCashFlowHistory,
  getReportSummary,
  CategoryBreakdown,
  CashFlowPoint,
  ReportSummary,
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
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
  const gap = isSmall ? 8 : 12;
  const pad = isSmall ? 10 : 12;
  const themeColors = useThemeColors();
  const [period, setPeriod] = useState<PeriodOption>('month');
  const [activeTab, setActiveTab] = useState<ReportTab>('expense');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [cashFlowData, setCashFlowData] = useState<CashFlowPoint[]>([]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { start, end } = getPeriodRange(period);

      const [summaryResult, expenseBreakdown, incomeBreakdown, cashFlow] = await Promise.all([
        getReportSummary(start, end),
        getCategoryBreakdown('expense', start, end),
        getCategoryBreakdown('income', start, end),
        getCashFlowHistory(start, end, 'month'),
      ]);

      setSummary(summaryResult);
      setCategoryData(activeTab === 'expense' ? expenseBreakdown : incomeBreakdown);
      setCashFlowData(cashFlow);
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

  // Preparar datos para el gráfico de pastel (recharts)
  const pieChartData = categoryData.slice(0, 8).map((cat) => ({
    name: cat.categoryName.length > 12 ? cat.categoryName.substring(0, 12) + '…' : cat.categoryName,
    value: cat.totalUSD > 0 ? cat.totalUSD : (cat.totalBS > 0 ? cat.totalBS : 0),
    fill: cat.color || '#999',
  }));

  // Preparar datos para el gráfico de línea (flujo de caja) - recharts
  const lineChartData = cashFlowData.map((p) => {
    const parts = p.date.split('-');
    let label = p.date;
    if (parts.length >= 2) {
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      label = months[parseInt(parts[1]) - 1] || p.date;
    }
    return {
      date: label,
      balance: p.balanceUSD,
      income: p.incomeUSD,
      expense: p.expenseUSD,
    };
  });

  const COLORS = ['#6366F1', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  return (
    <AnimatedTransition>
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
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: period === p.key ? themeColors.primary : themeColors.surface,
                  alignItems: 'center',
                }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: period === p.key ? '#FFFFFF' : themeColors.textSecondary,
                  }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={themeColors.primary} />
              <Text style={{ marginTop: 12, color: themeColors.textSecondary, fontSize: 14 }}>
                Cargando reportes...
              </Text>
            </View>
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
                    <ResponsiveContainer width="100%" height={256}>
                      <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke={themeColors.border} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: themeColors.textSecondary }} stroke={themeColors.border} />
                        <YAxis tick={{ fontSize: 11, fill: themeColors.textSecondary }} stroke={themeColors.border} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: themeColors.surface,
                            border: `1px solid ${themeColors.border}`,
                            borderRadius: 8,
                            color: themeColors.text,
                          }}
                        />
                        <Line type="monotone" dataKey="balance" stroke="#6366F1" strokeWidth={2} dot={{ r: 4, fill: '#6366F1' }} name="Balance" />
                        <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} name="Ingresos" />
                        <Line type="monotone" dataKey="expense" stroke="#EF4444" strokeWidth={2} dot={{ r: 4, fill: '#EF4444' }} name="Gastos" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                      <Ionicons name="analytics-outline" size={48} color={themeColors.textSecondary} />
                      <Text style={{ marginTop: 12, color: themeColors.textSecondary, fontSize: 14 }}>
                        No hay datos de flujo de caja en este período
                      </Text>
                    </View>
                  )}

                  {/* Leyenda */}
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#6366F1', borderRadius: 2 }} />
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Balance</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#10B981', borderRadius: 2 }} />
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Ingresos</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 12, height: 3, backgroundColor: '#EF4444', borderRadius: 2 }} />
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Gastos</Text>
                    </View>
                  </View>
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
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: any) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                            labelLine={true}
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: themeColors.surface,
                              border: `1px solid ${themeColors.border}`,
                              borderRadius: 8,
                              color: themeColors.text,
                            }}
                            formatter={(value: any) => formatUSD(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Lista detallada de categorías */}
                      <View style={{ marginTop: 16, gap: 8 }}>
                        {categoryData.slice(0, 10).map((cat) => (
                          <View
                            key={cat.categoryId}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingVertical: 6,
                              borderBottomWidth: 1,
                              borderBottomColor: themeColors.border,
                            }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <View
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: cat.color || '#999',
                                }}
                              />
                              <Text style={{ fontSize: 13, color: themeColors.text, flex: 1 }} numberOfLines={1}>
                                {cat.icon} {cat.categoryName}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text }}>
                                {formatUSD(cat.totalUSD)}
                              </Text>
                              <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                                {cat.percentage}%
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
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
    </AnimatedTransition>
  );
}
