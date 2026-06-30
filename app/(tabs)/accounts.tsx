import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAccounts } from '../../src/store/useAccounts';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { getAccountBalance, getAccounts as getAccountsFromDB } from '../../src/services/accounts';
import { formatUSD, formatBS } from '../../src/utils/format';
import { useSettings } from '../../src/store/useSettings';

export default function AccountsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
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
    <AnimatedTransition>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: isSmall ? 14 : 20, paddingBottom: 100 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: isSmall ? 24 : 28, fontWeight: '700', color: themeColors.text }}>
            Mis Cuentas
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/account/new')}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: isSmall ? 12 : 16,
              paddingVertical: isSmall ? 8 : 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Nueva</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isSmall ? 8 : 12 }}>
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
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text style={{ fontSize: 32, marginBottom: 12 }}>{account.icon}</Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text, marginBottom: 8 }}>
                  {account.name}
                </Text>
                {hasBalance ? (
                  isUSDPrimary ? (
                    <>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.text }}>
                        {formatUSD(balance.balanceUSD)}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                        {hasBS ? formatBS(balance.balanceBS) : `≈ ${formatBS(estimatedBS!)}`}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: themeColors.text }}>
                        {formatBS(balance.balanceBS)}
                      </Text>
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                        ≈ {formatUSD(estimatedUSD!)}
                      </Text>
                    </>
                  )
                ) : (
                  <Text style={{ fontSize: 14, color: themeColors.textSecondary, fontStyle: 'italic' }}>
                    Sin saldo
                  </Text>
                )}
                <View style={{
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  backgroundColor: account.color + '20',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 11, color: account.color, fontWeight: '500' }}>
                    {account.type === 'exchange' ? 'Exchange' :
                     account.type === 'bank' ? 'Banco' :
                     account.type === 'virtual_card' ? 'Tarjeta Virtual' :
                     account.type === 'cash' ? 'Efectivo' : 'Otra'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
    </AnimatedTransition>
  );
}
