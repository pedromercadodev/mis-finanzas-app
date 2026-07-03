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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { formatUSD, formatBS, formatDate } from '../../src/utils/format';
import {
  getSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  processDueSubscriptions,
  calculateNextBillingDate,
} from '../../src/services/subscriptions';
import { getCategories } from '../../src/services/categories';
import { getAccounts } from '../../src/services/accounts';
import type { Subscription, Category, Account, FrequencyType, CurrencyType } from '../../src/utils/types';

const FREQUENCIES: { key: FrequencyType; label: string }[] = [
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensual' },
  { key: 'yearly', label: 'Anual' },
  { key: 'custom', label: 'Personalizado' },
];

export default function SubscriptionsScreen() {
  const themeColors = useThemeColors();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmountUSD, setFormAmountUSD] = useState('');
  const [formAmountBS, setFormAmountBS] = useState('');
  const [formCurrency, setFormCurrency] = useState<CurrencyType>('USD');
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [formAccountId, setFormAccountId] = useState<number | null>(null);
  const [formFrequency, setFormFrequency] = useState<FrequencyType>('monthly');
  const [formIntervalDays, setFormIntervalDays] = useState('30');
  const [formBillingDay, setFormBillingDay] = useState('');
  const [formAutoGenerate, setFormAutoGenerate] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, cats, accs] = await Promise.all([
        getSubscriptions(),
        getCategories('expense'),
        getAccounts(),
      ]);
      setSubscriptions(subs);
      setCategories(cats);
      setAccounts(accs);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Procesar suscripciones vencidas al cargar
  useEffect(() => {
    const process = async () => {
      try {
        const processed = await processDueSubscriptions();
        if (processed.length > 0) {
          // Recargar para reflejar cambios
          loadData();
        }
      } catch (error) {
        console.error('Error processing due subscriptions:', error);
      }
    };
    if (!loading) {
      process();
    }
  }, [loading]);

  const openNewModal = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormAmountUSD('');
    setFormAmountBS('');
    setFormCurrency('USD');
    setFormCategoryId(categories.length > 0 ? categories[0].id : null);
    setFormAccountId(accounts.length > 0 ? accounts[0].id : null);
    setFormFrequency('monthly');
    setFormIntervalDays('30');
    setFormBillingDay(new Date().getDate().toString());
    setFormAutoGenerate(false);
    setFormNotes('');
    setShowModal(true);
  };

  const openEditModal = async (id: number) => {
    const sub = await getSubscriptionById(id);
    if (!sub) return;

    setEditingId(id);
    setFormName(sub.name);
    setFormDescription(sub.description || '');
    setFormAmountUSD(sub.amountUSD?.toString() || '');
    setFormAmountBS(sub.amountBS?.toString() || '');
    setFormCurrency(sub.currency);
    setFormCategoryId(sub.categoryId);
    setFormAccountId(sub.accountId);
    setFormFrequency(sub.frequency);
    setFormIntervalDays(sub.intervalDays?.toString() || '30');
    setFormBillingDay(sub.billingDay.toString());
    setFormAutoGenerate(sub.autoGenerate === 1);
    setFormNotes(sub.notes || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!formCategoryId) {
      Alert.alert('Error', 'Selecciona una categoría');
      return;
    }
    if (!formAccountId) {
      Alert.alert('Error', 'Selecciona una cuenta');
      return;
    }

    setSaving(true);
    try {
      const now = new Date();
      let nextBillingDate: string;
      let billingDay = parseInt(formBillingDay) || now.getDate();

      switch (formFrequency) {
        case 'weekly': {
          const nextDate = new Date(now);
          nextDate.setDate(nextDate.getDate() + 7);
          nextBillingDate = nextDate.toISOString().split('T')[0];
          break;
        }
        case 'monthly': {
          billingDay = parseInt(formBillingDay) || now.getDate();
          const nextDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
          if (nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
          nextBillingDate = nextDate.toISOString().split('T')[0];
          break;
        }
        case 'yearly': {
          const nextDate = new Date(now);
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          nextBillingDate = nextDate.toISOString().split('T')[0];
          break;
        }
        case 'custom': {
          const intervalDays = parseInt(formIntervalDays) || 30;
          const nextDate = new Date(now);
          nextDate.setDate(nextDate.getDate() + intervalDays);
          nextBillingDate = nextDate.toISOString().split('T')[0];
          break;
        }
        default: {
          billingDay = parseInt(formBillingDay) || now.getDate();
          const nextDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
          if (nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
          nextBillingDate = nextDate.toISOString().split('T')[0];
        }
      }

      const data = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        amountUSD: formAmountUSD ? parseFloat(formAmountUSD) : null,
        amountBS: formAmountBS ? parseFloat(formAmountBS) : null,
        currency: formCurrency,
        categoryId: formCategoryId,
        accountId: formAccountId,
        frequency: formFrequency,
        intervalDays: formFrequency === 'custom' ? (parseInt(formIntervalDays) || 30) : null,
        billingDay,
        nextBillingDate,
        isActive: 1,
        autoGenerate: formAutoGenerate ? 1 : 0,
        notes: formNotes.trim() || null,
      };

      if (editingId) {
        await updateSubscription(editingId, data);
      } else {
        await createSubscription(data);
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo guardar la suscripción');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (sub: Subscription) => {
    Alert.alert(
      'Eliminar suscripción',
      `¿Eliminar "${sub.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSubscription(sub.id);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (sub: Subscription) => {
    try {
      await updateSubscription(sub.id, { isActive: sub.isActive ? 0 : 1 });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cambiar el estado');
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const processed = await processDueSubscriptions();
      if (processed.length > 0) {
        Alert.alert(
          'Suscripciones procesadas',
          `Se generaron ${processed.length} transacciones automáticamente.`
        );
        loadData();
      } else {
        Alert.alert('Sin novedades', 'No hay suscripciones vencidas pendientes de procesar.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error al procesar');
    } finally {
      setProcessing(false);
    }
  };

  const getCategoryName = (id: number): string => {
    return categories.find((c) => c.id === id)?.name || '—';
  };

  const getAccountName = (id: number): string => {
    return accounts.find((a) => a.id === id)?.name || '—';
  };

  const getFrequencyLabel = (freq: FrequencyType): string => {
    return FREQUENCIES.find((f) => f.key === freq)?.label || freq;
  };

  const isDue = (nextDate: string): boolean => {
    return nextDate <= new Date().toISOString().split('T')[0];
  };

  const isSoon = (nextDate: string): boolean => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    return nextDate <= soon.toISOString().split('T')[0] && !isDue(nextDate);
  };

  return (
    <AnimatedTransition>
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text }}>
              Suscripciones
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={handleProcessNow}
                disabled={processing}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: themeColors.surface,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                {processing ? (
                  <ActivityIndicator size="small" color={themeColors.primary} />
                ) : (
                  <Ionicons name="refresh" size={22} color={themeColors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openNewModal}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: themeColors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
          ) : subscriptions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="repeat-outline" size={64} color={themeColors.textSecondary} />
              <Text style={{ fontSize: 16, color: themeColors.textSecondary, marginTop: 16, textAlign: 'center' }}>
                No tienes suscripciones registradas
              </Text>
              <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                Agrega Netflix, internet, alquiler y otros pagos recurrentes
              </Text>
            </View>
          ) : (
            subscriptions.map((sub) => {
              const due = isDue(sub.nextBillingDate);
              const soon = isSoon(sub.nextBillingDate);

              return (
                <TouchableOpacity
                  key={sub.id}
                  onPress={() => openEditModal(sub.id)}
                  onLongPress={() => handleDelete(sub)}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                    opacity: sub.isActive ? 1 : 0.5,
                  }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.text }}>
                          {sub.name}
                        </Text>
                        {due && (
                          <View style={{ backgroundColor: themeColors.dangerLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: themeColors.danger, fontWeight: '600' }}>VENCIDA</Text>
                          </View>
                        )}
                        {soon && !due && (
                          <View style={{ backgroundColor: themeColors.warningLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, color: themeColors.warning, fontWeight: '600' }}>PRONTO</Text>
                          </View>
                        )}
                      </View>
                      {sub.description && (
                        <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                          {sub.description}
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={sub.isActive === 1}
                      onValueChange={() => handleToggleActive(sub)}
                      trackColor={{ false: themeColors.border, true: themeColors.primary + '60' }}
                      thumbColor={sub.isActive ? themeColors.primary : '#999'}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Monto</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text }}>
                        {sub.amountUSD ? formatUSD(sub.amountUSD) : ''}
                        {sub.amountUSD && sub.amountBS ? ' / ' : ''}
                        {sub.amountBS ? formatBS(sub.amountBS) : ''}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Frecuencia</Text>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: themeColors.text }}>
                        {getFrequencyLabel(sub.frequency)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>Próximo cobro</Text>
                      <Text style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: due ? themeColors.danger : (soon ? themeColors.warning : themeColors.text),
                      }}>
                        {formatDate(sub.nextBillingDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                      📁 {getCategoryName(sub.categoryId)}
                    </Text>
                    <Text style={{ fontSize: 11, color: themeColors.textSecondary }}>
                      💳 {getAccountName(sub.accountId)}
                    </Text>
                    {sub.autoGenerate === 1 && (
                      <Text style={{ fontSize: 11, color: themeColors.success }}>🤖 Auto</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Modal de creación/edición */}
        <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Header del modal */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                    {editingId ? 'Editar suscripción' : 'Nueva suscripción'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowModal(false)}>
                    <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Nombre */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Nombre *
                </Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Ej: Netflix, Internet, Alquiler..."
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: themeColors.border,
                  }}
                />

                {/* Descripción */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Descripción
                </Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Descripción opcional"
                  placeholderTextColor={themeColors.textSecondary}
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: themeColors.border,
                  }}
                />

                {/* Montos */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
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
                        borderWidth: 1,
                        borderColor: themeColors.border,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
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
                        borderWidth: 1,
                        borderColor: themeColors.border,
                      }}
                    />
                  </View>
                </View>

                {/* Moneda */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Moneda
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      onPress={() => setFormCurrency(cur)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: formCurrency === cur ? themeColors.primary : themeColors.surface,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: formCurrency === cur ? themeColors.primary : themeColors.border,
                      }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: formCurrency === cur ? '#FFFFFF' : themeColors.textSecondary,
                      }}>
                        {cur === 'USD' ? '💲 USD' : cur === 'BS' ? '💵 BS' : '🌎 Ambas'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Categoría */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Categoría *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setFormCategoryId(cat.id)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: formCategoryId === cat.id ? cat.color + '30' : themeColors.surface,
                          borderWidth: 1,
                          borderColor: formCategoryId === cat.id ? cat.color : themeColors.border,
                        }}>
                        <Text style={{ fontSize: 14, color: formCategoryId === cat.id ? cat.color : themeColors.text }}>
                          {cat.icon} {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Cuenta */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Cuenta *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {accounts.filter((a) => a.isActive).map((acc) => (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => setFormAccountId(acc.id)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 12,
                          backgroundColor: formAccountId === acc.id ? acc.color + '30' : themeColors.surface,
                          borderWidth: 1,
                          borderColor: formAccountId === acc.id ? acc.color : themeColors.border,
                        }}>
                        <Text style={{ fontSize: 14, color: formAccountId === acc.id ? acc.color : themeColors.text }}>
                          {acc.icon} {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Frecuencia */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Frecuencia
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setFormFrequency(f.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: formFrequency === f.key ? themeColors.primary : themeColors.surface,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: formFrequency === f.key ? themeColors.primary : themeColors.border,
                      }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: formFrequency === f.key ? '#FFFFFF' : themeColors.textSecondary,
                      }}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Día de cobro */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Día de cobro
                </Text>
                <TextInput
                  value={formBillingDay}
                  onChangeText={setFormBillingDay}
                  placeholder="1-31"
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: themeColors.surface,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: themeColors.text,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: themeColors.border,
                  }}
                />

                {/* Intervalo personalizado (solo si frecuencia = custom) */}
                {formFrequency === 'custom' && (
                  <>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                      Intervalo (días)
                    </Text>
                    <TextInput
                      value={formIntervalDays}
                      onChangeText={setFormIntervalDays}
                      placeholder="30"
                      placeholderTextColor={themeColors.textSecondary}
                      keyboardType="number-pad"
                      style={{
                        backgroundColor: themeColors.surface,
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 16,
                        color: themeColors.text,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: themeColors.border,
                      }}
                    />
                  </>
                )}

                {/* Auto-generar */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '500', color: themeColors.text }}>
                      Generar transacción automáticamente
                    </Text>
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                      Si está activo, se creará un gasto automático en la fecha de cobro
                    </Text>
                  </View>
                  <Switch
                    value={formAutoGenerate}
                    onValueChange={setFormAutoGenerate}
                    trackColor={{ false: themeColors.border, true: themeColors.primary + '60' }}
                    thumbColor={formAutoGenerate ? themeColors.primary : '#999'}
                  />
                </View>

                {/* Notas */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                  Notas
                </Text>
                <TextInput
                  value={formNotes}
                  onChangeText={setFormNotes}
                  placeholder="Notas adicionales..."
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
                    borderWidth: 1,
                    borderColor: themeColors.border,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />

                {/* Botón guardar */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={{
                    backgroundColor: themeColors.primary,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                    opacity: saving ? 0.6 : 1,
                  }}>
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                      {editingId ? 'Actualizar suscripción' : 'Crear suscripción'}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </AnimatedTransition>
  );
}
