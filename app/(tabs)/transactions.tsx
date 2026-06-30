import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAccounts } from '../../src/store/useAccounts';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { useTransactions } from '../../src/store/useTransactions';
import { getCategories } from '../../src/services/categories';
import { getLatestRate } from '../../src/services/exchangeRate';
import { getPeriodSummary } from '../../src/services/transactions';
import { formatUSD, formatBS, formatDateShort, getCurrentMonthRange } from '../../src/utils/format';
import type { Category, TransactionType } from '../../src/utils/types';

type PeriodFilter = 'today' | 'week' | 'month' | 'year';

function getPeriodDates(filter: PeriodFilter): { start: string; end: string; label: string } {
  const now = new Date();
  // Ajustar a hora local de Venezuela (UTC-4)
  const localDate = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const todayStr = localDate.toISOString().split('T')[0];

  switch (filter) {
    case 'today': {
      return { start: todayStr, end: todayStr, label: 'Hoy' };
    }
    case 'week': {
      // Encontrar el lunes de esta semana
      const dayOfWeek = localDate.getUTCDay(); // 0=domingo, 1=lunes...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // días desde lunes
      const monday = new Date(localDate);
      monday.setUTCDate(localDate.getUTCDate() - diffToMonday);
      const mondayStr = monday.toISOString().split('T')[0];
      return { start: mondayStr, end: todayStr, label: 'Esta Semana' };
    }
    case 'month': {
      const firstDay = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth(), 1));
      const firstDayStr = firstDay.toISOString().split('T')[0];
      return { start: firstDayStr, end: todayStr, label: 'Este Mes' };
    }
    case 'year': {
      const firstDayYear = new Date(Date.UTC(localDate.getUTCFullYear(), 0, 1));
      const firstDayYearStr = firstDayYear.toISOString().split('T')[0];
      return { start: firstDayYearStr, end: todayStr, label: 'Este Año' };
    }
  }
}

