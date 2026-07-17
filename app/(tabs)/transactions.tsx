import { useCallback, useEffect, useState } from 'react';
import SegmentedControl from '../../src/components/SegmentedControl';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useAccounts } from '../../src/store/useAccounts';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import Toast from '../../src/components/Toast';
import EmptyState from '../../src/components/EmptyState';
import { useTransactions } from '../../src/store/useTransactions';
import { getCategories } from '../../src/services/categories';
import { getLatestRate } from '../../src/services/exchangeRate';
import { getPeriodSummary } from '../../src/services/transactions';
import { getAccountBalance } from '../../src/services/accounts';
import { formatUSD, formatBS, formatDateShort, getCurrentMonthRange } from '../../src/utils/format';
import { getLocalDateString, getLocalDate } from '../../src/utils/date';
import { suggestCategory } from '../../src/services/deepseek';
import type { Category, TransactionType } from '../../src/utils/types';
import { haptic } from '../../src/utils/haptics';
import { Ionicons } from '@expo/vector-icons';

// ─── Emoji → Ionicons mapping ─────────────────────────────────────────────
const EMOJI_TO_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  '🍔': 'restaurant-outline',
  '🚗': 'car-outline',
  '💊': 'medkit-outline',
  '📚': 'book-outline',
  '🎮': 'game-controller-outline',
  '🏠': 'home-outline',
  '💡': 'bulb-outline',
  '👕': 'shirt-outline',
  '💼': 'briefcase-outline',
  '💻': 'laptop-outline',
  '📈': 'trending-up-outline',
  '📦': 'cube-outline',
  '🎵': 'musical-notes-outline',
  '🎬': 'film-outline',
  '✈️': 'airplane-outline',
  '🐕': 'paw-outline',
  '💵': 'cash-outline',
  '🎓': 'school-outline',
  '🛒': 'cart-outline',
  '🍕': 'pizza-outline',
  '☕': 'cafe-outline',
  '🎂': 'gift-outline',
  '🍺': 'beer-outline',
  '🏋️': 'fitness-outline',
  '💰': 'wallet-outline',
  '🏦': 'business-outline',
  '💳': 'card-outline',
  '📱': 'phone-portrait-outline',
  '🌐': 'globe-outline',
  '🏧': 'cash-outline',
  '🎯': 'locate-outline',
  '📊': 'bar-chart-outline',
  '🪙': 'diamond-outline',
  '💎': 'diamond-outline',
  '🐷': 'save-outline',
  '📸': 'camera-outline',
  '⭐': 'star-outline',
  '📁': 'folder-outline',
  '📋': 'clipboard-outline',
};

