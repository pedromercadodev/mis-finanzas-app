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
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { useTransactions } from '../../src/store/useTransactions';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance, getAccountsByPlatform } from '../../src/services/accounts';
import { getMonthlySummary } from '../../src/services/transactions';
import { getGoals } from '../../src/services/goals';
import { getDueSubscriptions } from '../../src/services/subscriptions';
import { formatUSD, formatBS, formatDateShort, getCurrentMonthRange } from '../../src/utils/format';
import type { Account, Goal, Subscription } from '../../src/utils/types';

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
  const [balances, setBalances] = useState<Record<number, { balanceUSD: number; balanceBS: number }>>({});
  const [summary, setSummary] = useState({ incomeUSD: 0, incomeBS: 0, expenseUSD: 0, expenseBS: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [freshAccounts, setFreshAccounts] = useState<Account[]>([]);
  const [accountFilter, setAccountFilter] = useState<'all' | 'USD' | 'BS'>('all');
  const [platformData, setPlatformData] = useState<{ platform: string; accounts: Account[]; totalUSD: number; totalBS: number }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dueSubscriptions, setDueSubscriptions] = useState<Subscription[]>([]);

  const loadData = async () => {
    await loadAccounts();
    const month = getCurrentMonthRange().start.substring(0, 7);
    await loadTransactions({ limit: 5 });

    const [monthSummary, goalsData, dueSubs] = await Promise.all([
      getMonthlySummary(month),
      getGoals(),
      getDueSubscriptions(7),
    ]);
    setSummary(monthSummary);
    setGoals(goalsData);
    setDueSubscriptions(dueSubs);

    // Leer cuentas directamente de la BD después de loadAccounts
    const { getAccounts } = await import('../../src/services/accounts');
    const fresh = await getAccounts();
    setFreshAccounts(fresh);
    const newBalances: Record<number, { balanceUSD: number; balanceBS: number }> = {};
    for (const account of fresh) {
      const balance = await getAccountBalance(account.id);
      newBalances[account.id] = balance;
    }
    setBalances(newBalances);

    // Cargar billeteras digitales agrupadas por plataforma
    const platforms = await getAccountsByPlatform();
    setPlatformData(platforms);
  };

  // Recargar datos cada vez que la pantalla obtiene foco (navegación entre tabs)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshRates()]);
    setRefreshing(false);
  };

  // Obtener la tasa activa según preferencia del usuario
  const getActiveRate = (): number | null => {
    // Si hay tasa manual, usarla
    if (manualRate) return manualRate;
    // Sino, usar la tasa preferida
    if (preferredRateType === 'BCV') {
      return bcvRate?.rateUSDToBS ?? null;
    }
    return parallelRate?.rateUSDToBS ?? null;
  };

  const activeRate = getActiveRate();

  // Filtrar cuentas según el filtro seleccionado
  const filteredAccounts = freshAccounts.filter((acc) => {
    const balance = balances[acc.id];
    const hasUSD = (balance?.balanceUSD ?? 0) > 0;
    const hasBS = (balance?.balanceBS ?? 0) > 0;
    if (accountFilter === 'USD') return hasUSD;
    if (accountFilter === 'BS') return hasBS;
    return true; // 'all'
  });

  // Sumar USD y BS reales de TODAS las cuentas (el filtro solo afecta las tarjetas, no el saldo total)
  const rawTotalUSD = freshAccounts.reduce((sum, acc) => sum + (balances[acc.id]?.balanceUSD || 0), 0);
  const rawTotalBS = freshAccounts.reduce((sum, acc) => sum + (balances[acc.id]?.balanceBS || 0), 0);
  // Calcular totales convertidos usando la tasa activa
  // totalUSD = USD reales + BS convertidos a USD
  // totalBS = BS reales + USD convertidos a BS
  const totalUSD = rawTotalUSD + (activeRate ? rawTotalBS / activeRate : 0);
  const totalBS = rawTotalBS + (rawTotalUSD * (activeRate || 0));

  const handleLongPressTotal = () => {
    Alert.alert('Filtrar cuentas', 'Selecciona qué cuentas mostrar en el saldo total:', [
      {
        text: `💲 Solo USD ${accountFilter === 'USD' ? '✓' : ''}`,
        onPress: () => setAccountFilter(accountFilter === 'USD' ? 'all' : 'USD'),
      },
      {
        text: `💵 Solo BS ${accountFilter === 'BS' ? '✓' : ''}`,
        onPress: () => setAccountFilter(accountFilter === 'BS' ? 'all' : 'BS'),
      },
      {
        text: `🌎 Multidivisa ${accountFilter === 'all' ? '✓' : ''}`,
        onPress: () => setAccountFilter('all'),
      },
    ]);
  };

  const getFilterLabel = () => {
    switch (accountFilter) {
      case 'USD': return '💲 USD';
      case 'BS': return '💵 BS';
      default: return '🌎 Todo';
    }
  };

  return (
    <AnimatedTransition>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text }}>
            Mis Finanzas
          </Text>
        </View>

        {/* Saldo Total */}
        <TouchableOpacity
          onLongPress={handleLongPressTotal}
          activeOpacity={0.9}
          style={{ marginHorizontal: 20, marginBottom: 16 }}
        >
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 20,
            padding: 24,
            shadowColor: themeColors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, color: themeColors.textSecondary }}>
                Saldo Total
              </Text>
              <View style={{
                backgroundColor: themeColors.primaryLight + '30',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                <Text style={{ fontSize: 10, color: themeColors.primary, fontWeight: '700' }}>
                  {getFilterLabel()}
                </Text>
                <Ionicons name="chevron-down" size={10} color={themeColors.primary} />
              </View>
            </View>
            {accountFilter === 'BS' ? (
              <>
                <Text style={{ fontSize: 36, fontWeight: '700', color: themeColors.text }}>
                  {formatBS(totalBS)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>
                    {formatUSD(totalUSD)}
                  </Text>
                  <View style={{
                    backgroundColor: themeColors.primaryLight + '40',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: 10, color: themeColors.primary, fontWeight: '600' }}>
                      {manualRate ? (manualRateType === 'BCV' ? 'MANUAL BCV' : 'MANUAL PARALELO') : preferredRateType === 'BCV' ? 'BCV' : 'PARALELO'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 36, fontWeight: '700', color: themeColors.text }}>
                  {formatUSD(totalUSD)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 18, color: themeColors.textSecondary }}>
                    {formatBS(totalBS)}
                  </Text>
                  <View style={{
                    backgroundColor: themeColors.primaryLight + '40',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={{ fontSize: 10, color: themeColors.primary, fontWeight: '600' }}>
                      {manualRate ? (manualRateType === 'BCV' ? 'MANUAL BCV' : 'MANUAL PARALELO') : preferredRateType === 'BCV' ? 'BCV' : 'PARALELO'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>

        {/* Widget de Tasas de Cambio */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: themeColors.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary }}>
                Tasas de Cambio
              </Text>
              <TouchableOpacity
                onPress={refreshRates}
                disabled={ratesLoading}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                {ratesLoading ? (
                  <ActivityIndicator size="small" color={themeColors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={14} color={themeColors.primary} />
                    <Text style={{ fontSize: 12, color: themeColors.primary, fontWeight: '500' }}>
                      Actualizar
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Tasa BCV */}
              <TouchableOpacity
                onPress={() => {
                  if (!manualRate) setPreferredRateType('BCV');
                }}
                style={{
                  flex: 1,
                  backgroundColor: preferredRateType === 'BCV' && !manualRate ? themeColors.primaryLight + '60' : themeColors.primaryLight + '40',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: preferredRateType === 'BCV' && !manualRate ? 1.5 : 0,
                  borderColor: preferredRateType === 'BCV' && !manualRate ? themeColors.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    backgroundColor: themeColors.primary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 12 }}>🏛️</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary }}>
                    BCV
                  </Text>
                  {preferredRateType === 'BCV' && !manualRate && (
                    <Ionicons name="checkmark-circle" size={14} color={themeColors.primary} />
                  )}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.text }}>
                  {bcvRate && bcvRate.rateUSDToBS > 0 ? formatBS(bcvRate.rateUSDToBS) : '—'}
                </Text>
              </TouchableOpacity>

              {/* Tasa Paralelo (USDT) */}
              <TouchableOpacity
                onPress={() => {
                  if (!manualRate) setPreferredRateType('PARALLEL');
                }}
                style={{
                  flex: 1,
                  backgroundColor: preferredRateType === 'PARALLEL' && !manualRate ? themeColors.warningLight + '60' : themeColors.warningLight + '40',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: preferredRateType === 'PARALLEL' && !manualRate ? 1.5 : 0,
                  borderColor: preferredRateType === 'PARALLEL' && !manualRate ? themeColors.warning : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    backgroundColor: themeColors.warning + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 12 }}>💱</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary }}>
                    Paralelo
                  </Text>
                  {preferredRateType === 'PARALLEL' && !manualRate && (
                    <Ionicons name="checkmark-circle" size={14} color={themeColors.warning} />
                  )}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.text }}>
                  {parallelRate ? formatBS(parallelRate.rateUSDToBS) : '—'}
                </Text>
              </TouchableOpacity>
            </View>

            {ratesLastUpdated && (
              <Text style={{
                fontSize: 10,
                color: themeColors.textSecondary,
                marginTop: 8,
                textAlign: 'right',
              }}>
                Actualizado: {ratesLastUpdated.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        </View>

        {/* Billeteras Digitales */}
        {platformData.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <View style={{
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="wallet" size={18} color={themeColors.primary} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary }}>
                    Billeteras Digitales
                  </Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/accounts')}>
                  <Text style={{ color: themeColors.primary, fontSize: 12, fontWeight: '500' }}>
                    Administrar
                  </Text>
                </TouchableOpacity>
              </View>
              {platformData.map((p) => (
                <View key={p.platform} style={{ marginBottom: platformData.indexOf(p) < platformData.length - 1 ? 12 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.text, textTransform: 'capitalize' }}>
                      {p.platform}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.text }}>
                      {formatUSD(p.totalUSD)}
                    </Text>
                  </View>
                  {p.accounts.map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => router.push(`/account/${acc.id}`)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3, paddingLeft: 8 }}
                    >
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                        {acc.icon} {acc.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                        {acc.currency === 'USD' || acc.currency === 'BOTH'
                          ? formatUSD(balances[acc.id]?.balanceUSD ?? 0)
                          : formatBS(balances[acc.id]?.balanceBS ?? 0)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {p.totalBS > 0 && (
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary, textAlign: 'right', marginTop: 2 }}>
                      ≈ {formatBS(p.totalBS)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Accesos Rápidos */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/debts')}
              style={{
                width: '47%',
                backgroundColor: '#FEE2E2',
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Ionicons name="cash" size={24} color="#DC2626" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626', marginTop: 6 }}>
                Deudas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/budgets')}
              style={{
                width: '47%',
                backgroundColor: themeColors.primaryLight + '60',
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Ionicons name="pie-chart" size={24} color={themeColors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.primary, marginTop: 6 }}>
                Presupuestos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/goals')}
              style={{
                width: '47%',
                backgroundColor: themeColors.successLight,
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Ionicons name="trophy" size={24} color={themeColors.success} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.success, marginTop: 6 }}>
                Metas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions')}
              style={{
                width: '47%',
                backgroundColor: themeColors.warningLight + '60',
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Ionicons name="calendar" size={24} color={themeColors.warning} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.warning, marginTop: 6 }}>
                Suscripciones
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tarjetas de Cuentas */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: themeColors.text }}>
              Tus Cuentas
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/accounts')}>
              <Text style={{ color: themeColors.primary, fontSize: 14, fontWeight: '500' }}>
                Ver todas
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            {filteredAccounts.map((account) => {
              const balance = balances[account.id];
              const hasUSD = (balance?.balanceUSD ?? 0) > 0;
              const hasBS = (balance?.balanceBS ?? 0) > 0;
              const hasBalance = hasUSD || hasBS;
              const rate = getActiveRate();

              // Si solo tiene USD, estimar BS
              const estimatedBS = hasUSD && !hasBS && rate
                ? balance.balanceUSD * rate
                : null;
              // Si solo tiene BS, estimar USD
              const estimatedUSD = !hasUSD && hasBS && rate
                ? balance.balanceBS / rate
                : null;

              // Determinar moneda principal
              const isUSDPrimary = hasUSD || (!hasUSD && !hasBS);

              return (
              <TouchableOpacity
                key={account.id}
                onPress={() => router.push(`/account/${account.id}`)}
                style={{
                  backgroundColor: account.color + '15',
                  borderRadius: 16,
                  padding: 16,
                  width: 160,
                  borderWidth: 1,
                  borderColor: account.color + '30',
                }}
              >
                <Text style={{ fontSize: 28, marginBottom: 8 }}>{account.icon}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text, marginBottom: 4 }}>
                  {account.name}
                </Text>
                {hasBalance ? (
                  isUSDPrimary ? (
                    <>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                        {formatUSD(balance.balanceUSD)}
                      </Text>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {hasBS ? formatBS(balance.balanceBS) : `≈ ${formatBS(estimatedBS!)}`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                        {formatBS(balance.balanceBS)}
                      </Text>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        ≈ {formatUSD(estimatedUSD!)}
                      </Text>
                    </>
                  )
                ) : (
                  <Text style={{ fontSize: 13, color: themeColors.textSecondary, fontStyle: 'italic' }}>
                    Sin saldo
                  </Text>
                )}
              </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => router.push('/account/new')}
              style={{
                backgroundColor: themeColors.surface,
                borderRadius: 16,
                padding: 16,
                width: 160,
                borderWidth: 2,
                borderColor: themeColors.border,
                borderStyle: 'dashed',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="add-circle-outline" size={32} color={themeColors.primary} />
              <Text style={{ color: themeColors.primary, fontSize: 14, fontWeight: '500', marginTop: 8 }}>
                Nueva Cuenta
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Resumen del Mes */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: themeColors.text, marginBottom: 12 }}>
            Resumen del Mes
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.successLight,
              borderRadius: 16,
              padding: 16,
            }}>
              <Text style={{ fontSize: 12, color: themeColors.success, fontWeight: '500', marginBottom: 4 }}>
                Ingresos
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.success }}>
                {formatUSD(summary.incomeUSD + (activeRate ? summary.incomeBS / activeRate : 0))}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                {formatBS(summary.incomeBS + (summary.incomeUSD * (activeRate || 0)))}
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.dangerLight,
              borderRadius: 16,
              padding: 16,
            }}>
              <Text style={{ fontSize: 12, color: themeColors.danger, fontWeight: '500', marginBottom: 4 }}>
                Gastos
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.danger }}>
                {formatUSD(summary.expenseUSD + (activeRate ? summary.expenseBS / activeRate : 0))}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                {formatBS(summary.expenseBS + (summary.expenseUSD * (activeRate || 0)))}
              </Text>
            </View>
          </View>
        </View>

        {/* Alertas de Suscripciones */}
        {dueSubscriptions.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/subscriptions')}
              activeOpacity={0.8}
              style={{
                backgroundColor: dueSubscriptions.some(
                  (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                ) ? '#FEE2E2' : '#FEF3C7',
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: dueSubscriptions.some(
                  (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                ) ? '#FCA5A5' : '#FCD34D',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: dueSubscriptions.some(
                    (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                  ) ? '#EF4444' : '#F59E0B',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="calendar" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: dueSubscriptions.some(
                      (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                    ) ? '#991B1B' : '#92400E',
                  }}>
                    {dueSubscriptions.some(
                      (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                    ) ? '🔴 Suscripciones Vencidas' : '🟡 Suscripciones por Vencer'}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: dueSubscriptions.some(
                      (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                    ) ? '#991B1B' : '#92400E',
                    marginTop: 2,
                  }}>
                    {dueSubscriptions.length} suscripción{dueSubscriptions.length !== 1 ? 'es' : ''} próxima{dueSubscriptions.length !== 1 ? 's' : ''} a vencer
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={dueSubscriptions.some(
                    (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                  ) ? '#991B1B' : '#92400E'}
                />
              </View>
              {dueSubscriptions.slice(0, 3).map((sub) => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = sub.nextBillingDate <= today;
                const daysDiff = Math.ceil(
                  (new Date(sub.nextBillingDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <View
                    key={sub.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 6,
                      borderTopWidth: 1,
                      borderTopColor: dueSubscriptions.some(
                        (s) => s.nextBillingDate <= today
                      ) ? '#FCA5A5' : '#FDE68A',
                    }}
                  >
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: dueSubscriptions.some(
                          (s) => s.nextBillingDate <= today
                        ) ? '#991B1B' : '#92400E',
                      }} numberOfLines={1}>
                        {sub.name}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: isOverdue ? '#DC2626' : '#D97706',
                    }}>
                      {isOverdue ? `Vencida (${Math.abs(daysDiff)}d)` : `En ${daysDiff}d`}
                    </Text>
                  </View>
                );
              })}
              {dueSubscriptions.length > 3 && (
                <Text style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: dueSubscriptions.some(
                    (s) => s.nextBillingDate <= new Date().toISOString().split('T')[0]
                  ) ? '#991B1B' : '#92400E',
                  textAlign: 'center',
                  marginTop: 6,
                }}>
                  +{dueSubscriptions.length - 3} más
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Resumen de Metas */}
        {goals.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: themeColors.text }}>
                🎯 Tus Metas
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/goals')}>
                <Text style={{ color: themeColors.primary, fontSize: 14, fontWeight: '500' }}>
                  Ver todo
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}>
              {goals.slice(0, 4).map((goal) => {
                const progress = goal.targetAmount > 0
                  ? Math.min(goal.currentAmount / goal.targetAmount, 1)
                  : 0;
                const progressPercent = Math.round(progress * 100);
                const isCompleted = goal.currentAmount >= goal.targetAmount;
                const isUSD = goal.currency === 'USD';
                const currentFormatted = isUSD ? formatUSD(goal.currentAmount) : formatBS(goal.currentAmount);
                const targetFormatted = isUSD ? formatUSD(goal.targetAmount) : formatBS(goal.targetAmount);

                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => router.push('/(tabs)/goals')}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: goal.id !== goals.slice(0, 4)[goals.slice(0, 4).length - 1]?.id ? 1 : 0,
                      borderBottomColor: themeColors.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }} numberOfLines={1}>
                          {goal.name}
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: isCompleted ? themeColors.success : themeColors.textSecondary }}>
                          {progressPercent}%
                        </Text>
                      </View>
                      <View style={{
                        height: 8,
                        backgroundColor: themeColors.primaryLight + '40',
                        borderRadius: 4,
                        overflow: 'hidden',
                        marginBottom: 4,
                      }}>
                        <View style={{
                          width: `${progressPercent}%`,
                          height: '100%',
                          backgroundColor: isCompleted ? themeColors.success : themeColors.primary,
                          borderRadius: 4,
                        }} />
                      </View>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                        {currentFormatted} / {targetFormatted}
                      </Text>
                    </View>
                    {isCompleted && (
                      <Ionicons name="checkmark-circle" size={20} color={themeColors.success} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Últimas Transacciones */}
        <View style={{ marginHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: themeColors.text }}>
              Últimos Movimientos
            </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={{ color: themeColors.primary, fontSize: 14, fontWeight: '500' }}>
                Ver todo
              </Text>
            </TouchableOpacity>
          </View>
          {transactions.slice(0, 5).map((tx) => (
            <View
              key={tx.id}
              style={{
                backgroundColor: themeColors.surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: tx.type === 'income' ? themeColors.successLight : themeColors.dangerLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
              }}>
                <Ionicons
                  name={tx.type === 'income' ? 'arrow-down' : tx.type === 'transfer' ? 'swap-horizontal' : 'arrow-up'}
                  size={20}
                  color={tx.type === 'income' ? themeColors.success : themeColors.danger}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                  {tx.description}
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                  {formatDateShort(tx.date)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {tx.amountUSD && (
                  <Text style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: tx.type === 'income' ? themeColors.success : themeColors.danger,
                  }}>
                    {tx.type === 'income' ? '+' : '-'}{formatUSD(tx.amountUSD)}
                  </Text>
                )}
                {tx.amountBS && (
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                    {formatBS(tx.amountBS)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FAB - Nueva Transacción */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/transactions')}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: themeColors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: themeColors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
    </AnimatedTransition>
  );
}
