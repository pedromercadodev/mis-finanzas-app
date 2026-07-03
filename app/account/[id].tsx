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
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, accountColors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useAccounts } from '../../src/store/useAccounts';
import { useTransactions } from '../../src/store/useTransactions';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance } from '../../src/services/accounts';
import { formatUSD, formatBS, formatDate } from '../../src/utils/format';
import AnimatedScreen from '../../src/components/AnimatedScreen';
import type { Transaction, AccountType, CurrencyType } from '../../src/utils/types';

const typeLabels: Record<string, string> = {
  exchange: 'Exchange',
  bank: 'Banco',
  virtual_card: 'Tarjeta Virtual',
  cash: 'Efectivo',
  other: 'Otra',
};

const accountTypes: { key: AccountType; label: string; icon: string }[] = [
  { key: 'exchange', label: 'Exchange', icon: '💰' },
  { key: 'bank', label: 'Banco', icon: '🏦' },
  { key: 'virtual_card', label: 'Tarjeta Virtual', icon: '💳' },
  { key: 'cash', label: 'Efectivo', icon: '💵' },
  { key: 'other', label: 'Otra', icon: '📦' },
];

const accountIcons = [
  '💰', '🏦', '💳', '💵', '📱', '🌐', '🏧', '🎯',
  '💼', '📊', '🪙', '💎', '🏠', '🚗', '✈️', '🎓',
  '🛒', '🍔', '🎮', '👕', '💊', '🐕', '🎵', '📸',
];

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeColors = useThemeColors();
  const accountId = parseInt(id, 10);

  const { accounts, loadAccounts, removeAccount } = useAccounts();
  const { transactions, loadTransactions } = useTransactions();
  const { preferredRateType } = useSettings();
  const { bcv, parallel } = useExchangeRates();

  const [balance, setBalance] = useState({ balanceUSD: 0, balanceBS: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('bank');
  const [editCurrency, setEditCurrency] = useState<CurrencyType>('BOTH');
  const [editIcon, setEditIcon] = useState('💰');
  const [editColor, setEditColor] = useState('#4A90D9');
  const [editPlatform, setEditPlatform] = useState('');

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
      <AnimatedScreen>
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
    </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{
          backgroundColor: account.color,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 32,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}>
          {/* Back + Edit + Delete */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
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
                  setEditType(account?.type || 'bank');
                  setEditCurrency(account?.currency || 'BOTH');
                  setEditIcon(account?.icon || '💰');
                  setEditColor(account?.color || '#4A90D9');
                  setEditPlatform(account?.platform || '');
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

      {/* Modal para editar cuenta */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                  Editar Cuenta
                </Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Nombre
              </Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Nombre de la cuenta"
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: themeColors.text,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />

              {/* Tipo */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Tipo de cuenta
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {accountTypes.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setEditType(t.key)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: editType === t.key ? themeColors.primary : themeColors.surface,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: editType === t.key ? themeColors.primary : themeColors.border,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '500',
                      color: editType === t.key ? '#FFF' : themeColors.text,
                    }}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Moneda */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Moneda
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    onPress={() => setEditCurrency(cur)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: editCurrency === cur ? themeColors.primary : themeColors.surface,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: editCurrency === cur ? themeColors.primary : themeColors.border,
                    }}
                  >
                    <Text style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: editCurrency === cur ? '#FFF' : themeColors.text,
                    }}>
                      {cur === 'USD' ? '💰 USD' : cur === 'BS' ? '💵 BS' : '🔀 Ambas'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Plataforma */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Plataforma (opcional)
              </Text>
              <TextInput
                value={editPlatform}
                onChangeText={setEditPlatform}
                placeholder="Ej: Binance, Facebank..."
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: themeColors.text,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />

              {/* Icono */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Icono
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {accountIcons.map((ic, index) => (
                  <TouchableOpacity
                    key={`edit-icon-${index}`}
                    onPress={() => setEditIcon(ic)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: editIcon === ic ? themeColors.primaryLight : themeColors.surface,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: editIcon === ic ? themeColors.primary : themeColors.border,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Color
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {accountColors.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setEditColor(c.hex)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: c.hex,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: editColor === c.hex ? 3 : 0,
                      borderColor: themeColors.surface,
                    }}
                  >
                    {editColor === c.hex && (
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Guardar */}
              <TouchableOpacity
                onPress={async () => {
                  if (!editName.trim()) {
                    Alert.alert('Error', 'El nombre es requerido');
                    return;
                  }
                  try {
                    await updateAccount(accountId, {
                      name: editName.trim(),
                      type: editType,
                      currency: editCurrency,
                      icon: editIcon,
                      color: editColor,
                      platform: editPlatform.trim() || null,
                    });
                    await loadData();
                    setShowEditModal(false);
                    Alert.alert('✅ Listo', 'Cuenta actualizada correctamente');
                  } catch (error: any) {
                    Alert.alert('Error', error?.message || 'No se pudo actualizar');
                  }
                }}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>
                  Guardar Cambios
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </AnimatedScreen>
  );
}
