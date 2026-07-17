import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { formatUSD, formatBS, formatDate } from '../../src/utils/format';
import {
  getDebts,
  getDebtById,
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtPayments,
  recordPayment,
  getDebtSummary,
} from '../../src/services/debts';
import type { Debt, DebtPayment, DebtType, DebtStatus, CurrencyType } from '../../src/utils/types';

type FilterTab = 'all' | 'lent' | 'borrowed';

export default function DebtsScreen() {
  const themeColors = useThemeColors();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');

  // Summary
  const [summary, setSummary] = useState({
    totalLentUSD: 0,
    totalLentBS: 0,
    totalBorrowedUSD: 0,
    totalBorrowedBS: 0,
    netBalanceUSD: 0,
    netBalanceBS: 0,
    activeLentCount: 0,
    activeBorrowedCount: 0,
  });

  // Modal creación/edición
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formType, setFormType] = useState<DebtType>('lent');
  const [formPerson, setFormPerson] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmountUSD, setFormAmountUSD] = useState('');
  const [formAmountBS, setFormAmountBS] = useState('');
  const [formCurrency, setFormCurrency] = useState<CurrencyType>('USD');
  const [formInterest, setFormInterest] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState(new Date());

  // Modal pagos
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDebtId, setPaymentDebtId] = useState<number | null>(null);
  const [paymentAmountUSD, setPaymentAmountUSD] = useState('');
  const [paymentAmountBS, setPaymentAmountBS] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [showPaymentsList, setShowPaymentsList] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const typeFilter = filterTab === 'all' ? undefined : filterTab;
      const [debtsData, summaryData] = await Promise.all([
        getDebts(typeFilter),
        getDebtSummary(),
      ]);
      setDebts(debtsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  }, [filterTab]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openNewModal = () => {
    setEditId(null);
    setFormType('lent');
    setFormPerson('');
    setFormDescription('');
    setFormAmountUSD('');
    setFormAmountBS('');
    setFormCurrency('USD');
    setFormInterest('');
    setFormDueDate('');
    setFormNotes('');
    setShowModal(true);
  };

  const openEditModal = (debt: Debt) => {
    setEditId(debt.id);
    setFormType(debt.type);
    setFormPerson(debt.personName);
    setFormDescription(debt.description || '');
    setFormAmountUSD(debt.amountUSD?.toString() || '');
    setFormAmountBS(debt.amountBS?.toString() || '');
    setFormCurrency(debt.currency);
    setFormInterest(debt.interestRate?.toString() || '');
    setFormDueDate(debt.dueDate || '');
    setFormNotes(debt.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formPerson.trim()) {
      Alert.alert('Error', 'El nombre de la persona es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const amountUSD = formAmountUSD ? parseFloat(formAmountUSD) : null;
      const amountBS = formAmountBS ? parseFloat(formAmountBS) : null;
      const interestRate = formInterest ? parseFloat(formInterest) : 0;

      // Calcular total con intereses
      let totalAmountUSD = amountUSD;
      let totalAmountBS = amountBS;
      if (interestRate > 0 && amountUSD) {
        totalAmountUSD = amountUSD * (1 + interestRate / 100);
      }
      if (interestRate > 0 && amountBS) {
        totalAmountBS = amountBS * (1 + interestRate / 100);
      }

      const data = {
        type: formType,
        personName: formPerson.trim(),
        description: formDescription.trim() || null,
        amountUSD,
        amountBS,
        currency: formCurrency,
        interestRate,
        totalAmountUSD: totalAmountUSD ? Math.round(totalAmountUSD * 100) / 100 : null,
        totalAmountBS: totalAmountBS ? Math.round(totalAmountBS * 100) / 100 : null,
        paidAmountUSD: 0,
        paidAmountBS: 0,
        dueDate: formDueDate.trim() || null,
        status: 'active' as DebtStatus,
        notes: formNotes.trim() || null,
      };

      if (editId) {
        await updateDebt(editId, data);
      } else {
        await createDebt(data);
      }

      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving debt:', error);
      Alert.alert('Error', 'No se pudo guardar la deuda');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (debt: Debt) => {
    const label = debt.type === 'lent' ? 'préstamo' : 'deuda';
    Alert.alert(
      `Eliminar ${label}`,
      `¿Estás seguro de eliminar "${debt.personName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebt(debt.id);
              await loadData();
            } catch (error) {
              console.error('Error deleting debt:', error);
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async (debt: Debt) => {
    try {
      const data = {
        type: debt.type,
        personName: debt.personName,
        description: debt.description,
        amountUSD: debt.amountUSD,
        amountBS: debt.amountBS,
        currency: debt.currency,
        interestRate: debt.interestRate || 0,
        totalAmountUSD: debt.totalAmountUSD,
        totalAmountBS: debt.totalAmountBS,
        paidAmountUSD: 0,
        paidAmountBS: 0,
        dueDate: debt.dueDate,
        status: 'active' as DebtStatus,
        notes: debt.notes,
      };
      await createDebt(data);
      await loadData();
      Alert.alert('Duplicado', `Deuda con "${debt.personName}" duplicada correctamente`);
    } catch (error) {
      console.error('Error duplicating debt:', error);
      Alert.alert('Error', 'No se pudo duplicar la deuda');
    }
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setDatePickerDate(selectedDate);
      setFormDueDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  const openDatePicker = () => {
    if (formDueDate) {
      setDatePickerDate(new Date(formDueDate));
    } else {
      setDatePickerDate(new Date());
    }
    setShowDatePicker(true);
  };

  const openPaymentModal = (debtId: number) => {
    setPaymentDebtId(debtId);
    setPaymentAmountUSD('');
    setPaymentAmountBS('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentDebtId) return;
    const amtUSD = parseFloat(paymentAmountUSD) || 0;
    const amtBS = parseFloat(paymentAmountBS) || 0;
    if (amtUSD <= 0 && amtBS <= 0) {
      Alert.alert('Error', 'Debes ingresar al menos un monto');
      return;
    }

    try {
      await recordPayment(
        paymentDebtId,
        amtUSD,
        amtBS,
        paymentDate || new Date().toISOString().split('T')[0],
        paymentNotes.trim() || undefined
      );
      setShowPaymentModal(false);
      await loadData();
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'No se pudo registrar el pago');
    }
  };

  const viewPayments = async (debtId: number) => {
    try {
      const paymentsData = await getDebtPayments(debtId);
      setPayments(paymentsData);
      setShowPaymentsList(true);
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const getStatusBadge = (debt: Debt) => {
    if (debt.status === 'paid') {
      return { label: 'PAGADO', color: themeColors.onSurfaceVariant };
    }
    if (debt.dueDate && debt.dueDate < new Date().toISOString().split('T')[0]) {
      return { label: 'VENCIDO', color: themeColors.danger };
    }
    return { label: 'ACTIVO', color: themeColors.secondary };
  };

  const getProgress = (debt: Debt): number => {
    const totalUSD = debt.totalAmountUSD || debt.amountUSD || 0;
    const totalBS = debt.totalAmountBS || debt.amountBS || 0;
    if (totalUSD > 0) {
      return Math.min((debt.paidAmountUSD / totalUSD) * 100, 100);
    }
    if (totalBS > 0) {
      return Math.min((debt.paidAmountBS / totalBS) * 100, 100);
    }
    return 0;
  };

  const getRemainingUSD = (debt: Debt): number => {
    const total = debt.totalAmountUSD || debt.amountUSD || 0;
    return Math.max(total - debt.paidAmountUSD, 0);
  };

  const getRemainingBS = (debt: Debt): number => {
    const total = debt.totalAmountBS || debt.amountBS || 0;
    return Math.max(total - debt.paidAmountBS, 0);
  };

  const filteredDebts = debts.filter((d) => {
    if (filterTab === 'all') return true;
    return d.type === filterTab;
  });

  const renderPaymentsContent = () => {
    if (payments.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <ThemedText type="body" themeColor="onSurfaceVariant">
            Sin abonos registrados
          </ThemedText>
        </View>
      );
    }
    return (
      <ScrollView style={{ maxHeight: 400 }}>
        {payments.map((payment) => (
          <View
            key={payment.id}
            style={{
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '30',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <ThemedText type="body" themeColor="text">
                {formatUSD(payment.amountUSD)}
              </ThemedText>
              <ThemedText type="caption" themeColor="onSurfaceVariant">
                {formatDate(payment.date)}
              </ThemedText>
            </View>
            {payment.amountBS > 0 && (
              <ThemedText type="caption" themeColor="onSurfaceVariant">
                {formatBS(payment.amountBS)}
              </ThemedText>
            )}
            {payment.notes && (
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 4 }}>
                {payment.notes}
              </ThemedText>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header estilo Kinetic Ledger */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 8,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: themeColors.outlineVariant,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: themeColors.surfaceVariant,
            }}>
              <Ionicons name="person" size={20} color={themeColors.textSecondary} />
            </View>
            <ThemedText
              type="h2"
              themeColor="text"
              style={{ fontWeight: '600', letterSpacing: -0.5 }}
            >
              Deudas
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={openNewModal}
            accessibilityLabel="Crear nueva deuda"
            style={{
              backgroundColor: themeColors.secondary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
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
            <ThemedText type="buttonSmall" color={themeColors.background} style={{ fontWeight: '700' }}>
              NUEVA
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Summary Cards estilo Kinetic Ledger */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Me deben */}
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer + '99',
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '30',
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute',
                right: -50,
                top: -50,
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: themeColors.secondary + '1A',
                zIndex: 0,
              }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="arrow-down" size={16} color={themeColors.secondary} />
                <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', letterSpacing: 0.5 }}>
                  ME DEBEN
                </ThemedText>
              </View>
              <ThemedText type="h2" themeColor="text" style={{ fontWeight: '700', letterSpacing: -0.5 }}>
                {formatUSD(summary.totalLentUSD)}
              </ThemedText>
              {summary.totalLentBS > 0 && (
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                  ~ {formatBS(summary.totalLentBS)}
                </ThemedText>
              )}
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 4 }}>
                {summary.activeLentCount} activa(s)
              </ThemedText>
            </View>

            {/* Yo debo */}
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surfaceContainer + '99',
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '30',
              overflow: 'hidden',
            }}>
              <View style={{
                position: 'absolute',
                right: -50,
                top: -50,
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: themeColors.danger + '1A',
                zIndex: 0,
              }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Ionicons name="arrow-up" size={16} color={themeColors.danger} />
                <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', letterSpacing: 0.5 }}>
                  YO DEBO
                </ThemedText>
              </View>
              <ThemedText type="h2" themeColor="text" style={{ fontWeight: '700', letterSpacing: -0.5 }}>
                {formatUSD(summary.totalBorrowedUSD)}
              </ThemedText>
              {summary.totalBorrowedBS > 0 && (
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                  ~ {formatBS(summary.totalBorrowedBS)}
                </ThemedText>
              )}
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 4 }}>
                {summary.activeBorrowedCount} activa(s)
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Filter Tabs estilo Kinetic Ledger (border-bottom) */}
        <View style={{
          flexDirection: 'row',
          gap: 0,
          paddingHorizontal: 24,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.outlineVariant + '30',
          marginBottom: 20,
        }}>
          {([
            { key: 'all' as FilterTab, label: 'Todas' },
            { key: 'lent' as FilterTab, label: 'Me deben' },
            { key: 'borrowed' as FilterTab, label: 'Yo debo' },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              accessibilityLabel={`Filtrar: ${tab.label}`}
              onPress={() => setFilterTab(tab.key)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: 2,
                borderBottomColor: filterTab === tab.key ? themeColors.secondary : 'transparent',
              }}
            >
              <ThemedText
                type="buttonSmall"
                themeColor={filterTab === tab.key ? 'secondary' : 'onSurfaceVariant'}
                style={{ fontWeight: filterTab === tab.key ? '700' : '400' }}
              >
                {tab.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loading */}
        {loading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={themeColors.secondary} />
          </View>
        )}

        {/* Empty State */}
        {!loading && filteredDebts.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
            <Ionicons name="cash-outline" size={64} color={themeColors.onSurfaceVariant} />
            <ThemedText type="body" themeColor="onSurfaceVariant" style={{ marginTop: 16, textAlign: 'center' }}>
              No hay deudas registradas
            </ThemedText>
            <TouchableOpacity
              accessibilityLabel="Agregar deuda"
              onPress={openNewModal}
              style={{
                marginTop: 16,
                backgroundColor: themeColors.secondary,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
              }}
            >
              <ThemedText type="button" color={themeColors.background}>Agregar deuda</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Debt List */}
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          {filteredDebts.map((debt) => {
            const badge = getStatusBadge(debt);
            const progress = getProgress(debt);
            const isLent = debt.type === 'lent';
            const accentColor = isLent ? themeColors.secondary : themeColors.danger;

            return (
              <TouchableOpacity
                key={debt.id}
                accessibilityLabel={`Deuda con ${debt.personName}, ${formatUSD(getRemainingUSD(debt))} restantes`}
                onPress={() => openEditModal(debt)}
                onLongPress={() => handleDelete(debt)}
                style={{
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                  borderLeftWidth: 4,
                  borderLeftColor: accentColor,
                }}
              >
                {/* Header row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isLent ? themeColors.secondary + '20' : themeColors.danger + '20',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons
                          name={isLent ? 'arrow-down' : 'arrow-up'}
                          size={18}
                          color={accentColor}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                          {debt.personName}
                        </ThemedText>
                        {debt.description && (
                          <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                            {debt.description}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={{
                    backgroundColor: badge.color + '20',
                    paddingVertical: 4,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                  }}>
                    <ThemedText type="small" color={badge.color} style={{ fontWeight: '700', fontSize: 10 }}>
                      {badge.label}
                    </ThemedText>
                  </View>
                </View>

                {/* Amounts grid */}
                <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 2 }}>
                      Monto Restante
                    </ThemedText>
                    <ThemedText type="h3" color={accentColor} style={{ fontWeight: '700' }}>
                      {formatUSD(getRemainingUSD(debt))}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="onSurfaceVariant">
                      Total: {formatUSD(debt.totalAmountUSD || debt.amountUSD || 0)}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 2 }}>
                      {debt.dueDate ? 'Próximo Pago' : 'Vencimiento'}
                    </ThemedText>
                    <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                      {debt.dueDate ? formatDate(debt.dueDate) : '—'}
                    </ThemedText>
                    {debt.interestRate > 0 && (
                      <ThemedText type="caption" themeColor="tertiary">
                        Interés: {debt.interestRate}% mensual
                      </ThemedText>
                    )}
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={{ marginBottom: 12 }}>
                  <View style={{
                    height: 6,
                    backgroundColor: themeColors.surfaceVariant,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${progress}%` as any,
                      height: '100%',
                      backgroundColor: progress >= 100 ? themeColors.secondary : accentColor,
                      borderRadius: 3,
                    }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontSize: 10 }}>
                      {progress.toFixed(0)}% PAGADO
                    </ThemedText>
                    <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontSize: 10 }}>
                      {formatUSD(debt.paidAmountUSD)} ABONADO
                    </ThemedText>
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    accessibilityLabel={`Ver pagos de ${debt.personName}`}
                    onPress={() => viewPayments(debt.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: themeColors.surfaceVariant,
                      alignItems: 'center',
                    }}
                  >
                    <ThemedText type="buttonSmall" themeColor="text" style={{ fontSize: 12 }}>
                      VER PAGOS
                    </ThemedText>
                  </TouchableOpacity>
                  {debt.status !== 'paid' && (
                    <TouchableOpacity
                      accessibilityLabel={`Abonar a deuda de ${debt.personName}`}
                      onPress={() => openPaymentModal(debt.id)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: accentColor + '40',
                        alignItems: 'center',
                      }}
                    >
                      <ThemedText type="buttonSmall" color={accentColor} style={{ fontSize: 12 }}>
                        ABONAR
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    accessibilityLabel={`Duplicar deuda de ${debt.personName}`}
                    onPress={() => handleDuplicate(debt)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: themeColors.surfaceVariant,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons name="copy-outline" size={18} color={themeColors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  {editId ? 'Editar' : 'Nueva'} deuda
                </ThemedText>
                <TouchableOpacity accessibilityLabel="Cerrar modal" onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Type selector */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Tipo
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {([
                  { key: 'lent' as DebtType, label: 'Yo presté', icon: 'arrow-up-circle' as const },
                  { key: 'borrowed' as DebtType, label: 'Me prestaron', icon: 'arrow-down-circle' as const },
                ]).map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    accessibilityLabel={`Tipo: ${t.label}`}
                    onPress={() => setFormType(t.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: formType === t.key ? themeColors.secondaryContainer + '33' : themeColors.surfaceContainer,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: formType === t.key ? themeColors.secondary : themeColors.outlineVariant + '50',
                    }}
                  >
                    <Ionicons
                      name={t.icon}
                      size={18}
                      color={formType === t.key ? themeColors.secondary : themeColors.onSurfaceVariant}
                    />
                    <ThemedText type="buttonSmall" themeColor={formType === t.key ? 'secondary' : 'onSurfaceVariant'}>
                      {t.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Person name */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Persona *
              </ThemedText>
              <TextInput
                value={formPerson}
                onChangeText={setFormPerson}
                placeholder="Nombre de la persona"
                placeholderTextColor={themeColors.onSurfaceVariant}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              {/* Description */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Descripción
              </ThemedText>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Ej: Préstamo para el carro"
                placeholderTextColor={themeColors.onSurfaceVariant}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              {/* Currency selector */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Moneda
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    accessibilityLabel={`Moneda: ${cur === 'USD' ? 'USD' : cur === 'BS' ? 'Bolívares' : 'Ambas monedas'}`}
                    onPress={() => setFormCurrency(cur)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      backgroundColor: formCurrency === cur ? themeColors.secondaryContainer + '33' : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: formCurrency === cur ? themeColors.secondary : themeColors.outlineVariant + '50',
                    }}
                  >
                    <ThemedText type="buttonSmall" themeColor={formCurrency === cur ? 'secondary' : 'onSurfaceVariant'}>
                      {cur === 'USD' ? 'USD' : cur === 'BS' ? 'BS' : 'Ambas'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amounts */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                {(formCurrency === 'USD' || formCurrency === 'BOTH') && (
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                      Monto USD
                    </ThemedText>
                    <TextInput
                      value={formAmountUSD}
                      onChangeText={setFormAmountUSD}
                      placeholder="0.00"
                      placeholderTextColor={themeColors.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: themeColors.surfaceContainer,
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 16,
                        color: themeColors.text,
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '50',
                      }}
                    />
                  </View>
                )}
                {(formCurrency === 'BS' || formCurrency === 'BOTH') && (
                  <View style={{ flex: 1 }}>
                    <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                      Monto BS
                    </ThemedText>
                    <TextInput
                      value={formAmountBS}
                      onChangeText={setFormAmountBS}
                      placeholder="0.00"
                      placeholderTextColor={themeColors.onSurfaceVariant}
                      keyboardType="decimal-pad"
                      style={{
                        backgroundColor: themeColors.surfaceContainer,
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 16,
                        color: themeColors.text,
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant + '50',
                      }}
                    />
                  </View>
                )}
              </View>

              {/* Interest rate */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Tasa de interés (%) <ThemedText type="caption" themeColor="onSurfaceVariant">(opcional)</ThemedText>
              </ThemedText>
              <TextInput
                value={formInterest}
                onChangeText={setFormInterest}
                placeholder="0"
                placeholderTextColor={themeColors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              {/* Due date */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Fecha de vencimiento <ThemedText type="caption" themeColor="onSurfaceVariant">(opcional)</ThemedText>
              </ThemedText>
              <TouchableOpacity
                onPress={openDatePicker}
                accessibilityLabel="Seleccionar fecha de vencimiento"
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              >
                <ThemedText
                  type="body"
                  color={formDueDate ? themeColors.text : themeColors.onSurfaceVariant}
                >
                  {formDueDate ? formDueDate : 'Seleccionar fecha'}
                </ThemedText>
                <Ionicons name="calendar-outline" size={20} color={themeColors.onSurfaceVariant} />
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={datePickerDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
              )}

              {/* Notes */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Notas <ThemedText type="caption" themeColor="onSurfaceVariant">(opcional)</ThemedText>
              </ThemedText>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Notas adicionales"
                placeholderTextColor={themeColors.onSurfaceVariant}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              <TouchableOpacity
                accessibilityLabel={editId ? 'Guardar cambios de deuda' : 'Crear nueva deuda'}
                onPress={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: themeColors.secondary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  opacity: saving ? 0.6 : 1,
                  marginBottom: 40,
                }}
              >
                {saving ? (
                  <ActivityIndicator color={themeColors.background} />
                ) : (
                  <ThemedText type="button" color={themeColors.background} style={{ fontWeight: '700' }}>
                    {editId ? 'Guardar cambios' : 'Crear deuda'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  Registrar abono
                </ThemedText>
                <TouchableOpacity accessibilityLabel="Cerrar modal de abono" onPress={() => setShowPaymentModal(false)}>
                  <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Monto USD
              </ThemedText>
              <TextInput
                value={paymentAmountUSD}
                onChangeText={setPaymentAmountUSD}
                placeholder="0.00"
                placeholderTextColor={themeColors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Monto BS
              </ThemedText>
              <TextInput
                value={paymentAmountBS}
                onChangeText={setPaymentAmountBS}
                placeholder="0.00"
                placeholderTextColor={themeColors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Fecha
              </ThemedText>
              <TextInput
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="2026-06-30"
                placeholderTextColor={themeColors.onSurfaceVariant}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Notas <ThemedText type="caption" themeColor="onSurfaceVariant">(opcional)</ThemedText>
              </ThemedText>
              <TextInput
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                placeholder="Notas del abono"
                placeholderTextColor={themeColors.onSurfaceVariant}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '50',
                }}
              />

              <TouchableOpacity
                accessibilityLabel="Registrar abono"
                onPress={handleRecordPayment}
                style={{
                  backgroundColor: themeColors.secondary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginBottom: 40,
                }}
              >
                <ThemedText type="button" color={themeColors.background} style={{ fontWeight: '700' }}>
                  Registrar abono
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Payments List Modal */}
      <Modal visible={showPaymentsList} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <ThemedText type="h2" themeColor="text">
                Historial de abonos
              </ThemedText>
              <TouchableOpacity accessibilityLabel="Cerrar historial de abonos" onPress={() => setShowPaymentsList(false)}>
                <Ionicons name="close" size={28} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
            {renderPaymentsContent()}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}