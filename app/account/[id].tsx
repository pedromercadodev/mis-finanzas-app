import { useCallback, useState } from 'react';
import { updateAccount } from '../../src/services/accounts';
import {
  View,
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
import { accountColors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useAccounts } from '../../src/store/useAccounts';
import { useTransactions } from '../../src/store/useTransactions';
import { useSettings } from '../../src/store/useSettings';
import { getAccountBalance } from '../../src/services/accounts';
import { formatUSD, formatBS, formatDate } from '../../src/utils/format';
import AnimatedScreen from '../../src/components/AnimatedScreen';
import ThemedText from '../../src/components/ThemedText';
import { shadows } from '../../src/theme/shadows';
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
          <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 12 }}>
            Cuenta no encontrada
          </ThemedText>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 16,
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
            accessibilityLabel="Volver"
          >
            <ThemedText type="button" style={{ color: '#FFF' }}>Volver</ThemedText>
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
              accessibilityLabel="Volver"
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
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                accessibilityLabel="Editar cuenta"
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                accessibilityLabel="Eliminar cuenta"
              >
                <Ionicons name="trash-outline" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Icon + Name */}
          <View style={{ alignItems: 'center' }}>
            <ThemedText style={{ fontSize: 48, marginBottom: 12 }}>{account.icon}</ThemedText>
            <ThemedText style={{ fontSize: 24, fontWeight: '700', color: '#FFF', marginBottom: 4 }}>
              {account.name}
            </ThemedText>
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}>
              <ThemedText style={{ fontSize: 13, color: '#FFF', fontWeight: '500' }}>
                {typeLabels[account.type] || account.type}
              </ThemedText>
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
                ...shadows.md,
              }}>
                <ThemedText type="caption" themeColor="usd" style={{ fontWeight: '600', marginBottom: 4 }}>
                  Saldo USD
                </ThemedText>
                <ThemedText type="amountLarge" themeColor="text">
                  {formatUSD(balance.balanceUSD)}
                </ThemedText>
              </View>
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surface,
                borderRadius: 20,
                padding: 20,
                ...shadows.md,
              }}>
                <ThemedText type="caption" themeColor="bs" style={{ fontWeight: '600', marginBottom: 4 }}>
                  {balance.balanceBS > 0 ? 'Saldo Bs' : 'Bs estimado'}
                </ThemedText>
                <ThemedText type="amountLarge" themeColor="text">
                  {balance.balanceBS > 0
                    ? formatBS(balance.balanceBS)
                    : `≈ ${formatBS(balance.balanceUSD * (getActiveRate() ?? 1))}`}
                </ThemedText>
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
                  ...shadows.md,
                }}>
                  <ThemedText type="caption" themeColor="bs" style={{ fontWeight: '600', marginBottom: 4 }}>
                    Saldo Bs
                  </ThemedText>
                  <ThemedText type="amountLarge" themeColor="text">
                    {formatBS(balance.balanceBS)}
                  </ThemedText>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: themeColors.surface,
                  borderRadius: 20,
                  padding: 20,
                  ...shadows.md,
                }}>
                  <ThemedText type="caption" themeColor="usd" style={{ fontWeight: '600', marginBottom: 4 }}>
                    USD estimado
                  </ThemedText>
                  <ThemedText type="amountLarge" themeColor="text">
                    {formatUSD(displayedUSD)}
                  </ThemedText>
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
            accessibilityLabel="Registrar gasto"
          >
            <Ionicons name="arrow-up-circle" size={28} color={themeColors.danger} />
            <ThemedText type="buttonSmall" themeColor="text" style={{ marginTop: 6 }}>
              Gastar
            </ThemedText>
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
            accessibilityLabel="Registrar ingreso"
          >
            <Ionicons name="arrow-down-circle" size={28} color={themeColors.success} />
            <ThemedText type="buttonSmall" themeColor="text" style={{ marginTop: 6 }}>
              Ingresar
            </ThemedText>
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
            accessibilityLabel="Registrar transferencia"
          >
            <Ionicons name="swap-horizontal" size={28} color={themeColors.warning} />
            <ThemedText type="buttonSmall" themeColor="text" style={{ marginTop: 6 }}>
              Transferir
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Transacciones Recientes */}
        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <ThemedText type="h3" themeColor="text" style={{ marginBottom: 16 }}>
            Movimientos
          </ThemedText>
          {transactions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="receipt-outline" size={48} color={themeColors.textSecondary} />
              <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 12 }}>
                Sin movimientos aún
              </ThemedText>
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
                  <ThemedText type="body" themeColor="text">
                    {tx.description || 'Sin descripción'}
                  </ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 2 }}>
                    {formatDate(tx.createdAt)}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {(tx.amountUSD ?? 0) > 0 && (
                    <ThemedText type="bodyMedium" themeColor="text">
                      {tx.type === 'income' ? '+' : '-'}{formatUSD(tx.amountUSD)}
                    </ThemedText>
                  )}
                  {(tx.amountBS ?? 0) > 0 && (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {tx.type === 'income' ? '+' : '-'}{formatBS(tx.amountBS)}
                    </ThemedText>
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
                <ThemedText type="h2" themeColor="text">
                  Editar Cuenta
                </ThemedText>
                <TouchableOpacity onPress={() => setShowEditModal(false)} accessibilityLabel="Cerrar modal de edición">
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Nombre
              </ThemedText>
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
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Tipo de cuenta
              </ThemedText>
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
                    accessibilityLabel={`Tipo de cuenta ${t.label}`}
                  >
                    <ThemedText style={{ fontSize: 16 }}>{t.icon}</ThemedText>
                    <ThemedText type="body" color={editType === t.key ? '#FFF' : themeColors.text}>
                      {t.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Moneda */}
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Moneda
              </ThemedText>
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
                    accessibilityLabel={`Moneda ${cur === 'USD' ? 'USD' : cur === 'BS' ? 'Bolívares' : 'Ambas'}`}
                  >
                    <ThemedText type="bodyMedium" color={editCurrency === cur ? '#FFF' : themeColors.text}>
                      {cur === 'USD' ? 'USD' : cur === 'BS' ? 'BS' : 'Ambas'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Plataforma */}
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Plataforma (opcional)
              </ThemedText>
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
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Icono
              </ThemedText>
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
                    accessibilityLabel={`Seleccionar icono`}
                  >
                    <ThemedText style={{ fontSize: 22 }}>{ic}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Color
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {accountColors.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setEditColor(c.hex)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: c.hex,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: editColor === c.hex ? 3 : 0,
                      borderColor: themeColors.surface,
                    }}
                    accessibilityLabel={`Seleccionar color`}
                  >
                    {editColor === c.hex && (
                      <Ionicons name="checkmark" size={22} color="#FFF" />
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
                accessibilityLabel="Guardar cambios de cuenta"
              >
                <ThemedText type="button" style={{ color: '#FFF' }}>
                  Guardar Cambios
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </AnimatedScreen>
  );
}
