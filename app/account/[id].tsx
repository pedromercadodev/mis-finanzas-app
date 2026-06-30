import { useCallback, useState } from 'react';
import { updateAccount } from '../../src/services/accounts';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useAccounts } from '../../src/store/useAccounts';
import { useTransactions } from '../../src/store/useTransactions';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance } from '../../src/services/accounts';
import { formatUSD, formatBS, formatDate } from '../../src/utils/format';
import type { Transaction } from '../../src/utils/types';

const typeLabels: Record<string, string> = {
  exchange: 'Exchange',
  bank: 'Banco',
  virtual_card: 'Tarjeta Virtual',
  cash: 'Efectivo',
  other: 'Otra',
};

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeColors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
  const accountId = parseInt(id, 10);

  const { accounts, loadAccounts, removeAccount } = useAccounts();
  const { transactions, loadTransactions } = useTransactions();
  const { preferredRateType } = useSettings();
  const { bcv, parallel } = useExchangeRates();

  const [balance, setBalance] = useState({ balanceUSD: 0, balanceBS: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');

  const account = accounts.find((a) => a.id === accountId);

  const getActiveRate = (): number | null => {
    if (preferredRateType === 'BCV') return bcv?.rateUSDToBS ?? null;
    return parallel?.rateUSDToBS ?? null;
  };

  const loadData = async () => {
    await loadAccounts();
    await loadTransactions({ accountId, limit: 50 });
    const bal = await getAccountBalance(accountId);
    setBalance(bal);
  };

  // Recargar al recibir foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [accountId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar cuenta',
      `¿Estás seguro de eliminar "${account?.name}"? Las transacciones se mantendrán pero la cuenta se desactivará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removeAccount(accountId);
            router.back();
          },
        },
      ]
    );
  };

  const getTransactionIcon = (tx: Transaction): 'arrow-down-circle' | 'arrow-up-circle' | 'swap-horizontal' => {
    if (tx.type === 'income') return 'arrow-down-circle';
    if (tx.type === 'expense') return 'arrow-up-circle';
    return 'swap-horizontal';
  };

  const getTransactionColor = (tx: Transaction) => {
    if (tx.type === 'income') return themeColors.success;
    if (tx.type === 'expense') return themeColors.danger;
    return themeColors.warning;
  };

  // Calcular USD mostrado: si hay USD real, mostrarlo; si no, estimar desde BS
  const displayedUSD = balance.balanceUSD > 0
    ? balance.balanceUSD
    : (balance.balanceBS > 0 && getActiveRate()
        ? balance.balanceBS / getActiveRate()!
        : 0);

  if (!account) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="sad-outline" size={48} color={themeColors.textSecondary} />
          <Text style={{ fontSize: 16, color: themeColors.textSecondary, marginTop: 12 }}>
            Cuenta no encontrada
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 16,
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{
          backgroundColor: account.color,
          paddingHorizontal: isSmall ? 14 : 20,
          paddingTop: isSmall ? 14 : 20,
          paddingBottom: isSmall ? 24 : 32,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}>
          {/* Back + Edit + Delete */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: isSmall ? 34 : 40,
                height: isSmall ? 34 : 40,
                borderRadius: isSmall ? 17 : 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  setEditName(account?.name || '');
                  setShowEditModal(true);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Icon + Name */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>{account.icon}</Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 4 }}>
              {account.name}
            </Text>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}>
              <Text style={{ fontSize: 13, color: '#FFF', fontWeight: '500' }}>
                {typeLabels[account.type] || account.type}
              </Text>
            </View>
          </View>
        </View>

        {/* Balance Cards - orden según moneda principal */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: -20 }}>
          {balance.balanceUSD > 0 ? (
            /* Primero USD, segundo BS (o estimado si no tiene BS) */
            <>
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Text style={{ fontSize: 13, color: themeColors.usd, fontWeight: '600', marginBottom: 4 }}>
                  Saldo USD
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>
                  {formatUSD(balance.balanceUSD)}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Text style={{ fontSize: 13, color: themeColors.bs, fontWeight: '600', marginBottom: 4 }}>
                  {balance.balanceBS > 0 ? 'Saldo Bs' : 'Bs estimado'}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>
                  {balance.balanceBS > 0
                    ? formatBS(balance.balanceBS)
                    : `≈ ${formatBS(balance.balanceUSD * (getActiveRate() ?? 1))}`}
                </Text>
              </View>
            </>
          ) : (
            /* Primero BS, segundo USD (estimado) */
            <>
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Text style={{ fontSize: 13, color: themeColors.bs, fontWeight: '600', marginBottom: 4 }}>
                  Saldo Bs
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>
                  {formatBS(balance.balanceBS)}
                </Text>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 3,
              }}>
                <Text style={{ fontSize: 13, color: themeColors.usd, fontWeight: '600', marginBottom: 4 }}>
                  USD estimado
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>
                  {formatUSD(displayedUSD)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 }}>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(tabs)/transactions',
              params: { presetAccountId: accountId, presetType: 'expense' },
            })}
            style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          >
            <Ionicons name="arrow-up-circle" size={28} color={themeColors.danger} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text, marginTop: 6 }}>
              Gastar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(tabs)/transactions',
              params: { presetAccountId: accountId, presetType: 'income' },
            })}
            style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          >
            <Ionicons name="arrow-down-circle" size={28} color={themeColors.success} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text, marginTop: 6 }}>
              Ingresar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(tabs)/transactions',
              params: { presetAccountId: accountId, presetType: 'transfer' },
            })}
            style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          >
            <Ionicons name="swap-horizontal" size={28} color={themeColors.warning} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.text, marginTop: 6 }}>
              Transferir
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transacciones Recientes */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: themeColors.text, marginBottom: 16 }}>
            Movimientos
          </Text>
          {transactions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="receipt-outline" size={48} color={themeColors.textSecondary} />
              <Text style={{ fontSize: 14, color: themeColors.textSecondary, marginTop: 12 }}>
                Sin movimientos aún
              </Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View
                key={tx.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: themeColors.border,
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: getTransactionColor(tx) + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name={getTransactionIcon(tx)} size={20} color={getTransactionColor(tx)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: themeColors.text }}>
                    {tx.description || 'Sin descripción'}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {formatDate(tx.createdAt)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {(tx.amountUSD ?? 0) > 0 && (
                    <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                      {tx.type === 'income' ? '+' : '-'}{formatUSD(tx.amountUSD)}
                    </Text>
                  )}
                  {(tx.amountBS ?? 0) > 0 && (
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                      {tx.type === 'income' ? '+' : '-'}{formatBS(tx.amountBS)}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal para editar nombre */}
      {showEditModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 340,
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '700',
              color: themeColors.text,
              marginBottom: 16,
            }}>
              Editar nombre
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nuevo nombre"
              placeholderTextColor={themeColors.textSecondary}
              autoFocus
              style={{
                backgroundColor: themeColors.background,
                borderRadius: 12,
                padding: 14,
                fontSize: 15,
                color: themeColors.text,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: themeColors.border,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: themeColors.surface,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!editName.trim()) return;
                  try {
                    await updateAccount(accountId, { name: editName.trim() });
                    await loadData();
                    setShowEditModal(false);
                    Alert.alert('✅ Listo', 'Nombre actualizado correctamente');
                  } catch (error: any) {
                    Alert.alert('Error', error?.message || 'No se pudo actualizar');
                  }
                }}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: themeColors.primary,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFF' }}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
