import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAccounts } from '../../src/store/useAccounts';
import { useTransactions } from '../../src/store/useTransactions';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { DashboardSkeleton } from '../../src/components/Skeleton';
import ThemedText from '../../src/components/ThemedText';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance, getAccountsByPlatform } from '../../src/services/accounts';
import { getMonthlySummary } from '../../src/services/transactions';
import { getGoals } from '../../src/services/goals';
import { getDueSubscriptions } from '../../src/services/subscriptions';
import { formatUSD, formatBS, formatDateShort, getCurrentMonthRange } from '../../src/utils/format';
import type { Account, Goal, Subscription } from '../../src/utils/types';
import { haptic } from '../../src/utils/haptics';
import { shadows } from '../../src/theme/shadows';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_MARGIN = 20;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_MARGIN * 2;

export default function DashboardScreen() {
  const router = useRouter();
  const { accounts, loadAccounts } = useAccounts();
  const { transactions, loadTransactions } = useTransactions();
  const themeColors = useThemeColors();
  const { preferredRateType, manualRate, manualRateType, setPreferredRateType } = useSettings();
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
  const [dueSubscriptions, setDueSubscriptions] = useState<Subscription[]>([]);
  const [balances, setBalances] = useState<Record<number, { balanceUSD: number; balanceBS: number }>>({});

  const getActiveRate = (): number | null => {
    if (manualRate !== null && manualRateType === preferredRateType) return manualRate;
    if (bcvRate || parallelRate) {
      return preferredRateType === 'BCV' ? (bcvRate?.rateUSDToBS ?? null) : (parallelRate?.rateUSDToBS ?? null);
    }
    return null;
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (accountFilter === 'usd') return acc.currency === 'USD';
    if (accountFilter === 'bs') return acc.currency === 'BS';
    return true;
  });

  const getFilterLabel = () => {
    switch (accountFilter) {
      case 'all': return 'Todas las cuentas';
      case 'usd': return 'Cuentas USD';
      case 'bs': return 'Cuentas BS';
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadAccounts(), loadTransactions()]);
      const accs = useAccounts.getState().accounts;
      const txns = useTransactions.getState().transactions;

      const [platData, monthSumm, goalsData, subsData] = await Promise.all([
        getAccountsByPlatform(),
        getMonthlySummary(getCurrentMonthRange().start.substring(0, 7)),
        getGoals(),
        getDueSubscriptions(),
      ]);

      setPlatformData(platData);
      setMonthlySummary(monthSumm);
      setGoals(goalsData);
      setDueSubscriptions(subsData);

      const balMap: Record<number, { balanceUSD: number; balanceBS: number }> = {};
      await Promise.all(
        accs.map(async (acc) => {
          const bal = await getAccountBalance(acc.id!);
          balMap[acc.id!] = bal;
        })
      );
      setBalances(balMap);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && accounts.length === 0) {
    return <DashboardSkeleton />;
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
            tintColor={themeColors.primary}
            colors={[themeColors.primary]}
          />
        }
      >
        {/* ===== HEADER ===== */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h2" themeColor="text">
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return 'Buenos días ☀️';
                  if (h < 18) return 'Buenas tardes 🌤️';
                  return 'Buenas noches 🌙';
                })()}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                Resumen financiero
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/settings')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: themeColors.surface,
                justifyContent: 'center',
                alignItems: 'center',
                ...shadows.sm,
              }}
              accessibilityLabel="Configuración"
            >
              <Ionicons name="settings-outline" size={22} color={themeColors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== TARJETA DE SALDO ===== */}
        <View style={{ paddingHorizontal: CARD_HORIZONTAL_MARGIN, marginBottom: 20 }}>
          <View
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 20,
              padding: 20,
              ...shadows.lg,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: themeColors.primaryLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="wallet-outline" size={16} color={themeColors.primary} />
                </View>
                <ThemedText type="body" themeColor="textSecondary">
                  Balance Total
                </ThemedText>
              </View>
              <View style={{
                backgroundColor: themeColors.primaryLight,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
                <ThemedText type="badge" themeColor="primary">
                  {getFilterLabel()}
                </ThemedText>
              </View>
            </View>

            {(() => {
              const rate = getActiveRate();
              let totalUSD = 0;
              let totalBS = 0;

              accounts.forEach((acc) => {
                const bal = balances[acc.id!];
                if (bal) {
                  if (acc.currency === 'USD') {
                    totalUSD += bal.balanceUSD;
                  } else {
                    totalBS += bal.balanceBS;
                  }
                }
              });

              const totalConverted = totalUSD + (rate ? totalBS / rate : 0);
              const totalInBs = totalBS + (rate ? totalUSD * rate : 0);

              return (
                <>
                  <ThemedText type="h1" themeColor="text" style={{ marginBottom: 4 }}>
                    {formatUSD(totalConverted)}
                  </ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">
                    {formatBS(totalInBs)}
                  </ThemedText>
                </>
              );
            })()}

            {/* Filter chips */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
              {(['all', 'usd', 'bs'] as const).map((chip) => {
                const isActive = accountFilter === chip;
                return (
                  <TouchableOpacity
                    key={chip}
                    onPress={() => setAccountFilter(chip)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: isActive ? themeColors.primary : themeColors.surfaceElevated,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isActive ? '#FFFFFF' : themeColors.textTertiary,
                      }} />
                      <ThemedText
                        type="badge"
                        themeColor={isActive ? 'text' : 'textSecondary'}
                        style={{ color: isActive ? '#FFFFFF' : undefined }}
                      >
                        {chip === 'all' ? 'Todo' : chip.toUpperCase()}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ===== ACCESOS RÁPIDOS — Premium 2x2 ===== */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          {/* Fila 1 */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/transactions')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 18,
                alignItems: 'center',
                borderLeftWidth: 3,
                borderLeftColor: themeColors.primary,
                shadowColor: themeColors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
              accessibilityLabel="Transacciones"
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: themeColors.primaryLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: themeColors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Ionicons name="swap-horizontal" size={26} color={themeColors.primary} />
              </View>
              <ThemedText type="badge" themeColor="text" style={{ fontWeight: '700', marginBottom: 6, fontSize: 13 }}>
                Movimientos
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.primaryLight,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <ThemedText type="caption" themeColor="primary" style={{ fontSize: 11, fontWeight: '800' }}>
                  {transactions.length > 0 ? `${transactions.length} este mes` : '0'}
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/accounts')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 18,
                alignItems: 'center',
                borderLeftWidth: 3,
                borderLeftColor: themeColors.success,
                shadowColor: themeColors.success,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
              accessibilityLabel="Cuentas"
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: themeColors.successLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: themeColors.success,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Ionicons name="wallet-outline" size={26} color={themeColors.success} />
              </View>
              <ThemedText type="badge" themeColor="text" style={{ fontWeight: '700', marginBottom: 6, fontSize: 13 }}>
                Cuentas
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.successLight,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <ThemedText type="caption" themeColor="success" style={{ fontSize: 11, fontWeight: '800' }}>
                  {accounts.filter(a => a.isActive).length} activas
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>

          {/* Fila 2 */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/reports')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 18,
                alignItems: 'center',
                borderLeftWidth: 3,
                borderLeftColor: themeColors.warning,
                shadowColor: themeColors.warning,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
              accessibilityLabel="Reportes"
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: themeColors.warningLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: themeColors.warning,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Ionicons name="bar-chart-outline" size={26} color={themeColors.warning} />
              </View>
              <ThemedText type="badge" themeColor="text" style={{ fontWeight: '700', marginBottom: 6, fontSize: 13 }}>
                Reportes
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.warningLight,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <ThemedText type="caption" themeColor="warning" style={{ fontSize: 11, fontWeight: '800' }}>
                  {(() => {
                    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    return meses[new Date().getMonth()];
                  })()}
                </ThemedText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/goals')}
              style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 18,
                alignItems: 'center',
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
                shadowColor: themeColors.danger,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
              accessibilityLabel="Metas"
            >
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: themeColors.dangerLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 10,
                shadowColor: themeColors.danger,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4,
              }}>
                <Ionicons name="flag-outline" size={26} color={themeColors.danger} />
              </View>
              <ThemedText type="badge" themeColor="text" style={{ fontWeight: '700', marginBottom: 6, fontSize: 13 }}>
                Metas
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.dangerLight,
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
              }}>
                <ThemedText type="caption" themeColor="danger" style={{ fontSize: 11, fontWeight: '800' }}>
                  {goals.length > 0 ? `${goals.length} activas` : '0'}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== TASAS DE CAMBIO ===== */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: 16,
            ...shadows.md,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: themeColors.primaryLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="trending-up-outline" size={16} color={themeColors.primary} />
                </View>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  Tasas de Cambio
                </ThemedText>
              </View>
              <TouchableOpacity
                onPress={() => {
                  refreshRates();
                  haptic('light');
                }}
                disabled={ratesLoading}
                accessibilityLabel="Actualizar tasas"
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={ratesLoading ? themeColors.textTertiary : themeColors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setPreferredRateType('BCV')}
                style={{
                  flex: 1,
                  backgroundColor: preferredRateType === 'BCV' ? themeColors.primaryLight : themeColors.surfaceElevated,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <ThemedText type="badge" themeColor={preferredRateType === 'BCV' ? 'primary' : 'textSecondary'} style={{ marginBottom: 4 }}>
                  BCV
                </ThemedText>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  {bcvRate ? formatUSD(bcvRate.rateUSDToBS) : '—'}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPreferredRateType('PARALLEL')}
                style={{
                  flex: 1,
                  backgroundColor: preferredRateType === 'PARALLEL' ? themeColors.primaryLight : themeColors.surfaceElevated,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <ThemedText type="badge" themeColor={preferredRateType === 'PARALLEL' ? 'primary' : 'textSecondary'} style={{ marginBottom: 4 }}>
                  Paralelo
                </ThemedText>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  {parallelRate ? formatUSD(parallelRate.rateUSDToBS) : '—'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            {ratesLastUpdated && (
              <ThemedText type="caption" themeColor="textTertiary" style={{ marginTop: 8 }}>
                Actualizado: {formatDateShort(ratesLastUpdated.toISOString())}
              </ThemedText>
            )}
          </View>
        </View>

        {/* ===== BILLETERAS DIGITALES ===== */}
        {platformData.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              ...shadows.md,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: themeColors.primaryLight,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons name="phone-portrait-outline" size={16} color={themeColors.primary} />
                  </View>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    Billeteras Digitales
                  </ThemedText>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/accounts')} accessibilityLabel="Administrar billeteras">
                  <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
                </TouchableOpacity>
              </View>

              {platformData.map((p) => (
                <View key={p.platform} style={{ marginBottom: platformData.indexOf(p) < platformData.length - 1 ? 14 : 0 }}>
                  <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <ThemedText type="badge" themeColor="textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {p.platform}
                    </ThemedText>
                    <ThemedText type="badge" themeColor="textSecondary">
                      ${formatUSD(p.totalUSD)} | Bs. {formatBS(p.totalBS)}
                    </ThemedText>
                  </View>

                  {p.accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => router.push(`/account/${acc.id}`)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: themeColors.surfaceElevated,
                        borderRadius: 10,
                        marginBottom: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: acc.color || themeColors.primary,
                        }} />
                        <ThemedText type="body" themeColor="text">{acc.name}</ThemedText>
                      </View>
                      <ThemedText type="caption" themeColor="textSecondary" style={{ fontWeight: '600' }}>
                        {acc.currency === 'USD' ? formatUSD(balances[acc.id!]?.balanceUSD || 0) : formatBS(balances[acc.id!]?.balanceBS || 0)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===== CUENTAS BANCARIAS ===== */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 }}>
            <ThemedText type="h3" themeColor="text">
              Cuentas
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/accounts')} accessibilityLabel="Ver todas las cuentas">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ThemedText type="badge" themeColor="primary">Ver todas</ThemedText>
                <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {filteredAccounts.map((account) => {
              const bal = balances[account.id!];
              const displayBalance = account.currency === 'USD'
                ? (bal ? formatUSD(bal.balanceUSD) : '—')
                : (bal ? formatBS(bal.balanceBS) : '—');

              return (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => router.push(`/account/${account.id}`)}
                  style={{
                    width: 160,
                    backgroundColor: themeColors.surface,
                    borderRadius: 16,
                    padding: 16,
                    ...shadows.md,
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: (account.color || themeColors.primary) + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}>
                    <Ionicons
                      name={account.currency === 'USD' ? 'cash-outline' : 'card-outline'}
                      size={18}
                      color={account.color || themeColors.primary}
                    />
                  </View>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>
                    {account.name}
                  </ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">
                    {displayBalance}
                  </ThemedText>
                  <ThemedText type="badge" themeColor="textTertiary" style={{ marginTop: 4 }}>
                    {account.currency === 'USD' ? 'Dólares' : 'Bolívares'}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => router.push('/account/new')}
              style={{
                width: 160,
                backgroundColor: themeColors.surface,
                borderRadius: 16,
                padding: 16,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: themeColors.border,
                borderStyle: 'dashed',
              }}
            >
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: themeColors.primaryLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 8,
              }}>
                <Ionicons name="add" size={20} color={themeColors.primary} />
              </View>
              <ThemedText type="body" themeColor="primary" style={{ fontWeight: '600' }}>
                Nueva Cuenta
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ===== RESUMEN DEL MES ===== */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <ThemedText type="h3" themeColor="text" style={{ marginBottom: 14 }}>
            Resumen del Mes
          </ThemedText>
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: 16,
            ...shadows.md,
          }}>
            {monthlySummary ? (
              <>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                  <View style={{
                    flex: 1,
                    backgroundColor: themeColors.successLight,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: themeColors.success + '20',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name="arrow-down" size={12} color={themeColors.success} />
                      </View>
                      <ThemedText type="badge" themeColor="success">Ingresos</ThemedText>
                    </View>
                    <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                      {formatUSD(monthlySummary.incomeUSD)}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatBS(monthlySummary.incomeBS)}
                    </ThemedText>
                  </View>

                  <View style={{
                    flex: 1,
                    backgroundColor: themeColors.dangerLight,
                    borderRadius: 12,
                    padding: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <View style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        backgroundColor: themeColors.danger + '20',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name="arrow-up" size={12} color={themeColors.danger} />
                      </View>
                      <ThemedText type="badge" themeColor="danger">Gastos</ThemedText>
                    </View>
                    <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                      {formatUSD(monthlySummary.expenseUSD)}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatBS(monthlySummary.expenseBS)}
                    </ThemedText>
                  </View>
                </View>

                {(() => {
                  const totalIncome = monthlySummary.incomeUSD + (monthlySummary.incomeBS / (getActiveRate() || 1));
                  const totalExpense = monthlySummary.expenseUSD + (monthlySummary.expenseBS / (getActiveRate() || 1));
                  const net = totalIncome - totalExpense;
                  const ratio = totalIncome > 0 ? Math.min(totalExpense / totalIncome, 1) : 0;

                  return (
                    <View>
                      <View style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: themeColors.surfaceElevated,
                        overflow: 'hidden',
                        marginBottom: 8,
                      }}>
                        <View style={{
                          width: `${ratio * 100}%`,
                          height: '100%',
                          backgroundColor: ratio > 0.8 ? themeColors.danger : ratio > 0.5 ? themeColors.warning : themeColors.success,
                          borderRadius: 3,
                        }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <ThemedText type="caption" themeColor="textSecondary">
                          {ratio > 0.8 ? '⚠️ Alto gasto' : ratio > 0.5 ? '📊 Gasto moderado' : '✅ Buen ritmo'}
                        </ThemedText>
                        <ThemedText
                          type="badge"
                          themeColor={net >= 0 ? 'success' : 'danger'}
                        >
                          {net >= 0 ? `+${formatUSD(net)}` : formatUSD(net)}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })()}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={themeColors.primary} />
              </View>
            )}
          </View>
        </View>

        {/* ===== SUSCRIPCIONES PRÓXIMAS ===== */}
        {dueSubscriptions.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions')}
              style={{
                backgroundColor: themeColors.surface,
                borderRadius: 16,
                padding: 16,
                ...shadows.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: themeColors.dangerLight,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Ionicons name="alert-circle-outline" size={20} color={themeColors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" color={dueSubscriptions.some(s => {
                    const daysUntil = Math.ceil((new Date(s.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return daysUntil <= 3;
                  }) ? themeColors.danger : themeColors.text} style={{ fontWeight: '600' }}>
                    Suscripciones próximas
                  </ThemedText>
                  <ThemedText type="caption" color={dueSubscriptions.some(s => {
                    const daysUntil = Math.ceil((new Date(s.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return daysUntil <= 3;
                  }) ? themeColors.danger : themeColors.textSecondary}>
                    {dueSubscriptions.length} suscripción(es) por vencer
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
              </View>

              {dueSubscriptions.slice(0, 3).map((sub) => {
                const daysUntil = Math.ceil((new Date(sub.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysUntil <= 3;
                return (
                  <View
                    key={sub.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: isUrgent ? themeColors.dangerLight : themeColors.surfaceElevated,
                      borderRadius: 8,
                      marginBottom: 4,
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: isUrgent ? themeColors.danger : themeColors.warning,
                      }} />
                      <ThemedText type="body" color={isUrgent ? themeColors.danger : themeColors.text}>
                        {sub.name}
                      </ThemedText>
                    </View>
                    <ThemedText type="caption" color={isUrgent ? themeColors.danger : themeColors.textSecondary}>
                      {daysUntil === 0 ? 'Hoy' : daysUntil === 1 ? 'Mañana' : `${daysUntil} días`}
                    </ThemedText>
                  </View>
                );
              })}

              {dueSubscriptions.length > 3 && (
                <ThemedText type="caption" themeColor="textTertiary" style={{ textAlign: 'center', marginTop: 8 }}>
                  +{dueSubscriptions.length - 3} más
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ===== METAS DE AHORRO ===== */}
        {goals.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <ThemedText type="h3" themeColor="text">
                Metas de Ahorro
              </ThemedText>
              <TouchableOpacity onPress={() => router.push('/(tabs)/goals')} accessibilityLabel="Ver todas las metas">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ThemedText type="badge" themeColor="primary">Ver todas</ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={{
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              ...shadows.md,
            }}>
              {goals.slice(0, 4).map((goal) => {
                const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
                const progressColor = progress >= 100 ? themeColors.success : progress >= 50 ? themeColors.warning : themeColors.primary;

                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => router.push('/(tabs)/goals')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: goals.indexOf(goal) < Math.min(goals.length, 4) - 1 ? 1 : 0,
                      borderBottomColor: themeColors.border,
                    }}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: progressColor + '20',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons
                        name={progress >= 100 ? 'checkmark-circle' : 'flag-outline'}
                        size={18}
                        color={progressColor}
                      />
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }} numberOfLines={1}>
                          {goal.name}
                        </ThemedText>
                        <ThemedText type="badge" themeColor="textSecondary">
                          {Math.round(progress)}%
                        </ThemedText>
                      </View>
                      <View style={{
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: themeColors.surfaceElevated,
                        overflow: 'hidden',
                      }}>
                        <View style={{
                          width: `${progress}%`,
                          height: '100%',
                          backgroundColor: progressColor,
                          borderRadius: 2,
                        }} />
                      </View>
                    </View>
                    <ThemedText type="body" themeColor="textSecondary" style={{ fontWeight: '600' }}>
                      {goal.currency === 'USD' ? formatUSD(goal.currentAmount) : formatBS(goal.currentAmount)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ===== ÚLTIMAS TRANSACCIONES ===== */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <ThemedText type="h3" themeColor="text">
              Últimas Transacciones
            </ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')} accessibilityLabel="Ver todas las transacciones">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ThemedText type="badge" themeColor="primary">Ver todas</ThemedText>
                <Ionicons name="chevron-forward" size={14} color={themeColors.primary} />
              </View>
            </TouchableOpacity>
          </View>

          {transactions.slice(0, 5).map((tx, index) => {
            const isIncome = tx.type === 'income';
            const isExpense = tx.type === 'expense';
            const iconName = isIncome ? 'arrow-down-circle-outline' : isExpense ? 'arrow-up-circle-outline' : 'swap-horizontal-outline';
            const iconColor = isIncome ? themeColors.success : isExpense ? themeColors.danger : themeColors.warning;
            const bgColor = isIncome ? themeColors.successLight : isExpense ? themeColors.dangerLight : themeColors.warningLight;

            return (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  marginBottom: 8,
                  ...shadows.sm,
                }}
              >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: bgColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={iconName} size={18} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '500' }} numberOfLines={1}>
                    {tx.description}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textTertiary">
                    {formatDateShort(tx.date)}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText
                    type="body"
                    color={isIncome ? themeColors.success : isExpense ? themeColors.danger : themeColors.text}
                    style={{ fontWeight: '600' }}
                  >
                    {isIncome ? '+' : isExpense ? '-' : ''}
                    {tx.amountUSD !== null && tx.amountUSD !== 0
                      ? formatUSD(tx.amountUSD)
                      : formatBS(tx.amountBS || 0)}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
