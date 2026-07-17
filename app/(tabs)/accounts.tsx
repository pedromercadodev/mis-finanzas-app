import { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAccounts } from '../../src/store/useAccounts';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { getAccountBalance, getAccounts as getAccountsFromDB } from '../../src/services/accounts';
import { formatUSD, formatBS } from '../../src/utils/format';
import { useSettings } from '../../src/store/useSettings';
import ThemedText from '../../src/components/ThemedText';

export default function AccountsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { loadAccounts } = useAccounts();
  const { preferredRateType } = useSettings();
  const { bcv, parallel } = useExchangeRates();
  const [accountsList, setAccountsList] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, { balanceUSD: number; balanceBS: number }>>({});
  const [refreshing, setRefreshing] = useState(false);

  const getActiveRate = (): number | null => {
    if (preferredRateType === 'BCV') return bcv?.rateUSDToBS ?? null;
    return parallel?.rateUSDToBS ?? null;
  };

  const loadData = async () => {
    const freshAccounts = await getAccountsFromDB();
    setAccountsList(freshAccounts);
    await loadAccounts();

    const newBalances: Record<number, { balanceUSD: number; balanceBS: number }> = {};
    for (const account of freshAccounts) {
      const balance = await getAccountBalance(account.id);
      newBalances[account.id] = balance;
    }
    setBalances(newBalances);
  };

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

  // Calcular balance total
  const totalBalanceUSD = useMemo(() => {
    return accountsList.reduce((sum, account) => {
      const balance = balances[account.id];
      return sum + (balance?.balanceUSD ?? 0);
    }, 0);
  }, [accountsList, balances]);

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'bank': return 'Banco';
      case 'exchange': return 'Exchange';
      case 'virtual_card': return 'Digital';
      case 'cash': return 'Efectivo';
      default: return 'Otra';
    }
  };

  const getAccentColor = (account: any): string => {
    // Usar el color de la cuenta, o secondary por defecto
    return account.color || themeColors.secondary;
  };

  const getIconName = (account: any): keyof typeof Ionicons.glyphMap => {
    const icon = account.icon || 'wallet-outline';
    // Mapear emojis/icons a Ionicons
    if (icon === '🏦' || account.type === 'bank') return 'account-balance-outline' as any;
    if (icon === '💳' || account.type === 'virtual_card') return 'card' as any;
    if (icon === '💵' || account.type === 'cash') return 'cash' as any;
    if (icon === '🌐' || account.type === 'exchange') return 'globe' as any;
    if (icon === '🐷') return 'piggy-bank' as any;
    if (icon === '💰') return 'wallet' as any;
    if (icon === '🏠') return 'home' as any;
    if (icon === '📱') return 'phone-portrait' as any;
    if (icon === '💼') return 'briefcase' as any;
    if (icon === '⭐') return 'star' as any;
    if (icon === '🔵') return 'ellipse' as any;
    if (icon === '🟣') return 'ellipse' as any;
    if (icon === '🟢') return 'ellipse' as any;
    if (icon === '🔴') return 'ellipse' as any;
    if (icon === '🟡') return 'ellipse' as any;
    if (icon === '🟠') return 'ellipse' as any;
    return 'wallet-outline' as any;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="wallet" size={20} color={themeColors.secondary} />
              </View>
              <ThemedText type="h1" themeColor="text" style={{ fontSize: 24 }}>
                Mis Cuentas
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/account/new')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.secondary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Crear nueva cuenta"
            >
              <Ionicons name="add" size={22} color={themeColors.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Total */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 14 }}>
              Balance Total
            </ThemedText>
            <ThemedText type="h2" themeColor="text" style={{ fontSize: 24, fontWeight: '700' }}>
              {formatUSD(totalBalanceUSD)}
            </ThemedText>
          </View>
        </View>

        {/* Grid de Cuentas */}
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          {accountsList.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
              <View style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: themeColors.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Ionicons name="wallet-outline" size={32} color={themeColors.secondary} />
              </View>
              <ThemedText type="body" themeColor="onSurfaceVariant" style={{ textAlign: 'center' }}>
                No tienes cuentas registradas
              </ThemedText>
              <TouchableOpacity
                onPress={() => router.push('/account/new')}
                style={{
                  marginTop: 16,
                  backgroundColor: themeColors.secondary,
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <Ionicons name="add" size={18} color={themeColors.background} />
                <ThemedText style={{ color: themeColors.background, fontWeight: '600', fontSize: 14 }}>
                  Crear cuenta
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {accountsList.map((account) => {
                const balance = balances[account.id];
                const hasUSD = (balance?.balanceUSD ?? 0) > 0;
                const hasBS = (balance?.balanceBS ?? 0) > 0;
                const hasBalance = hasUSD || hasBS;
                const rate = getActiveRate();
                const accentColor = getAccentColor(account);

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
                      backgroundColor: themeColors.surfaceContainer + '99',
                      borderRadius: 16,
                      padding: 16,
                      width: '47%',
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '30',
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.6,
                      shadowRadius: 24,
                      elevation: 8,
                      overflow: 'hidden',
                    }}
                    accessibilityLabel={`Ir a cuenta ${account.name}`}
                  >
                    {/* Accent border izquierdo */}
                    <View style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      backgroundColor: accentColor,
                      borderTopLeftRadius: 16,
                      borderBottomLeftRadius: 16,
                    }} />

                    {/* Icono y badge */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: themeColors.surfaceContainer,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '50',
                      }}>
                        <Ionicons
                          name={getIconName(account)}
                          size={18}
                          color={accentColor}
                        />
                      </View>
                      <View style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 8,
                        backgroundColor: accentColor + '20',
                      }}>
                        <ThemedText
                          style={{
                            fontSize: 10,
                            fontWeight: '600',
                            letterSpacing: 0.5,
                            color: accentColor,
                          }}
                        >
                          {getTypeLabel(account.type)}
                        </ThemedText>
                      </View>
                    </View>

                    {/* Nombre de la cuenta */}
                    <ThemedText type="body" themeColor="text" style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                      {account.name}
                    </ThemedText>

                    {/* Saldos */}
                    {hasBalance ? (
                      isUSDPrimary ? (
                        <>
                          <ThemedText type="h3" themeColor="text" style={{ fontSize: 18, fontWeight: '700' }}>
                            {formatUSD(balance.balanceUSD)}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2, fontSize: 12 }}>
                            {hasBS ? formatBS(balance.balanceBS) : `≈ ${formatBS(estimatedBS!)}`}
                          </ThemedText>
                        </>
                      ) : (
                        <>
                          <ThemedText type="h3" themeColor="text" style={{ fontSize: 18, fontWeight: '700' }}>
                            {formatBS(balance.balanceBS)}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2, fontSize: 12 }}>
                            ≈ {formatUSD(estimatedUSD!)}
                          </ThemedText>
                        </>
                      )
                    ) : (
                      <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontStyle: 'italic', fontSize: 13 }}>
                        Sin saldo
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