export default function TransactionsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
  const gap = isSmall ? 8 : 12;
  const pad = isSmall ? 12 : 14;
  const params = useLocalSearchParams<{ presetAccountId?: string; presetType?: string }>();
  const themeColors = useThemeColors();
  const { accounts, loadAccounts } = useAccounts();
  const { transactions, loadTransactions, addTransaction, removeTransaction } = useTransactions();
  const { preferredRateType, manualRate } = useSettings();
  const {
    bcv: bcvRate,
    parallel: parallelRate,
  } = useExchangeRates();
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Period filter state
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [periodSummary, setPeriodSummary] = useState({ incomeUSD: 0, incomeBS: 0, expenseUSD: 0, expenseBS: 0 });

  // Form state
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [amountBS, setAmountBS] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  // Obtener la tasa activa según preferencia del usuario
  const getActiveRate = (): number | null => {
    if (manualRate) return manualRate;
    if (preferredRateType === 'BCV') {
      return bcvRate?.rateUSDToBS ?? null;
    }
    return parallelRate?.rateUSDToBS ?? null;
  };

  const loadData = async (filter?: PeriodFilter) => {
    const activeFilter = filter || periodFilter;
    await loadAccounts();
    const { start, end } = getPeriodDates(activeFilter);
    // Cargar transacciones del período seleccionado
    await loadTransactions({});
    // Filtrar localmente por rango de fechas
    const cats = await getCategories();
    setCategories(cats);
    const rate = await getLatestRate();
    if (rate) setExchangeRate(rate.rateUSDToBS);

    // Obtener resumen del período
    const summary = await getPeriodSummary(start, end);
    setPeriodSummary(summary);
  };

  // Recargar datos cada vez que la pantalla obtiene foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Apply preset params when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0) {
      // Preset account from URL params
      if (params.presetAccountId) {
        const presetId = parseInt(params.presetAccountId, 10);
        if (accounts.find((a) => a.id === presetId)) {
          setSelectedAccountId(presetId);
        }
      } else if (!selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }

      // Preset type from URL params
      if (params.presetType === 'expense' || params.presetType === 'income' || params.presetType === 'transfer') {
        setTxType(params.presetType as TransactionType);
      }
    }
  }, [accounts, params.presetAccountId, params.presetType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFilterChange = async (filter: PeriodFilter) => {
    setPeriodFilter(filter);
    const { start, end } = getPeriodDates(filter);
    const summary = await getPeriodSummary(start, end);
    setPeriodSummary(summary);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Error', 'La descripción es requerida');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('Error', 'Selecciona una cuenta');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Selecciona una categoría');
      return;
    }

    const usd = amountUSD ? parseFloat(amountUSD) : null;
    const bs = amountBS ? parseFloat(amountBS) : null;

    if (!usd && !bs) {
      Alert.alert('Error', 'Ingresa al menos un monto en USD o Bs');
      return;
    }

    await addTransaction({
      type: txType,
      description: description.trim(),
      amountUSD: usd,
      amountBS: bs,
      currency: usd && bs ? 'BOTH' : usd ? 'USD' : 'BS',
      exchangeRate,
      accountId: selectedAccountId,
      transferToAccountId: null,
      categoryId: selectedCategoryId,
      date: txDate,
      notes: null,
    });

    setShowModal(false);
    setDescription('');
    setAmountUSD('');
    setAmountBS('');
    setTxType('expense');
    await loadData();
    showToast('✅ Transacción guardada');
  };

  const handleDelete = (id: number) => {
    Alert.alert('Eliminar', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await removeTransaction(id);
        showToast('🗑️ Transacción eliminada');
      }},
    ]);
  };

  const openNewModal = () => {
    // Reset form and apply presets
    if (params.presetAccountId) {
      const presetId = parseInt(params.presetAccountId, 10);
      if (accounts.find((a) => a.id === presetId)) {
        setSelectedAccountId(presetId);
      }
    }
    if (params.presetType === 'expense' || params.presetType === 'income' || params.presetType === 'transfer') {
      setTxType(params.presetType as TransactionType);
    }
    setShowModal(true);
  };

  const canTransfer = accounts.length >= 2;

  // Filtrar transacciones por el rango de fechas del período activo
  const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);
  const filteredTransactions = transactions.filter((tx) => {
    return tx.date >= periodStart && tx.date <= periodEnd;
  });

  const periodFilters: { key: PeriodFilter; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'year', label: 'Año' },
  ];

  return (
    <AnimatedTransition>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text }}>
            Movimientos
          </Text>
        </View>

        {/* Filtros de Período */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {periodFilters.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => handleFilterChange(f.key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: periodFilter === f.key ? themeColors.primary : themeColors.surface,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: periodFilter === f.key ? themeColors.primary : themeColors.border,
              }}
            >
              <Text style={{
                color: periodFilter === f.key ? '#FFF' : themeColors.text,
                fontWeight: '600',
                fontSize: 13,
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Resumen del Período */}
        {(() => {
          const rate = getActiveRate();
          const totalIncomeUSD = periodSummary.incomeUSD + (rate ? periodSummary.incomeBS / rate : 0);
          const totalIncomeBS = periodSummary.incomeBS + (periodSummary.incomeUSD * (rate || 0));
          const totalExpenseUSD = periodSummary.expenseUSD + (rate ? periodSummary.expenseBS / rate : 0);
          const totalExpenseBS = periodSummary.expenseBS + (periodSummary.expenseUSD * (rate || 0));
          const netUSD = totalIncomeUSD - totalExpenseUSD;
          const netBS = totalIncomeBS - totalExpenseBS;
          return (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.successLight,
              borderRadius: 14,
              padding: 14,
            }}>
              <Text style={{ fontSize: 11, color: themeColors.success, fontWeight: '500', marginBottom: 4 }}>
                Ingresos
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.success }}>
                {formatUSD(totalIncomeUSD)}
              </Text>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                {formatBS(totalIncomeBS)}
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.dangerLight,
              borderRadius: 14,
              padding: 14,
            }}>
              <Text style={{ fontSize: 11, color: themeColors.danger, fontWeight: '500', marginBottom: 4 }}>
                Gastos
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.danger }}>
                {formatUSD(totalExpenseUSD)}
              </Text>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                {formatBS(totalExpenseBS)}
              </Text>
            </View>
            {/* Balance Neto */}
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, fontWeight: '500', marginBottom: 4 }}>
                Balance
              </Text>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: netUSD >= 0 ? themeColors.success : themeColors.danger,
              }}>
                {formatUSD(netUSD)}
              </Text>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                {formatBS(netBS)}
              </Text>
            </View>
          </View>
          );
        })()}

        {/* Lista de Transacciones */}
        {filteredTransactions.map((tx) => {
          const account = accounts.find((a) => a.id === tx.accountId);
          const category = categories.find((c) => c.id === tx.categoryId);
          return (
            <TouchableOpacity
              key={tx.id}
              onLongPress={() => handleDelete(tx.id)}
              style={{
                backgroundColor: themeColors.surface,
                borderRadius: 14,
                padding: 16,
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
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: tx.type === 'income' ? themeColors.successLight : themeColors.dangerLight,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 14,
              }}>
                <Text style={{ fontSize: 20 }}>{category?.icon || '📦'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                  {tx.description}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                    {account?.icon} {account?.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>·</Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                    {formatDateShort(tx.date)}
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {tx.amountUSD && (
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
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
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openNewModal}
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

      {/* Toast Notification */}
      {toastVisible && (
        <View style={{
          position: 'absolute',
          bottom: 180,
          left: 20,
          right: 20,
          backgroundColor: themeColors.text,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Modal Nueva Transacción */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: themeColors.text }}>
                  Nueva Transacción
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Tipo */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {(['expense', 'income', 'transfer'] as TransactionType[]).map((type) => {
                  const isDisabled = type === 'transfer' && !canTransfer;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        if (isDisabled) {
                          Alert.alert('Transferencia', 'Necesitas al menos 2 cuentas para transferir');
                          return;
                        }
                        setTxType(type);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: txType === type ? themeColors.primary : themeColors.surface,
                        alignItems: 'center',
                        opacity: isDisabled ? 0.4 : 1,
                      }}
                    >
                      <Text style={{
                        color: txType === type ? '#FFF' : themeColors.text,
                        fontWeight: '600',
                        fontSize: 13,
                      }}>
                        {type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Transf.'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Cuenta */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Cuenta
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selectedAccountId === account.id ? account.color + '20' : themeColors.surface,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: selectedAccountId === account.id ? account.color : themeColors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{account.icon}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: themeColors.text }}>
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Descripción */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Descripción
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Ej: Gasté 20$ en almuerzo..."
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />

              {/* Montos */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.usd, marginBottom: 8 }}>
                    Monto en USD
                  </Text>
                  <TextInput
                    value={amountUSD}
                    onChangeText={setAmountUSD}
                    placeholder="0.00"
                    placeholderTextColor={themeColors.textSecondary}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: themeColors.surface,
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 18,
                      fontWeight: '600',
                      color: themeColors.usd,
                      borderWidth: 1,
                      borderColor: themeColors.border,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.bs, marginBottom: 8 }}>
                    Monto en Bs
                  </Text>
                  <TextInput
                    value={amountBS}
                    onChangeText={setAmountBS}
                    placeholder="0.00"
                    placeholderTextColor={themeColors.textSecondary}
                    keyboardType="decimal-pad"
                    style={{
                      backgroundColor: themeColors.surface,
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 18,
                      fontWeight: '600',
                      color: themeColors.bs,
                      borderWidth: 1,
                      borderColor: themeColors.border,
                    }}
                  />
                </View>
              </View>

              {/* Categoría */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                Categoría
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selectedCategoryId === cat.id ? cat.color + '20' : themeColors.surface,
                      marginRight: 8,
                      borderWidth: 1,
                      borderColor: selectedCategoryId === cat.id ? cat.color : themeColors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: themeColors.text }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Guardar */}
              <TouchableOpacity
                onPress={handleSubmit}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>
                  Guardar Transacción
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </AnimatedTransition>
  );
}
