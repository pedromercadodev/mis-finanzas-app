import { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAccounts } from '../../src/store/useAccounts';
import { useTransactions } from '../../src/store/useTransactions';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { DashboardSkeleton } from '../../src/components/Skeleton';
import ThemedText from '../../src/components/ThemedText';
import GlassCard from '../../src/components/GlassCard';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance, getAccountsByPlatform } from '../../src/services/accounts';
import { getMonthlySummary } from '../../src/services/transactions';
import { getGoals } from '../../src/services/goals';
import { getDueSubscriptions, getSubscriptions } from '../../src/services/subscriptions';
import { formatUSD, formatBS, formatDateShort, getCurrentMonthRange } from '../../src/utils/format';
import type { Account, Goal, Subscription } from '../../src/utils/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_MARGIN = 24;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_MARGIN * 2;

export default function DashboardScreen() {
  const router = useRouter();
  const { accounts, loadAccounts } = useAccounts();
  const { transactions, loadTransactions } = useTransactions();
  const themeColors = useThemeColors();
  const { preferredRateType, manualRate, manualRateType, setPreferredRateType, expectedMonthlyIncome } = useSettings();
  const {
    bcv: bcvRate,
    parallel: parallelRate,
    loading: ratesLoading,
    lastUpdated: ratesLastUpdated,
    refresh: refreshRates,
  } = useExchangeRates();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountFilter, setAccountFilter] = useState<'all' | 'bs' | 'usd'>('all');
  const [platformData, setPlatformData] = useState<{ platform: string; accounts: Account[]; totalUSD: number; totalBS: number }[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<{ incomeUSD: number; incomeBS: number; expenseUSD: number; expenseBS: number } | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dueSubscriptions, setDueSubscriptions] = useState<Subscription[]>([]);
  const [balances, setBalances] = useState<Record<number, { balanceUSD: number; balanceBS: number }>>({});

  const getActiveRate = (): number | null => {
    if (manualRate !== null && manualRateType === preferredRateType) return manualRate;
    if (preferredRateType === 'BCV') return bcvRate?.rateUSDToBS ?? null;
    if (preferredRateType === 'PARALLEL') return parallelRate?.rateUSDToBS ?? null;
    return null;
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (accountFilter === 'all') return true;
    if (accountFilter === 'usd') return acc.currency === 'USD' || acc.currency === 'BOTH';
    if (accountFilter === 'bs') return acc.currency === 'BS' || acc.currency === 'BOTH';
    return true;
  });

  const getFilterLabel = () => {
    switch (accountFilter) {
      case 'all': return 'Todo';
      case 'usd': return 'USD';
      case 'bs': return 'BS';
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([loadAccounts(), loadTransactions()]);
      const accs = useAccounts.getState().accounts;
      const { start, end } = getCurrentMonthRange();
      const [summary, g, dueSub, allSub, platData] = await Promise.all([
        getMonthlySummary(start),
        getGoals(),
        getDueSubscriptions(),
        getSubscriptions(),
        getAccountsByPlatform(),
      ]);
      setMonthlySummary(summary);
      setGoals(g);
      setDueSubscriptions(dueSub);
      setSubscriptions(allSub);
      setPlatformData(platData);

      // Cargar balances individuales
      const balanceMap: Record<number, { balanceUSD: number; balanceBS: number }> = {};
      await Promise.all(
        accs.map(async (acc) => {
          const bal = await getAccountBalance(acc.id!);
          balanceMap[acc.id!] = bal;
        })
      );
      setBalances(balanceMap);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Calcular totales
  const totalUSD = filteredAccounts.reduce((sum, acc) => {
    const bal = balances[acc.id!];
    return sum + (bal?.balanceUSD ?? 0);
  }, 0);

  const totalBS = filteredAccounts.reduce((sum, acc) => {
    const bal = balances[acc.id!];
    return sum + (bal?.balanceBS ?? 0);
  }, 0);

  const activeRate = getActiveRate();
  const totalUSDInBS = totalUSD * (activeRate ?? 0);
  const totalCombinedBS = totalBS + totalUSDInBS;

  // Calcular resumen mensual
  const monthlyIncome = monthlySummary ? monthlySummary.incomeUSD + monthlySummary.incomeBS / (activeRate || 1) : 0;
  const monthlyExpense = monthlySummary ? monthlySummary.expenseUSD + monthlySummary.expenseBS / (activeRate || 1) : 0;
  const monthlyNet = monthlyIncome - monthlyExpense;
  const consumptionPct = monthlyIncome > 0 ? Math.min((monthlyExpense / monthlyIncome) * 100, 100) : 0;

  // Suscripciones activas
  const activeSubs = subscriptions.filter(s => s.isActive).length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.secondary}
            colors={[themeColors.secondary]}
          />
        }
      >
        {/* ===== TOP HEADER ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, paddingTop: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ letterSpacing: 0.5, marginBottom: 2 }}>
                {new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches'}
              </ThemedText>
              <ThemedText type="h2" themeColor="text" style={{ fontSize: 22 }}>
                {accounts.length > 0 ? 'User' : 'Bienvenido'}
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/ai-chat')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.surfaceContainerHigh,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '50',
              }}
              accessibilityLabel="Notificaciones"
            >
              <Ionicons name="notifications-outline" size={20} color={themeColors.secondary} />
              {dueSubscriptions.length > 0 && (
                <View style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: themeColors.danger,
                  borderWidth: 2,
                  borderColor: themeColors.surface,
                }} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== BALANCE CARD ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: themeColors.surfaceContainer + '99',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '30',
              padding: 24,
              position: 'relative',
              overflow: 'hidden',
              shadowColor: '#0A1E3D',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.4,
              shadowRadius: 32,
              elevation: 8,
            }}
          >
            {/* Glow con blur REAL usando Skia */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
              <Canvas style={{ flex: 1 }}>
                <Circle
                  cx={CARD_WIDTH - 48}
                  cy={48}
                  r={80}
                  color={themeColors.secondary}
                  opacity={0.08}
                >
                  <BlurMask blur={50} style="normal" />
                </Circle>
              </Canvas>
            </View>

            {/* Encabezado: Etiqueta y filtros */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <ThemedText type="badge" themeColor="onSurfaceVariant" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                BALANCE TOTAL
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(['all', 'usd', 'bs'] as const).map((chip) => {
                  const isActive = accountFilter === chip;
                  return (
                    <TouchableOpacity
                      key={chip}
                      onPress={() => setAccountFilter(chip)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 20,
                        backgroundColor: isActive ? themeColors.secondary : themeColors.surfaceVariant,
                      }}
                    >
                      <ThemedText
                        type="badge"
                        themeColor={isActive ? 'onSecondaryContainer' : 'onSurfaceVariant'}
                        style={{ fontSize: 10, letterSpacing: 0.5 }}
                      >
                        {chip === 'all' ? 'Todo' : chip.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Monto Principal USD */}
            <View style={{ marginTop: 16, position: 'relative', zIndex: 1 }}>
              <ThemedText type="h1" themeColor="text" style={{ fontSize: 40, letterSpacing: -0.5, fontWeight: '700' }}>
                {formatUSD(totalUSD)}
              </ThemedText>
            </View>

            {/* Monto secundario BS */}
            <View style={{ marginTop: 8, position: 'relative', zIndex: 1 }}>
              <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 18, opacity: 0.7 }}>
                Bs. {formatBS(totalCombinedBS).replace('Bs.', '').trim()}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* ===== EXCHANGE RATES & ALERTS ROW ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {/* Exchange Rate Card */}
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: themeColors.surfaceContainerHighest,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="swap-horizontal-outline" size={14} color={themeColors.onSurfaceVariant} />
                  <ThemedText type="badge" themeColor="onSurfaceVariant" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                    TASA DE CAMBIO
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={refreshRates} style={{ padding: 4 }}>
                  <Ionicons name="sync-outline" size={16} color={themeColors.secondary} />
                </TouchableOpacity>
              </View>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18, marginBottom: 8 }}>
                1 USD = {formatBS(activeRate ?? 0).replace('Bs.', '').trim()} BS
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ backgroundColor: themeColors.surfaceVariant, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                    BCV: {bcvRate?.rateUSDToBS?.toFixed(2) ?? '---'}
                  </ThemedText>
                </View>
                <View style={{ backgroundColor: themeColors.surfaceVariant, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                    Paralelo: {parallelRate?.rateUSDToBS?.toFixed(2) ?? '---'}
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Alert Card */}
            {dueSubscriptions.length > 0 && (
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: themeColors.errorContainer + '30',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="warning-outline" size={20} color={themeColors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" themeColor="text" style={{ fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                    Alerta de Suscripción
                  </ThemedText>
                  <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                    {dueSubscriptions.length} suscripción{dueSubscriptions.length > 1 ? 'es' : ''} por vencer
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ===== QUICK ACCESS GRID (2x2) ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
            {/* Suscripciones */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.primaryContainer,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                zIndex: 1,
              }}>
                <Ionicons name="card-outline" size={20} color={themeColors.primary} />
              </View>
              <ThemedText type="body" themeColor="text" style={{ fontSize: 15, fontWeight: '600', marginBottom: 2, zIndex: 1 }}>
                Suscripciones
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12, zIndex: 1 }}>
                {activeSubs > 0 ? `${activeSubs} Activas` : 'Sin suscripciones'}
              </ThemedText>
            </TouchableOpacity>

            {/* Cuentas */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/accounts')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.secondaryContainer + '25',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                zIndex: 1,
              }}>
                <Ionicons name="wallet-outline" size={20} color={themeColors.secondary} />
              </View>
              <ThemedText type="body" themeColor="text" style={{ fontSize: 15, fontWeight: '600', marginBottom: 2, zIndex: 1 }}>
                Cuentas
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12, zIndex: 1 }}>
                {accounts.length > 0 ? `Ver todas (${accounts.length})` : 'Sin cuentas'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            {/* Presupuestos */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/budgets')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.tertiaryContainer + '40',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                zIndex: 1,
              }}>
                <Ionicons name="pie-chart-outline" size={20} color={themeColors.tertiary} />
              </View>
              <View style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: themeColors.tertiary,
                zIndex: 2,
              }} />
              <ThemedText type="body" themeColor="text" style={{ fontSize: 15, fontWeight: '600', marginBottom: 2, zIndex: 1 }}>
                Presupuestos
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12, zIndex: 1 }}>
                Gestión de gastos
              </ThemedText>
            </TouchableOpacity>

            {/* Metas */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/goals')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.surfaceVariant,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                zIndex: 1,
              }}>
                <Ionicons name="flag-outline" size={20} color={themeColors.primary} />
              </View>
              <ThemedText type="body" themeColor="text" style={{ fontSize: 15, fontWeight: '600', marginBottom: 2, zIndex: 1 }}>
                Metas
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12, zIndex: 1 }}>
                {goals.length > 0 ? `${goals.length} Activa${goals.length > 1 ? 's' : ''}` : 'Sin metas'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== CUENTAS Y BILLETERAS (Horizontal Scroll) ===== */}
        {filteredAccounts.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 14 }}>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Cuentas y Billeteras
              </ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/accounts')} accessibilityLabel="Ver todas las cuentas">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ThemedText type="badge" themeColor="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>VER TODAS</ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={themeColors.secondary} />
                </View>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, gap: 12 }}>
              {filteredAccounts.map((account) => {
                const bal = balances[account.id!];
                const balUSD = bal?.balanceUSD ?? 0;
                const balBS = bal?.balanceBS ?? 0;
                return (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => router.push(`/account/${account.id}`)}
                    style={{
                      minWidth: 240,
                      backgroundColor: themeColors.surfaceContainerHigh,
                      padding: 20,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: themeColors.surfaceContainerHighest,
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.4,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: (account.color || '#4edea3') + '30',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        {account.icon && /^[^\w]{1,2}$/.test(account.icon) ? (
                          <ThemedText type="body" style={{ fontSize: 16 }}>{account.icon}</ThemedText>
                        ) : (
                          <Ionicons
                            name={(account.icon || 'wallet-outline') as any}
                            size={18}
                            color={account.color || themeColors.secondary}
                          />
                        )}
                      </View>
                      <ThemedText type="badge" themeColor="onSurfaceVariant" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                        {account.type?.toUpperCase() || 'CUENTA'}
                      </ThemedText>
                    </View>
                    <ThemedText type="body" themeColor="text" style={{ fontSize: 15, marginBottom: 4 }}>
                      {account.name}
                    </ThemedText>
                    <View>
                      {(account.currency === 'USD' || account.currency === 'BOTH') && (
                        <ThemedText type="h3" themeColor="text" style={{ fontSize: 20, fontWeight: '700' }}>
                          ${balUSD.toFixed(2)}
                        </ThemedText>
                      )}
                      {(account.currency === 'BS' || account.currency === 'BOTH') && (
                        <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12, marginTop: 2 }}>
                          Bs. {balBS.toFixed(2)}
                        </ThemedText>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {/* Add Account Card */}
              <TouchableOpacity
                onPress={() => router.push('/account/new')}
                style={{
                  minWidth: 240,
                  backgroundColor: themeColors.surfaceContainer,
                  padding: 20,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.surfaceContainerHighest,
                  borderStyle: 'dashed',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={32} color={themeColors.onSurfaceVariant} />
                <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 14, marginTop: 8 }}>
                  Nueva Cuenta
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* ===== RESUMEN MENSUAL ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <View>
                <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                  Resumen Mensual
                </ThemedText>
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                  Ingresos vs Gastos
                </ThemedText>
              </View>
              <View style={{
                backgroundColor: themeColors.tertiaryContainer + '30',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}>
                <ThemedText type="badge" themeColor="tertiary" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                  {consumptionPct.toFixed(0)}% CONSUMIDO
                </ThemedText>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={{ height: 8, backgroundColor: themeColors.surfaceVariant, borderRadius: 4, overflow: 'hidden', flexDirection: 'row', marginBottom: 12 }}>
              <View style={{
                height: '100%' as any,
                width: (Math.min(monthlyIncome > 0 ? (monthlyNet > 0 ? (monthlyNet / monthlyIncome) * 100 : 0) : 0, 100)) as any,
                backgroundColor: themeColors.secondary,
              }} />
              <View style={{
                height: '100%' as any,
                width: consumptionPct as any,
                backgroundColor: themeColors.tertiary,
              }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.secondary }} />
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                  Disponible
                </ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: themeColors.tertiary }} />
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                  Gastado
                </ThemedText>
              </View>
            </View>

            {/* Income vs Expected */}
            {expectedMonthlyIncome > 0 && (() => {
              const incomeRatio = monthlyIncome > 0 ? Math.min(monthlyIncome / expectedMonthlyIncome, 1) : 0;
              const incomePct = (incomeRatio * 100).toFixed(0);
              return (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: themeColors.surfaceContainerHighest }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="trending-up-outline" size={16} color={themeColors.secondary} />
                      <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                        Vs. Ingreso Esperado
                      </ThemedText>
                    </View>
                    <ThemedText type="body" themeColor="text" style={{ fontSize: 14, fontWeight: '600' }}>
                      {incomePct}%
                    </ThemedText>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: themeColors.surfaceContainerHighest, overflow: 'hidden' }}>
                    <View style={{
                      height: '100%' as any,
                      width: parseInt(incomePct) as any,
                      borderRadius: 3,
                      backgroundColor: incomeRatio >= 1 ? themeColors.secondary : themeColors.tertiary,
                    }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 10 }}>
                      ${monthlyIncome.toFixed(0)} actual
                    </ThemedText>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 10 }}>
                      ${expectedMonthlyIncome.toFixed(0)} esperado
                    </ThemedText>
                  </View>
                </View>
              );
            })()}
          </GlassCard>
        </View>

        {/* ===== METAS DE AHORRO ===== */}
        {goals.length > 0 && (
          <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Metas de Ahorro
              </ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/goals')} accessibilityLabel="Ver todas las metas">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ThemedText type="badge" themeColor="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>VER TODAS</ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={themeColors.secondary} />
                </View>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 12 }}>
              {goals.slice(0, 4).map((goal) => {
                const progress = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
                const pct = (progress * 100).toFixed(0);
                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => router.push('/(tabs)/goals')}
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: themeColors.surfaceContainerHighest,
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: themeColors.surfaceVariant,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Ionicons name="flag-outline" size={16} color={themeColors.onSurfaceVariant} />
                        </View>
                        <ThemedText type="body" themeColor="text" style={{ fontSize: 15 }}>
                          {goal.name}
                        </ThemedText>
                      </View>
                      <ThemedText type="body" themeColor="secondary" style={{ fontSize: 15, fontWeight: '600' }}>
                        {pct}%
                      </ThemedText>
                    </View>
                    <View style={{ height: 6, backgroundColor: themeColors.surfaceVariant, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{
                        height: '100%' as any,
                        width: parseInt(pct) as any,
                        borderRadius: 3,
                        backgroundColor: progress >= 1 ? themeColors.secondary : themeColors.primary,
                      }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ===== SUSCRIPCIONES PRÓXIMAS ===== */}
        {dueSubscriptions.length > 0 && (
          <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions')}
              style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.surfaceContainerHighest,
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: themeColors.errorContainer + '30',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="alert-circle-outline" size={22} color={themeColors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" themeColor="text" style={{ fontSize: 15, fontWeight: '600' }}>
                    Suscripciones por Vencer
                  </ThemedText>
                  <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                    {dueSubscriptions.length} suscripción{dueSubscriptions.length > 1 ? 'es' : ''} próxima{dueSubscriptions.length > 1 ? 's' : ''} a vencer
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceVariant} />
              </View>
              {dueSubscriptions.slice(0, 3).map((sub) => (
                <View key={sub.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: themeColors.surfaceContainerHighest }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeColors.danger }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" themeColor="text" style={{ fontSize: 13 }}>{sub.name}</ThemedText>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                      Vence: {formatDateShort(sub.nextBillingDate)}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" themeColor="danger" style={{ fontSize: 13, fontWeight: '600' }}>
                    {sub.currency === 'USD' ? formatUSD(sub.amountUSD ?? 0) : formatBS(sub.amountBS ?? 0)}
                  </ThemedText>
                </View>
              ))}
            </TouchableOpacity>
          </View>
        )}

        {/* ===== MOVIMIENTOS RECIENTES ===== */}
        {transactions.length > 0 && (
          <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Movimientos Recientes
              </ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')} accessibilityLabel="Ver todos los movimientos">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ThemedText type="badge" themeColor="secondary" style={{ fontSize: 11, letterSpacing: 0.5 }}>VER TODOS</ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={themeColors.secondary} />
                </View>
              </TouchableOpacity>
            </View>
            <View style={{ gap: 8 }}>
              {transactions.slice(0, 5).map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  onPress={() => router.push('/(tabs)/transactions')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: themeColors.surfaceContainerHighest,
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: tx.type === 'income' ? themeColors.secondaryContainer + '30' : themeColors.errorContainer + '30',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons
                      name={tx.type === 'income' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={18}
                      color={tx.type === 'income' ? themeColors.secondary : themeColors.danger}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" themeColor="text" style={{ fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                      {tx.description}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                      {formatDateShort(tx.date)}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    themeColor={tx.type === 'income' ? 'secondary' : 'danger'}
                    style={{ fontSize: 14, fontWeight: '600' }}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {tx.currency === 'USD' ? formatUSD(tx.amountUSD ?? 0) : formatBS(tx.amountBS ?? 0)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ===== ESPACIO INFERIOR ===== */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
