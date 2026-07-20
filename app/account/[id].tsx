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
import GlassCard from '../../src/components/GlassCard';
import type { Transaction, AccountType, CurrencyType } from '../../src/utils/types';

const typeLabels: Record<string, string> = {
  exchange: 'Digital',
  bank: 'Corriente',
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

  const displayedUSD = balance.balanceUSD > 0
    ? balance.balanceUSD
    : (balance.balanceBS > 0 && getActiveRate()
        ? balance.balanceBS / getActiveRate()!
        : 0);


  const inputStyle = {
    backgroundColor: themeColors.surfaceContainer,
    borderWidth: 1,
    borderColor: themeColors.outlineVariant + '50',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: themeColors.text,
  };

  if (!account) {
    return (
      <AnimatedScreen>
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: themeColors.primaryContainer,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <Ionicons name="sad-outline" size={40} color={themeColors.secondary} />
            </View>
            <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 12 }}>
              Cuenta no encontrada
            </ThemedText>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginTop: 20,
                backgroundColor: themeColors.secondary,
                borderRadius: 12,
                paddingHorizontal: 24,
                paddingVertical: 12,
                shadowColor: themeColors.secondary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <ThemedText type="button" color={themeColors.text} style={{ fontWeight: '600' }}>
                Volver
              </ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AnimatedScreen>
    );
  }

  return (
    <AnimatedScreen>
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        {/* Ambient Glows */}
        <View
          style={{
            position: 'absolute',
            top: -60,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: themeColors.secondary + '25',
            shadowColor: themeColors.secondary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 60,
            elevation: 0,
          }}
          pointerEvents="none"
        />
        <View
          style={{
            position: 'absolute',
            bottom: -40,
            left: -40,
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: themeColors.primary + '20',
            shadowColor: themeColors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 50,
            elevation: 0,
          }}
          pointerEvents="none"
        />

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Header */}
          <View style={{
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: 8,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.surfaceContainer + '99',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
              }}
            >
              <Ionicons name="arrow-back" size={20} color={themeColors.text} />
            </TouchableOpacity>
            <ThemedText type="h1" themeColor="text" style={{ fontSize: 20, fontWeight: '600' }}>
              {account.name}
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Balance Card */}
          <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 24 }}>
            <GlassCard padding={20} style={{ position: 'relative', overflow: 'hidden' }}>
              {/* Glow effects */}
              <View
                style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: themeColors.secondary + '20',
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.35,
                  shadowRadius: 50,
                  elevation: 0,
                }}
                pointerEvents="none"
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: -40,
                  left: -40,
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: themeColors.primary + '18',
                  shadowColor: themeColors.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.25,
                  shadowRadius: 45,
                  elevation: 0,
                }}
                pointerEvents="none"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: themeColors.surfaceVariant,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.outline + '20',
                }}>
                  <Ionicons
                    name={account.icon === '💰' ? 'wallet-outline' :
                          account.icon === '🏦' ? 'business-outline' :
                          account.icon === '💳' ? 'card-outline' :
                          account.icon === '💵' ? 'cash-outline' :
                          account.icon === '🌐' ? 'globe-outline' :
                          account.icon === '🐷' ? 'save-outline' :
                          account.icon === '🏠' ? 'home-outline' :
                          account.icon === '📱' ? 'phone-portrait-outline' :
                          account.icon === '💼' ? 'briefcase-outline' :
                          account.icon === '⭐' ? 'star-outline' : 'wallet-outline'}
                    size={24}
                    color={themeColors.secondary}
                  />
                </View>
                <View>
                  <ThemedText
                    type="caption"
                    themeColor="onSurfaceVariant"
                    style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' }}
                  >
                    Balance Actual
                  </ThemedText>
                  <ThemedText
                    type="amountLarge"
                    themeColor="text"
                    style={{ fontSize: 28, fontWeight: '700' }}
                  >
                    {formatUSD(displayedUSD)}
                  </ThemedText>
                </View>
              </View>

              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                borderTopWidth: 1,
                borderTopColor: themeColors.outline + '10',
                paddingTop: 12,
              }}>
                <View>
                  <ThemedText
                    type="caption"
                    themeColor="onSurfaceVariant"
                    style={{ fontSize: 11 }}
                  >
                    Tipo
                  </ThemedText>
                  <ThemedText
                    type="body"
                    themeColor="text"
                    style={{ fontSize: 14, fontWeight: '500' }}
                  >
                    {typeLabels[account.type] || account.type}
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <ThemedText
                    type="caption"
                    themeColor="onSurfaceVariant"
                    style={{ fontSize: 11 }}
                  >
                    Moneda
                  </ThemedText>
                  <ThemedText
                    type="body"
                    themeColor="text"
                    style={{ fontSize: 14, fontWeight: '500' }}
                  >
                    {account.currency === 'BOTH' ? 'USD / BS' : account.currency}
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Action Buttons */}
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: '/(tabs)/transactions',
                  params: { presetAccountId: accountId, presetType: 'expense' },
                })}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: themeColors.danger + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Ionicons name="arrow-up-circle" size={22} color={themeColors.danger} />
                </View>
                <ThemedText type="buttonSmall" themeColor="text" style={{ fontSize: 12 }}>
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
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: themeColors.success + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Ionicons name="arrow-down-circle" size={22} color={themeColors.success} />
                </View>
                <ThemedText type="buttonSmall" themeColor="text" style={{ fontSize: 12 }}>
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
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: themeColors.warning + '20',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                  <Ionicons name="swap-horizontal" size={22} color={themeColors.warning} />
                </View>
                <ThemedText type="buttonSmall" themeColor="text" style={{ fontSize: 12 }}>
                  Transferir
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Details */}
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <GlassCard padding={16}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  Detalle de Saldos
                </ThemedText>
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
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: themeColors.secondary + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="pencil" size={18} color={themeColors.secondary} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer + '60',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '20',
                }}>
                  <ThemedText type="caption" themeColor="usd" style={{ fontWeight: '600', marginBottom: 4, fontSize: 11 }}>
                    Saldo USD
                  </ThemedText>
                  <ThemedText type="bodyMedium" themeColor="text" style={{ fontSize: 18, fontWeight: '700' }}>
                    {formatUSD(balance.balanceUSD)}
                  </ThemedText>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer + '60',
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '20',
                }}>
                  <ThemedText type="caption" themeColor="bs" style={{ fontWeight: '600', marginBottom: 4, fontSize: 11 }}>
                    {balance.balanceBS > 0 ? 'Saldo Bs' : 'Bs estimado'}
                  </ThemedText>
                  <ThemedText type="bodyMedium" themeColor="text" style={{ fontSize: 18, fontWeight: '700' }}>
                    {balance.balanceBS > 0
                      ? formatBS(balance.balanceBS)
                      : `≈ ${formatBS(balance.balanceUSD * (getActiveRate() ?? 1))}`}
                  </ThemedText>
                </View>
              </View>
            </GlassCard>
          </View>

          {/* Recent Transactions */}
          <View style={{ paddingHorizontal: 24 }}>
            <ThemedText
              type="h3"
              themeColor="text"
              style={{ marginBottom: 16, fontSize: 18, fontWeight: '600' }}
            >
              Movimientos
            </ThemedText>
            {transactions.length === 0 ? (
              <GlassCard padding={32} style={{ alignItems: 'center' }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: themeColors.primaryContainer,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="receipt-outline" size={28} color={themeColors.secondary} />
                </View>
                <ThemedText type="body" themeColor="textSecondary">
                  Sin movimientos aún
                </ThemedText>
              </GlassCard>
            ) : (
              <GlassCard padding={12}>
                {transactions.map((tx, index) => (
                  <View
                    key={tx.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderBottomWidth: index < transactions.length - 1 ? 1 : 0,
                      borderBottomColor: themeColors.outlineVariant + '20',
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
                      <ThemedText type="body" themeColor="text" style={{ fontSize: 14 }}>
                        {tx.description || 'Sin descripción'}
                      </ThemedText>
                      <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2, fontSize: 11 }}>
                        {formatDate(tx.createdAt)}
                      </ThemedText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {(tx.amountUSD ?? 0) > 0 && (
                        <ThemedText
                          type="bodyMedium"
                          color={tx.type === 'income' ? themeColors.success : themeColors.danger}
                          style={{ fontSize: 14, fontWeight: '600' }}
                        >
                          {tx.type === 'income' ? '+' : '-'}{formatUSD(tx.amountUSD)}
                        </ThemedText>
                      )}
                      {(tx.amountBS ?? 0) > 0 && (
                        <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                          {tx.type === 'income' ? '+' : '-'}{formatBS(tx.amountBS)}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                ))}
              </GlassCard>
            )}
          </View>
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
            >
              <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                {/* Modal Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                  <ThemedText type="h1" themeColor="text" style={{ fontSize: 22 }}>
                    Editar Cuenta
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: themeColors.surfaceContainer + '99',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '30',
                    }}
                  >
                    <Ionicons name="close" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Account Name */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
                  Nombre de la Cuenta
                </ThemedText>
                <View style={[inputStyle, { borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 20 }]}>
                  <Ionicons name="pencil" size={16} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Nombre de la cuenta"
                    placeholderTextColor={themeColors.textSecondary + '80'}
                    style={{ flex: 1, fontSize: 15, color: themeColors.text, padding: 0 }}
                  />
                </View>

                {/* Account Type */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
                  Tipo de Cuenta
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
                        backgroundColor: editType === t.key ? themeColors.secondary + '20' : themeColors.surfaceContainer,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderWidth: 1,
                        borderColor: editType === t.key ? themeColors.secondary : themeColors.outlineVariant + '50',
                      }}
                    >
                      <ThemedText style={{ fontSize: 16 }}>{t.icon}</ThemedText>
                      <ThemedText
                        type="body"
                        color={editType === t.key ? themeColors.secondary : themeColors.text}
                        style={{ fontWeight: editType === t.key ? '600' : '400' }}
                      >
                        {t.label}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Currency */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
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
                        backgroundColor: editCurrency === cur ? themeColors.secondary + '20' : themeColors.surfaceContainer,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: editCurrency === cur ? themeColors.secondary : themeColors.outlineVariant + '50',
                      }}
                    >
                      <ThemedText
                        type="bodyMedium"
                        color={editCurrency === cur ? themeColors.secondary : themeColors.text}
                        style={{ fontWeight: editCurrency === cur ? '600' : '400' }}
                      >
                        {cur === 'USD' ? 'USD' : cur === 'BS' ? 'BS' : 'Ambas'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Platform */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
                  Plataforma (opcional)
                </ThemedText>
                <TextInput
                  value={editPlatform}
                  onChangeText={setEditPlatform}
                  placeholder="Ej: Binance, Facebank..."
                  placeholderTextColor={themeColors.textSecondary + '80'}
                  style={[inputStyle, { borderRadius: 12, marginBottom: 20 }]}
                />

                {/* Icon */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
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
                        backgroundColor: editIcon === ic ? themeColors.secondary + '20' : themeColors.surfaceContainer,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: editIcon === ic ? themeColors.secondary : themeColors.outlineVariant + '50',
                      }}
                    >
                      <ThemedText style={{ fontSize: 22 }}>{ic}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Color */}
                <ThemedText
                  type="caption"
                  themeColor="onSurfaceVariant"
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    fontWeight: '600',
                  }}
                >
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
                        borderRadius: 22,
                        backgroundColor: c.hex,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: editColor === c.hex ? 3 : 0,
                        borderColor: themeColors.secondary,
                        shadowColor: editColor === c.hex ? themeColors.secondary : 'transparent',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: editColor === c.hex ? 0.5 : 0,
                        shadowRadius: 8,
                        elevation: editColor === c.hex ? 6 : 0,
                      }}
                    >
                      {editColor === c.hex && (
                        <Ionicons name="checkmark" size={22} color="#FFF" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Save Button */}
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
                    backgroundColor: themeColors.secondary,
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    shadowColor: themeColors.secondary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                    elevation: 8,
                    marginBottom: 16,
                  }}
                >
                  <ThemedText
                    type="button"
                    color={themeColors.text}
                    style={{ fontSize: 16, fontWeight: '600' }}
                  >
                    Guardar Cambios
                  </ThemedText>
                </TouchableOpacity>

                {/* Delete Button */}
                <TouchableOpacity
                  onPress={() => {
                    setShowEditModal(false);
                    setTimeout(() => handleDelete(), 300);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    borderRadius: 14,
                    padding: 16,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: themeColors.danger,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                    <ThemedText
                      type="button"
                      color={themeColors.danger}
                      style={{ fontSize: 15, fontWeight: '600' }}
                    >
                      Eliminar Cuenta
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </AnimatedScreen>
  );
}
