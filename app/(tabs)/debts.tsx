import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import AnimatedTransition from '../../src/components/AnimatedTransition';
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
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
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
      return { label: 'PAGADO', color: '#10B981' };
    }
    if (debt.dueDate && debt.dueDate < new Date().toISOString().split('T')[0]) {
      return { label: 'VENCIDO', color: '#EF4444' };
    }
    return { label: 'ACTIVO', color: '#3B82F6' };
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
          <Text style={{ fontSize: 14, color: themeColors.textSecondary }}>
            Sin abonos registrados
          </Text>
        </View>
      );
    }
    return (
      <ScrollView style={{ maxHeight: 400 }}>
        {payments.map((payment) => (
          <View
            key={payment.id}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                {formatUSD(payment.amountUSD)}
              </Text>
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                {formatDate(payment.date)}
              </Text>
            </View>
            {payment.amountBS > 0 && (
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                {formatBS(payment.amountBS)}
              </Text>
            )}
            {payment.notes && (
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
                {payment.notes}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <AnimatedTransition>
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <ScrollView contentContainerStyle={{ padding: isSmall ? 14 : 20, paddingBottom: 100 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: isSmall ? 24 : 28, fontWeight: '700', color: themeColors.text }}>
              Deudas
            </Text>
            <TouchableOpacity
              onPress={openNewModal}
              style={{
                backgroundColor: themeColors.primary,
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', gap: isSmall ? 8 : 12, marginBottom: isSmall ? 14 : 20 }}>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: isSmall ? 12 : 16,
              borderLeftWidth: 4,
              borderLeftColor: '#10B981',
            }}>
              <Text style={{ fontSize: isSmall ? 11 : 12, color: '#10B981', fontWeight: '600', marginBottom: 4 }}>
                ME DEBEN
              </Text>
              <Text style={{ fontSize: isSmall ? 15 : 18, fontWeight: '700', color: themeColors.text }}>
                {formatUSD(summary.totalLentUSD)}
              </Text>
              {summary.totalLentBS > 0 && (
                <Text style={{ fontSize: isSmall ? 11 : 13, color: themeColors.textSecondary }}>
                  {formatBS(summary.totalLentBS)}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 2 }}>
                {summary.activeLentCount} activa(s)
              </Text>
            </View>
            <View style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 16,
              padding: isSmall ? 12 : 16,
              borderLeftWidth: 4,
              borderLeftColor: '#EF4444',
            }}>
              <Text style={{ fontSize: isSmall ? 11 : 12, color: '#EF4444', fontWeight: '600', marginBottom: 4 }}>
                YO DEBO
              </Text>
              <Text style={{ fontSize: isSmall ? 15 : 18, fontWeight: '700', color: themeColors.text }}>
                {formatUSD(summary.totalBorrowedUSD)}
              </Text>
              {summary.totalBorrowedBS > 0 && (
                <Text style={{ fontSize: isSmall ? 11 : 13, color: themeColors.textSecondary }}>
                  {formatBS(summary.totalBorrowedBS)}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 2 }}>
                {summary.activeBorrowedCount} activa(s)
              </Text>
            </View>
          </View>

          {/* Net Balance */}
          <View style={{
            backgroundColor: themeColors.surface,
            borderRadius: 16,
            padding: isSmall ? 12 : 16,
            marginBottom: 20,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 14, color: themeColors.textSecondary }}>Saldo Neto</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: 20,
                fontWeight: '700',
                color: summary.netBalanceUSD >= 0 ? '#10B981' : '#EF4444',
              }}>
                {summary.netBalanceUSD >= 0 ? '+' : ''}{formatUSD(summary.netBalanceUSD)}
              </Text>
              {summary.netBalanceBS !== 0 && (
                <Text style={{
                  fontSize: 13,
                  color: summary.netBalanceBS >= 0 ? '#10B981' : '#EF4444',
                }}>
                  {summary.netBalanceBS >= 0 ? '+' : ''}{formatBS(summary.netBalanceBS)}
                </Text>
              )}
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'all' as FilterTab, label: 'Todas' },
              { key: 'lent' as FilterTab, label: 'Me deben' },
              { key: 'borrowed' as FilterTab, label: 'Yo debo' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilterTab(tab.key)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: filterTab === tab.key ? themeColors.primary : themeColors.surface,
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: filterTab === tab.key ? '#FFFFFF' : themeColors.textSecondary,
                }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading */}
          {loading && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
          )}

          {/* Empty State */}
          {!loading && filteredDebts.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="cash-outline" size={64} color={themeColors.textSecondary} />
              <Text style={{ fontSize: 16, color: themeColors.textSecondary, marginTop: 16, textAlign: 'center' }}>
                No hay deudas registradas
              </Text>
              <TouchableOpacity
                onPress={openNewModal}
                style={{
                  marginTop: 16,
                  backgroundColor: themeColors.primary,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Agregar deuda</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Debt List */}
          {filteredDebts.map((debt) => {
            const badge = getStatusBadge(debt);
            const progress = getProgress(debt);
            const isLent = debt.type === 'lent';
            const accentColor = isLent ? '#10B981' : '#EF4444';

            return (
              <TouchableOpacity
                key={debt.id}
                onPress={() => openEditModal(debt)}
                onLongPress={() => handleDelete(debt)}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: accentColor,
                }}
              >
                {/* Header row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons
                        name={isLent ? 'arrow-up-circle' : 'arrow-down-circle'}
                        size={20}
                        color={accentColor}
                      />
                      <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text }}>
                        {debt.personName}
                      </Text>
                    </View>
                    {debt.description && (
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4, marginLeft: 28 }}>
                        {debt.description}
                      </Text>
                    )}
                  </View>
                  <View style={{
                    backgroundColor: badge.color + '20',
                    paddingVertical: 3,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: badge.color }}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Amounts */}
                <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Total</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                      {formatUSD(debt.totalAmountUSD || debt.amountUSD || 0)}
                    </Text>
                    {(debt.totalAmountBS || debt.amountBS) && (
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {formatBS(debt.totalAmountBS || debt.amountBS || 0)}
                      </Text>
                    )}
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Restante</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: accentColor }}>
                      {formatUSD(getRemainingUSD(debt))}
                    </Text>
                    {(debt.totalAmountBS || debt.amountBS) && (
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {formatBS(getRemainingBS(debt))}
                      </Text>
                    )}
                  </View>
                  {debt.interestRate > 0 && (
                    <View>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Interés</Text>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#F59E0B' }}>
                        {debt.interestRate}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Progress Bar */}
                <View style={{ marginTop: 10 }}>
                  <View style={{
                    height: 6,
                    backgroundColor: themeColors.background,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${progress}%`,
                      height: '100%',
                      backgroundColor: progress >= 100 ? '#10B981' : accentColor,
                      borderRadius: 3,
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 4 }}>
                    {progress.toFixed(0)}% pagado
                  </Text>
                </View>

                {/* Due date & actions */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={themeColors.textSecondary} />
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                      {debt.dueDate ? formatDate(debt.dueDate) : 'Sin vencimiento'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => viewPayments(debt.id)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        backgroundColor: themeColors.background,
                      }}
                    >
                      <Ionicons name="receipt-outline" size={16} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    {debt.status !== 'paid' && (
                      <TouchableOpacity
                        onPress={() => openPaymentModal(debt.id)}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: themeColors.primary + '20',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.primary }}>
                          Abonar
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
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
                  <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                    {editId ? 'Editar' : 'Nueva'} deuda
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Type selector */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Tipo
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  {([
                    { key: 'lent' as DebtType, label: 'Me prestaron', icon: 'arrow-down-circle' as const },
                    { key: 'borrowed' as DebtType, label: 'Yo presté', icon: 'arrow-up-circle' as const },
                  ]).map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setFormType(t.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 12,
                        backgroundColor: formType === t.key ? themeColors.primary : themeColors.surface,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons
                        name={t.icon}
                        size={18}
                        color={formType === t.key ? '#FFFFFF' : themeColors.textSecondary}
                      />
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: formType === t.key ? '#FFFFFF' : themeColors.textSecondary,
                      }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Person name */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Persona
                </Text>
                <TextInput
                  value={formPerson}
                  onChangeText={setFormPerson}
                  placeholder="Nombre de la persona"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                {/* Description */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Descripción
                </Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Ej: Préstamo para el carro"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                {/* Currency selector */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Moneda
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      onPress={() => setFormCurrency(cur)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 10,
                        backgroundColor: formCurrency === cur ? themeColors.primary : themeColors.surface,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: formCurrency === cur ? '#FFFFFF' : themeColors.textSecondary,
                      }}>
                        {cur === 'USD' ? '🇺🇸 USD' : cur === 'BS' ? '🇻🇪 BS' : 'Ambas'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amounts */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  {(formCurrency === 'USD' || formCurrency === 'BOTH') && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                        Monto USD
                      </Text>
                      <TextInput
                        value={formAmountUSD}
                        onChangeText={setFormAmountUSD}
                        placeholder="0.00"
                        placeholderTextColor={themeColors.textSecondary}
                        keyboardType="decimal-pad"
                        style={{
                          backgroundColor: themeColors.surface,
                          borderRadius: 12,
                          padding: 14,
                          fontSize: 16,
                          color: themeColors.text,
                        }}
                      />
                    </View>
                  )}
                  {(formCurrency === 'BS' || formCurrency === 'BOTH') && (
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                        Monto BS
                      </Text>
                      <TextInput
                        value={formAmountBS}
                        onChangeText={setFormAmountBS}
                        placeholder="0.00"
                        placeholderTextColor={themeColors.textSecondary}
                        keyboardType="decimal-pad"
                        style={{
                          backgroundColor: themeColors.surface,
                          borderRadius: 12,
                          padding: 14,
                          fontSize: 16,
                          color: themeColors.text,
                        }}
                      />
                    </View>
                  )}
                </View>

                {/* Interest rate */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Tasa de interés (%) <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>(opcional)</Text>
                </Text>
                <TextInput
                  value={formInterest}
                  onChangeText={setFormInterest}
                  placeholder="0"
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                {/* Due date */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Fecha de vencimiento <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>(YYYY-MM-DD, opcional)</Text>
                </Text>
                <TextInput
                  value={formDueDate}
                  onChangeText={setFormDueDate}
                  placeholder="2026-12-31"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                {/* Notes */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Notas <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>(opcional)</Text>
                </Text>
                <TextInput
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Notas adicionales"
                  placeholderTextColor={themeColors.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 24,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />

                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={{
                    backgroundColor: themeColors.primary,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                      {editId ? 'Guardar cambios' : 'Crear deuda'}
                    </Text>
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
                  <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                    Registrar abono
                  </Text>
                  <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                    <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Monto USD
                </Text>
                <TextInput
                  value={paymentAmountUSD}
                  onChangeText={setPaymentAmountUSD}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Monto BS
                </Text>
                <TextInput
                  value={paymentAmountBS}
                  onChangeText={setPaymentAmountBS}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Fecha
                </Text>
                <TextInput
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                  placeholder="2026-06-30"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                  }}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
                  Notas <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>(opcional)</Text>
                </Text>
                <TextInput
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  placeholder="Notas del abono"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 24,
                  }}
                />

                <TouchableOpacity
                  onPress={handleRecordPayment}
                  style={{
                    backgroundColor: '#10B981',
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                    Registrar abono
                  </Text>
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
                <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                  Historial de abonos
                </Text>
                <TouchableOpacity onPress={() => setShowPaymentsList(false)}>
                  <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>
              {renderPaymentsContent()}
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </AnimatedTransition>
  );
}