function getIcon(icon: string | null | undefined): keyof typeof Ionicons.glyphMap {
  if (!icon) return 'cube-outline';
  if (EMOJI_TO_ICON[icon]) return EMOJI_TO_ICON[icon];
  return icon as keyof typeof Ionicons.glyphMap;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year';

function getPeriodDates(filter: PeriodFilter): { start: string; end: string; label: string } {
  const localDate = getLocalDate();
  const todayStr = getLocalDateString();

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
  const params = useLocalSearchParams<{ presetAccountId?: string; presetType?: string }>();
  const themeColors = useThemeColors();
  const { accounts, loadAccounts } = useAccounts();
  const { transactions, loadTransactions, addTransaction, removeTransaction } = useTransactions();
  const { preferredRateType, manualRate, deepseekKey } = useSettings();
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

  // Search & combined filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [accountFilter, setAccountFilter] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amountUSD, setAmountUSD] = useState('');
  const [amountBS, setAmountBS] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transferToAccountId, setTransferToAccountId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const [suggestedCategoryName, setSuggestedCategoryName] = useState<string | null>(null);
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
    if (txType === 'transfer') {
      if (!transferToAccountId) {
        Alert.alert('Error', 'Selecciona la cuenta destino');
        return;
      }
      if (transferToAccountId === selectedAccountId) {
        Alert.alert('Error', 'La cuenta destino debe ser diferente a la cuenta origen');
        return;
      }
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

    // Validar saldo suficiente para gastos y transferencias
    if (txType === 'expense' || txType === 'transfer') {
      const balance = await getAccountBalance(selectedAccountId);
      if (usd && usd > 0 && balance.balanceUSD < usd) {
        Alert.alert(
          'Saldo insuficiente',
          `La cuenta tiene ${formatUSD(balance.balanceUSD)} pero intentas ${txType === 'transfer' ? 'transferir' : 'gastar'} ${formatUSD(usd)}.`
        );
        return;
      }
      if (bs && bs > 0 && balance.balanceBS < bs) {
        Alert.alert(
          'Saldo insuficiente',
          `La cuenta tiene ${formatBS(balance.balanceBS)} pero intentas ${txType === 'transfer' ? 'transferir' : 'gastar'} ${formatBS(bs)}.`
        );
        return;
      }
    }

    await addTransaction({
      type: txType,
      description: description.trim(),
      amountUSD: usd,
      amountBS: bs,
      currency: usd && bs ? 'BOTH' : usd ? 'USD' : 'BS',
      exchangeRate,
      accountId: selectedAccountId,
      transferToAccountId: txType === 'transfer' ? transferToAccountId : null,
      categoryId: selectedCategoryId,
      date: txDate,
      notes: null,
    });

    haptic('success');
    setShowModal(false);
    setDescription('');
    setAmountUSD('');
    setAmountBS('');
    setTxType('expense');
    setTransferToAccountId(null);
    await loadData();
    showToast('✅ Transacción guardada');
  };

  const handleDelete = (id: number) => {
    Alert.alert('Eliminar', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        haptic('warning');
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

  // Filtrar transacciones combinando: período + búsqueda + tipo + cuenta + categoría
  const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);
  const filteredTransactions = transactions.filter((tx) => {
    // Filtro de período
    if (tx.date < periodStart || tx.date > periodEnd) return false;
    // Filtro de búsqueda por texto
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (!tx.description.toLowerCase().includes(q)) return false;
    }
    // Filtro por tipo
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    // Filtro por cuenta
    if (accountFilter !== null && tx.accountId !== accountFilter) return false;
    // Filtro por categoría
    if (categoryFilter !== null && tx.categoryId !== categoryFilter) return false;
    return true;
  });

  // Obtener tipos únicos de transacciones para el filtro
  const uniqueTypes: ('all' | TransactionType)[] = ['all', 'expense', 'income', 'transfer'];
  const typeLabels: Record<string, string> = { all: 'Todos', expense: 'Gastos', income: 'Ingresos', transfer: 'Transferencias' };

  const periodFilters: { key: PeriodFilter; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
    { key: 'year', label: 'Año' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.secondary} colors={[themeColors.secondary]} />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 100 }}
      >
        {/* Header con botón de filtros */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ letterSpacing: 0.5, marginBottom: 2, fontSize: 11 }}>
              REGISTRO FINANCIERO
            </ThemedText>
            <ThemedText type="h2" themeColor="text" style={{ fontSize: 22 }}>
              Movimientos
            </ThemedText>
          </View>
          <TouchableOpacity
            accessibilityLabel={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            onPress={() => setShowFilters(!showFilters)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: showFilters ? themeColors.secondary : themeColors.surfaceContainer,
              borderWidth: 1,
              borderColor: showFilters ? themeColors.secondary : themeColors.surfaceContainerHighest,
            }}>
            <Ionicons
              name="funnel"
              size={16}
              color={showFilters ? themeColors.background : themeColors.onSurfaceVariant}
            />
            <ThemedText type="badge" themeColor={showFilters ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
              Filtros
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Barra de búsqueda */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: themeColors.surfaceContainer,
          borderRadius: 12,
          paddingHorizontal: 14,
          marginBottom: showFilters ? 12 : 16,
          borderWidth: 1,
          borderColor: searchQuery.trim() ? themeColors.secondary : themeColors.surfaceContainerHighest,
        }}>
          <Ionicons name="search-outline" size={20} color={themeColors.onSurfaceVariant} style={{ marginRight: 8 }} />
          <TextInput
            style={{
              flex: 1,
              paddingVertical: 12,
              fontSize: 15,
              color: themeColors.text,
            }}
            placeholder="Buscar movimientos..."
            placeholderTextColor={themeColors.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity accessibilityLabel="Limpiar búsqueda" onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={themeColors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros combinados (expandibles) */}
        {showFilters && (
          <View style={{ marginBottom: 16, gap: 10 }}>
            {/* Filtro por tipo */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {uniqueTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    accessibilityLabel={`Filtrar por tipo ${typeLabels[type]}`}
                    onPress={() => setTypeFilter(type)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: typeFilter === type ? themeColors.secondary : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: typeFilter === type ? themeColors.secondary : themeColors.surfaceContainerHighest,
                    }}>
                    <ThemedText type="badge" themeColor={typeFilter === type ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
                      {typeLabels[type]}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Filtro por cuenta */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 0 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  accessibilityLabel="Mostrar todas las cuentas"
                  onPress={() => setAccountFilter(null)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    backgroundColor: accountFilter === null ? themeColors.secondary : themeColors.surfaceContainer,
                    borderWidth: 1,
                    borderColor: accountFilter === null ? themeColors.secondary : themeColors.surfaceContainerHighest,
                  }}>
                  <ThemedText type="badge" themeColor={accountFilter === null ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
                    Todas
                  </ThemedText>
                </TouchableOpacity>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    accessibilityLabel={`Filtrar por cuenta ${acc.name}`}
                    onPress={() => setAccountFilter(acc.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: accountFilter === acc.id ? themeColors.secondary : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: accountFilter === acc.id ? themeColors.secondary : themeColors.surfaceContainerHighest,
                    }}>
                    <ThemedText type="badge" themeColor={accountFilter === acc.id ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
                      {acc.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Filtro por categoría */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  accessibilityLabel="Mostrar todas las categorías"
                  onPress={() => setCategoryFilter(null)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    backgroundColor: categoryFilter === null ? themeColors.secondary : themeColors.surfaceContainer,
                    borderWidth: 1,
                    borderColor: categoryFilter === null ? themeColors.secondary : themeColors.surfaceContainerHighest,
                  }}>
                  <ThemedText type="badge" themeColor={categoryFilter === null ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
                    Todas
                  </ThemedText>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    accessibilityLabel={`Filtrar por categoría ${cat.name}`}
                    onPress={() => setCategoryFilter(cat.id)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: categoryFilter === cat.id ? themeColors.secondary : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: categoryFilter === cat.id ? themeColors.secondary : themeColors.surfaceContainerHighest,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                    <Ionicons name={getIcon(cat.icon)} size={14} color={categoryFilter === cat.id ? themeColors.background : themeColors.onSurfaceVariant} />
                    <ThemedText type="badge" themeColor={categoryFilter === cat.id ? 'onSecondaryContainer' : 'onSurfaceVariant'} style={{ fontSize: 11, letterSpacing: 0.5 }}>
                      {cat.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Filtros de Período */}
        <View style={{ marginBottom: 16 }}>
          <SegmentedControl
            options={periodFilters}
            selected={periodFilter}
            onSelect={handleFilterChange}
          />
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
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: themeColors.surfaceContainerHighest,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Ionicons name="arrow-up-outline" size={14} color={themeColors.secondary} />
                <ThemedText type="badge" themeColor="secondary" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                  INGRESOS
                </ThemedText>
              </View>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                {formatUSD(totalIncomeUSD)}
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                {formatBS(totalIncomeBS)}
              </ThemedText>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: themeColors.surfaceContainerHighest,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Ionicons name="arrow-down-outline" size={14} color={themeColors.danger} />
                <ThemedText type="badge" themeColor="danger" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                  GASTOS
                </ThemedText>
              </View>
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                {formatUSD(totalExpenseUSD)}
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                {formatBS(totalExpenseBS)}
              </ThemedText>
            </View>
            {/* Balance Neto */}
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: themeColors.surfaceContainerHighest,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <Ionicons name="wallet-outline" size={14} color={netUSD >= 0 ? themeColors.secondary : themeColors.danger} />
                <ThemedText type="badge" themeColor="onSurfaceVariant" style={{ fontSize: 10, letterSpacing: 0.5 }}>
                  BALANCE
                </ThemedText>
              </View>
              <ThemedText type="h3" themeColor={netUSD >= 0 ? 'secondary' : 'danger'} style={{ fontSize: 18 }}>
                {formatUSD(netUSD)}
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                {formatBS(netBS)}
              </ThemedText>
            </View>
          </View>
          );
        })()}

        {/* Contador de resultados */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText type="caption" themeColor="textSecondary">
            {filteredTransactions.length} {filteredTransactions.length === 1 ? 'movimiento' : 'movimientos'}
          </ThemedText>
          {(searchQuery || typeFilter !== 'all' || accountFilter !== null || categoryFilter !== null) && (
            <TouchableOpacity
              accessibilityLabel="Limpiar todos los filtros"
              onPress={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setAccountFilter(null);
                setCategoryFilter(null);
              }}>
              <ThemedText type="buttonSmall" themeColor="primary">
                Limpiar filtros
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Lista de Transacciones */}
        {filteredTransactions.length === 0 ? (
          <EmptyState
            variant={searchQuery || typeFilter !== 'all' || accountFilter !== null || categoryFilter !== null ? 'search' : 'transactions'}
            title={searchQuery || typeFilter !== 'all' || accountFilter !== null || categoryFilter !== null ? 'Sin resultados' : 'Sin transacciones'}
            subtitle={
              searchQuery || typeFilter !== 'all' || accountFilter !== null || categoryFilter !== null
                ? 'Intenta con otros filtros o palabras clave'
                : 'No hay transacciones en este período'
            }
          />
        ) : (
          filteredTransactions.map((tx) => {
          const account = accounts.find((a) => a.id === tx.accountId);
          const category = categories.find((c) => c.id === tx.categoryId);
          const renderRightActions = () => (
            <TouchableOpacity
              accessibilityLabel={`Eliminar transacción ${tx.description}`}
              onPress={() => handleDelete(tx.id)}
              style={{
                backgroundColor: '#EF4444',
                borderRadius: 14,
                justifyContent: 'center',
                alignItems: 'center',
                width: 80,
                marginBottom: 8,
                marginLeft: 8,
              }}>
              <Ionicons name="trash-outline" size={22} color="#FFF" />
              <ThemedText type="badge" color="#FFF" style={{ marginTop: 2 }}>
                Eliminar
              </ThemedText>
            </TouchableOpacity>
          );
          return (
            <Swipeable
              key={tx.id}
              renderRightActions={renderRightActions}
              overshootRight={false}
              rightThreshold={40}
            >
              <View
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
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
                  <Ionicons name={getIcon(category?.icon)} size={20} color={tx.type === 'income' ? themeColors.success : themeColors.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    {tx.description}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {account?.icon} {account?.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">·</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatDateShort(tx.date)}
                    </ThemedText>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {tx.amountUSD && (
                    <ThemedText type="body" color={tx.type === 'income' ? themeColors.success : themeColors.danger} style={{ fontWeight: '700' }}>
                      {tx.type === 'income' ? '+' : '-'}{formatUSD(tx.amountUSD)}
                    </ThemedText>
                  )}
                  {tx.amountBS && (
                    <ThemedText type="caption" themeColor="textSecondary">
                      {formatBS(tx.amountBS)}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Swipeable>
          );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        accessibilityLabel="Nueva transacción"
        onPress={openNewModal}
        style={{
          position: 'absolute',
          bottom: 100,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: themeColors.secondary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#0A1E3D',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.6,
          shadowRadius: 16,
          elevation: 4,
        }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        visible={toastVisible}
        type="success"
        onDismiss={() => setToastVisible(false)}
      />

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
                <ThemedText type="h2" themeColor="text">
                  Nueva Transacción
                </ThemedText>
                <TouchableOpacity accessibilityLabel="Cerrar modal" onPress={() => setShowModal(false)}>
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
                      accessibilityLabel={`Seleccionar tipo ${type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Transferencia'}`}
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
                      <ThemedText type="buttonSmall" color={txType === type ? '#FFF' : themeColors.text}>
                        {type === 'expense' ? 'Gasto' : type === 'income' ? 'Ingreso' : 'Transf.'}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Cuenta */}
              <ThemedText type="buttonSmall" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Cuenta
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {accounts.map((account) => (
                  <TouchableOpacity
                    key={account.id}
                    accessibilityLabel={`Seleccionar cuenta ${account.name}`}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selectedAccountId === account.id ? account.color + '20' : themeColors.surface,
                      marginRight: 8,
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 2,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{account.icon}</Text>
                    <ThemedText type="body" themeColor="text">
                      {account.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Cuenta Destino (solo para transferencias) */}
              {txType === 'transfer' && (
                <>
                  <ThemedText type="buttonSmall" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                    Cuenta Destino
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {accounts
                      .filter((a) => a.id !== selectedAccountId)
                      .map((account) => (
                        <TouchableOpacity
                          key={account.id}
                          accessibilityLabel={`Seleccionar cuenta destino ${account.name}`}
                          onPress={() => setTransferToAccountId(account.id)}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 12,
                            backgroundColor: transferToAccountId === account.id ? account.color + '20' : themeColors.surface,
                            marginRight: 8,
                            shadowColor: '#0A1E3D',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.4,
                            shadowRadius: 4,
                            elevation: 2,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Text style={{ fontSize: 16 }}>{account.icon}</Text>
                          <ThemedText type="body" themeColor="text">
                            {account.name}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </>
              )}

              {/* Descripción */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <ThemedText type="buttonSmall" themeColor="textSecondary">
                  Descripción
                </ThemedText>
                {suggestingCategory && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <ActivityIndicator size="small" color={themeColors.primary} />
                    <ThemedText type="badge" themeColor="textSecondary">Analizando...</ThemedText>
                  </View>
                )}
                {suggestedCategoryName && !suggestingCategory && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="sparkles" size={14} color={themeColors.primary} />
                    <ThemedText type="badge" themeColor="primary">Sugerido: {suggestedCategoryName}</ThemedText>
                  </View>
                )}
              </View>
              <TextInput
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  // Limpiar sugerencia al escribir
                  if (suggestedCategoryName) {
                    setSuggestedCategoryName(null);
                  }
                }}
                onBlur={async () => {
                  const trimmed = description.trim();
                  if (trimmed.length < 5 || !deepseekKey) return;

                  setSuggestingCategory(true);
                  try {
                    const result = await suggestCategory(trimmed, categories, deepseekKey);
                    if (result.categoryId !== null) {
                      setSelectedCategoryId(result.categoryId);
                      setSuggestedCategoryName(result.categoryName);
                    }
                  } catch {
                    // Silently fail - no molestar al usuario
                  } finally {
                    setSuggestingCategory(false);
                  }
                }}
                placeholder="Ej: Gasté 20$ en almuerzo..."
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 15,
                  color: themeColors.text,
                  marginBottom: 16,
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.4,
                  shadowRadius: 4,
                  elevation: 2,
                  borderWidth: suggestedCategoryName ? 1 : 0,
                  borderColor: suggestedCategoryName ? themeColors.primary : 'transparent',
                }}
              />

              {/* Montos */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="buttonSmall" themeColor="usd" style={{ marginBottom: 8 }}>
                    Monto en USD
                  </ThemedText>
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
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="buttonSmall" themeColor="bs" style={{ marginBottom: 8 }}>
                    Monto en Bs
                  </ThemedText>
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
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  />
                </View>
              </View>

              {/* Categoría */}
              <ThemedText type="buttonSmall" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Categoría
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    accessibilityLabel={`Seleccionar categoría ${cat.name}`}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selectedCategoryId === cat.id ? cat.color + '20' : themeColors.surface,
                      marginRight: 8,
                      shadowColor: '#0A1E3D',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 2,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name={getIcon(cat.icon)} size={18} color={themeColors.primary} />
                    <ThemedText type="body" themeColor="text">
                      {cat.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Guardar */}
              <TouchableOpacity
                accessibilityLabel="Guardar transacción"
                onPress={handleSubmit}
                style={{
                  backgroundColor: themeColors.secondary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.6,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
                  Guardar Transacción
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
