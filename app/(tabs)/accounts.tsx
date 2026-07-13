import { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Text,
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
import { shadows } from '../../src/theme/shadows';

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
    // Obtener cuentas directamente desde la BD para evitar stale closures
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

  // Recargar datos cada vez que la pantalla obtiene foco
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <ThemedText type="h1">
            Mis Cuentas
          </ThemedText>
          <TouchableOpacity
            onPress={() => router.push('/account/new')}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              ...shadows.primary,
            }}
            accessibilityLabel="Crear nueva cuenta"
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <ThemedText style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Nueva</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {accountsList.map((account) => {
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
                  backgroundColor: themeColors.surface,
                  borderRadius: 20,
                  padding: 20,
                  width: '47%',
                  borderLeftWidth: 4,
                  borderLeftColor: account.color,
                  ...shadows.md,
                }}
                accessibilityLabel={`Ir a cuenta ${account.name}`}
              >
                <Text style={{ fontSize: 32, marginBottom: 12 }}>{account.icon}</Text>
                <ThemedText type="h3" themeColor="text" style={{ marginBottom: 8 }}>
                  {account.name}
                </ThemedText>
                {hasBalance ? (
                  isUSDPrimary ? (
                    <>
                      <ThemedText type="amountMedium" themeColor="text">
                        {formatUSD(balance.balanceUSD)}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        {hasBS ? formatBS(balance.balanceBS) : `≈ ${formatBS(estimatedBS!)}`}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="amountMedium" themeColor="text">
                        {formatBS(balance.balanceBS)}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 2 }}>
                        ≈ {formatUSD(estimatedUSD!)}
                      </ThemedText>
                    </>
                  )
                ) : (
                  <ThemedText type="body" themeColor="textSecondary" style={{ fontStyle: 'italic' }}>
                    Sin saldo
                  </ThemedText>
                )}
                <View style={{
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  backgroundColor: account.color + '20',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}>
                  <ThemedText type="badge" color={account.color}>
                    {account.type === 'exchange' ? 'Exchange' :
                     account.type === 'bank' ? 'Banco' :
                     account.type === 'virtual_card' ? 'Tarjeta Virtual' :
                     account.type === 'cash' ? 'Efectivo' : 'Otra'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
