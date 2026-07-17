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
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
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

const SUBSCRIPTION_TEMPLATES = [
  { name: 'Netflix', amountUSD: 17.99, amountBS: null, category: 'Entretenimiento', icon: 'film' as const },
  { name: 'Spotify', amountUSD: 10.99, amountBS: null, category: 'Entretenimiento', icon: 'musical-notes' as const },
  { name: 'Disney+', amountUSD: 9.99, amountBS: null, category: 'Entretenimiento', icon: 'tv' as const },
  { name: 'HBO Max', amountUSD: 9.99, amountBS: null, category: 'Entretenimiento', icon: 'play-circle' as const },
  { name: 'Amazon Prime', amountUSD: 14.99, amountBS: null, category: 'Compras', icon: 'cube' as const },
  { name: 'YouTube Premium', amountUSD: 11.99, amountBS: null, category: 'Entretenimiento', icon: 'logo-youtube' as const },
  { name: 'Internet Hogar', amountUSD: null, amountBS: null, category: 'Servicios', icon: 'wifi' as const },
  { name: 'Plan Móvil', amountUSD: null, amountBS: null, category: 'Servicios', icon: 'phone-portrait' as const },
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

  const selectTemplate = (template: typeof SUBSCRIPTION_TEMPLATES[0]) => {
    setFormName(template.name);
    if (template.amountUSD !== null) {
      setFormAmountUSD(String(template.amountUSD));
      setFormCurrency('USD');
    }
    if (template.amountBS !== null) {
      setFormAmountBS(String(template.amountBS));
      setFormCurrency(template.amountUSD !== null ? 'BOTH' : 'BS');
    }
    // Buscar categoría por nombre
    const cat = categories.find(
      (c) => c.name.toLowerCase() === template.category.toLowerCase()
    );
    if (cat) {
      setFormCategoryId(cat.id);
    }
    setFormFrequency('monthly');
    setFormIntervalDays('30');
    setFormBillingDay(new Date().getDate().toString());
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

  // Calcular estadísticas
  const activeSubs = subscriptions.filter(s => s.isActive === 1);
  const pausedSubs = subscriptions.filter(s => s.isActive === 0);
  const monthlyEstimate = activeSubs.reduce((sum, s) => sum + (s.amountUSD || 0), 0);

  const getStatusInfo = (sub: Subscription): { borderColor: string; badgeLabel: string; badgeBg: string; badgeColor: string; statusIcon: string; statusText: string; statusColor: string } => {
    const due = isDue(sub.nextBillingDate);
    const soon = isSoon(sub.nextBillingDate);

    if (!sub.isActive) {
      return {
        borderColor: themeColors.outlineVariant,
        badgeLabel: 'Pausado',
        badgeBg: themeColors.surfaceContainerHigh,
        badgeColor: themeColors.outline,
        statusIcon: 'pause-circle-outline',
        statusText: 'Pausado indefinidamente',
        statusColor: themeColors.onSurfaceVariant,
      };
    }
    if (due) {
      return {
        borderColor: themeColors.danger,
        badgeLabel: 'VENCIDA',
        badgeBg: themeColors.danger + '20',
        badgeColor: themeColors.danger,
        statusIcon: 'warning-outline',
        statusText: 'Pago fallido hace 2 días',
        statusColor: themeColors.danger,
      };
    }
    if (soon) {
      return {
        borderColor: themeColors.tertiary,
        badgeLabel: 'PRONTO',
        badgeBg: themeColors.tertiary + '30',
        badgeColor: themeColors.tertiary,
        statusIcon: 'time-outline',
        statusText: `Mañana (Queda 1 día)`,
        statusColor: themeColors.tertiary,
      };
    }
    return {
      borderColor: themeColors.secondary,
      badgeLabel: 'Activo',
      badgeBg: themeColors.secondary + '20',
      badgeColor: themeColors.secondary,
      statusIcon: 'calendar-outline',
      statusText: `${formatDate(sub.nextBillingDate)}`,
      statusColor: themeColors.onSurfaceVariant,
    };
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
              Suscripciones
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={openNewModal}
            accessibilityLabel="Crear nueva suscripción"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add-circle" size={28} color={themeColors.secondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={themeColors.secondary} />
          </View>
        ) : subscriptions.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
            <Ionicons name="repeat-outline" size={64} color={themeColors.onSurfaceVariant} />
            <ThemedText type="body" themeColor="onSurfaceVariant" style={{ marginTop: 16, textAlign: 'center' }}>
              No tienes suscripciones registradas
            </ThemedText>
            <ThemedText type="small" themeColor="onSurfaceVariant" style={{ marginTop: 8, textAlign: 'center' }}>
              Agrega Netflix, internet, alquiler y otros pagos recurrentes
            </ThemedText>
          </View>
        ) : (
          <>
            {/* Summary Dashboard - Glass card */}
            <View style={{
              paddingHorizontal: 24,
              marginBottom: 24,
              marginTop: 8,
            }}>
              <View style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 16,
                padding: 24,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View>
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                      Gasto Mensual Estimado
                    </ThemedText>
                    <ThemedText type="h2" themeColor="secondary" style={{ fontWeight: '700', letterSpacing: -0.5, marginTop: 8 }}>
                      {formatUSD(monthlyEstimate)}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{
                      backgroundColor: themeColors.surfaceContainerHigh,
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '50',
                    }}>
                      <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Activas
                      </ThemedText>
                      <ThemedText type="h4" themeColor="text" style={{ textAlign: 'center', marginTop: 2 }}>
                        {activeSubs.length}
                      </ThemedText>
                    </View>
                    <View style={{
                      backgroundColor: themeColors.surfaceContainerHigh,
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '50',
                    }}>
                      <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
                        Pausadas
                      </ThemedText>
                      <ThemedText type="h4" themeColor="text" style={{ textAlign: 'center', marginTop: 2 }}>
                        {pausedSubs.length}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Subscription Cards */}
            <View style={{ paddingHorizontal: 24, gap: 12 }}>
              {subscriptions.map((sub) => {
                const status = getStatusInfo(sub);
                return (
                  <TouchableOpacity
                    key={sub.id}
                    onPress={() => openEditModal(sub.id)}
                    onLongPress={() => handleDelete(sub)}
                    accessibilityLabel={`Suscripción: ${sub.name}`}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      borderRadius: 16,
                      padding: 20,
                      borderLeftWidth: 4,
                      borderLeftColor: status.borderColor,
                      borderWidth: 1,
                      borderColor: themeColors.outlineVariant + '30',
                      opacity: sub.isActive ? 1 : 0.75,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <View style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          backgroundColor: themeColors.surfaceVariant,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                          <Ionicons
                            name={sub.name.toLowerCase().includes('netflix') ? 'film' :
                              sub.name.toLowerCase().includes('spotify') ? 'musical-notes' :
                              sub.name.toLowerCase().includes('disney') ? 'tv' :
                              sub.name.toLowerCase().includes('hbo') ? 'play-circle' :
                              sub.name.toLowerCase().includes('amazon') ? 'cube' :
                              sub.name.toLowerCase().includes('youtube') ? 'logo-youtube' :
                              sub.name.toLowerCase().includes('internet') || sub.name.toLowerCase().includes('wifi') ? 'wifi' :
                              sub.name.toLowerCase().includes('móvil') || sub.name.toLowerCase().includes('celular') || sub.name.toLowerCase().includes('phone') ? 'phone-portrait' :
                              'card-outline'}
                            size={22}
                            color={themeColors.text}
                          />
                        </View>
                        <View>
                          <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                            {sub.name}
                          </ThemedText>
                          {sub.description && (
                            <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                              {sub.description}
                            </ThemedText>
                          )}
                        </View>
                      </View>
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: status.badgeBg,
                      }}>
                        <ThemedText type="caption" color={status.badgeColor} style={{ fontWeight: '600', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {status.badgeLabel}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <View>
                        <ThemedText type="h3" themeColor="text" style={{ fontWeight: '700' }}>
                          {sub.amountUSD ? formatUSD(sub.amountUSD) : ''}
                          {sub.amountUSD && sub.amountBS ? ' / ' : ''}
                          {sub.amountBS ? formatBS(sub.amountBS) : ''}
                          <ThemedText type="caption" themeColor="onSurfaceVariant">
                            /mes
                          </ThemedText>
                        </ThemedText>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Ionicons name={status.statusIcon as any} size={14} color={status.statusColor} />
                          <ThemedText type="caption" color={status.statusColor} style={{ fontSize: 12 }}>
                            {status.statusText}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* Toggle Switch */}
                        <TouchableOpacity
                          onPress={() => handleToggleActive(sub)}
                          style={{
                            width: 40,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: sub.isActive ? themeColors.secondary + '60' : themeColors.surfaceContainerHigh,
                            justifyContent: 'center',
                            paddingHorizontal: 2,
                          }}
                        >
                          <View style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: sub.isActive ? themeColors.secondary : themeColors.onSurfaceVariant,
                            alignSelf: sub.isActive ? 'flex-end' : 'flex-start',
                          }} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDelete(sub)}
                          accessibilityLabel={`Eliminar ${sub.name}`}
                        >
                          <Ionicons name="trash-outline" size={20} color={themeColors.onSurfaceVariant} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
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
                <ThemedText type="h2" themeColor="text">
                  {editingId ? 'Editar suscripción' : 'Nueva suscripción'}
                </ThemedText>
                <TouchableOpacity onPress={() => setShowModal(false)} accessibilityLabel="Cerrar modal">
                  <Ionicons name="close" size={28} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Plantillas rápidas */}
              {!editingId && (
                <>
                  <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 8 }}>
                    Plantillas rápidas
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {SUBSCRIPTION_TEMPLATES.map((template, index) => (
                        <TouchableOpacity
                          key={index}
                          onPress={() => selectTemplate(template)}
                          accessibilityLabel={`Seleccionar plantilla ${template.name}`}
                          style={{
                            backgroundColor: themeColors.surfaceContainer,
                            borderRadius: 12,
                            padding: 12,
                            minWidth: 100,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: themeColors.outlineVariant + '50',
                          }}>
                          <Ionicons
                            name={template.icon as any}
                            size={24}
                            color={themeColors.secondary}
                            style={{ marginBottom: 6 }}
                          />
                          <ThemedText type="small" themeColor="text" style={{ fontWeight: '600', textAlign: 'center' }}>
                            {template.name}
                          </ThemedText>
                          {template.amountUSD !== null && (
                            <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                              {formatUSD(template.amountUSD)}
                            </ThemedText>
                          )}
                          {template.amountBS !== null && (
                            <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 2 }}>
                              {formatBS(template.amountBS)}
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}

              {/* Nombre */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Nombre *
              </ThemedText>
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="Ej: Netflix, Internet, Alquiler..."
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

              {/* Descripción */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Descripción
              </ThemedText>
              <TextInput
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Descripción opcional"
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

              {/* Montos */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
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
              </View>

              {/* Moneda */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Moneda
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    onPress={() => setFormCurrency(cur)}
                    accessibilityLabel={`Seleccionar moneda ${cur === 'USD' ? 'USD' : cur === 'BS' ? 'Bolívares' : 'Ambas'}`}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: formCurrency === cur ? themeColors.secondaryContainer + '33' : themeColors.surfaceContainer,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: formCurrency === cur ? themeColors.secondary : themeColors.outlineVariant + '50',
                    }}>
                    <ThemedText type="buttonSmall" themeColor={formCurrency === cur ? 'secondary' : 'onSurfaceVariant'}>
                      {cur === 'USD' ? 'USD' : cur === 'BS' ? 'BS' : 'Ambas'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Categoría */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Categoría *
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setFormCategoryId(cat.id)}
                      accessibilityLabel={`Seleccionar categoría ${cat.name}`}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: formCategoryId === cat.id ? cat.color + '30' : themeColors.surfaceContainer,
                        borderWidth: 1,
                        borderColor: formCategoryId === cat.id ? cat.color : themeColors.outlineVariant + '50',
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name={getIcon(cat.icon)} size={16} color={formCategoryId === cat.id ? cat.color : themeColors.text} />
                        <ThemedText type="body" color={formCategoryId === cat.id ? cat.color : themeColors.text}>
                          {cat.name}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Cuenta */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Cuenta *
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {accounts.filter((a) => a.isActive).map((acc) => (
                    <TouchableOpacity
                      key={acc.id}
                      onPress={() => setFormAccountId(acc.id)}
                      accessibilityLabel={`Seleccionar cuenta ${acc.name}`}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: formAccountId === acc.id ? acc.color + '30' : themeColors.surfaceContainer,
                        borderWidth: 1,
                        borderColor: formAccountId === acc.id ? acc.color : themeColors.outlineVariant + '50',
                      }}>
                      <ThemedText type="body" color={formAccountId === acc.id ? acc.color : themeColors.text}>
                        {acc.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Frecuencia */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Frecuencia
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {FREQUENCIES.map((freq) => (
                  <TouchableOpacity
                    key={freq.key}
                    onPress={() => setFormFrequency(freq.key)}
                    accessibilityLabel={`Frecuencia ${freq.label}`}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: formFrequency === freq.key ? themeColors.secondaryContainer + '33' : themeColors.surfaceContainer,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: formFrequency === freq.key ? themeColors.secondary : themeColors.outlineVariant + '50',
                    }}>
                    <ThemedText type="buttonSmall" themeColor={formFrequency === freq.key ? 'secondary' : 'onSurfaceVariant'}>
                      {freq.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Días de intervalo (custom) */}
              {formFrequency === 'custom' && (
                <>
                  <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                    Días entre pagos
                  </ThemedText>
                  <TextInput
                    value={formIntervalDays}
                    onChangeText={setFormIntervalDays}
                    placeholder="30"
                    placeholderTextColor={themeColors.onSurfaceVariant}
                    keyboardType="number-pad"
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
                </>
              )}

              {/* Día de facturación */}
              {formFrequency === 'monthly' && (
                <>
                  <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                    Día de facturación
                  </ThemedText>
                  <TextInput
                    value={formBillingDay}
                    onChangeText={setFormBillingDay}
                    placeholder="15"
                    placeholderTextColor={themeColors.onSurfaceVariant}
                    keyboardType="number-pad"
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
                </>
              )}

              {/* Auto-generar transacciones */}
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '50',
              }}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    Auto-generar transacciones
                  </ThemedText>
                  <ThemedText type="caption" themeColor="onSurfaceVariant">
                    Crear automáticamente al vencer
                  </ThemedText>
                </View>
                <Switch
                  value={formAutoGenerate}
                  onValueChange={setFormAutoGenerate}
                  trackColor={{ false: themeColors.surfaceContainerHighest, true: themeColors.secondary + '60' }}
                  thumbColor={formAutoGenerate ? themeColors.secondary : themeColors.outline}
                />
              </View>

              {/* Notas */}
              <ThemedText type="small" themeColor="onSurfaceVariant" style={{ fontWeight: '600', marginBottom: 6 }}>
                Notas
              </ThemedText>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Notas adicionales..."
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

              {/* Botón guardar */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                accessibilityLabel="Guardar suscripción"
                style={{
                  backgroundColor: themeColors.secondary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  marginBottom: 40,
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving ? (
                  <ActivityIndicator color={themeColors.background} />
                ) : (
                  <ThemedText type="button" color={themeColors.background} style={{ fontWeight: '700' }}>
                    {editingId ? 'Actualizar suscripción' : 'Crear suscripción'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
