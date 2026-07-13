import { useCallback, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { shadows } from '../../src/theme/shadows';
import { getGoals, createGoal, deleteGoal, markGoalCelebrated, updateGoalProgress } from '../../src/services/goals';
import { getItemsByGoalId, createItem, deleteItem, toggleItemCompleted, recalculateGoalProgress } from '../../src/services/goalItems';
import { formatUSD, formatBS } from '../../src/utils/format';
import type { Goal, GoalItem, GoalWithItems } from '../../src/utils/types';

const ENCOURAGEMENT_MESSAGES: Record<number, string> = {
  10: '¡Primer paso! Todo gran logro comienza con una decisión. ¡Sigue así!',
  25: '¡Vas muy bien! Ya llevas un cuarto del camino recorrido.',
  50: '¡Vas por la mitad! Esto significa que puedes lograr lo que te propongas.',
  75: '¡Ya casi lo logras! La recta final es tuya, no te rindas ahora.',
  90: '¡Estás a nada de completarlo! El esfuerzo vale la pena.',
};

const NO_PROGRESS_MESSAGES = [
  (name: string) => `¡Ánimo! Esta semana aún no has abonado a tu meta "${name}". Cada pequeño paso cuenta.`,
  (name: string) => `Recuerda tu meta "${name}". El éxito es la suma de pequeños esfuerzos repetidos día tras día.`,
  (name: string) => `No olvides tu meta "${name}". Hoy es un buen día para seguir avanzando.`,
  (name: string) => `Tu meta "${name}" te espera. ¡Un poco cada día hace la diferencia!`,
  (name: string) => `¿Ya abonaste a "${name}"? El momento perfecto para empezar es ahora.`,
];

export default function GoalsScreen() {
  const themeColors = useThemeColors();
  const [goals, setGoals] = useState<GoalWithItems[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'BS'>('USD');
  const [periodType, setPeriodType] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('success');
  const [expandedGoalId, setExpandedGoalId] = useState<number | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemGoalId, setItemGoalId] = useState<number | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemTarget, setItemTarget] = useState('');
  const [celebrationGoal, setCelebrationGoal] = useState<Goal | null>(null);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositGoalId, setDepositGoalId] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState('');

  // Ref para rastrear progreso anterior de cada meta (evita repetir mensajes)
  const prevProgressRef = useRef<Map<number, number>>(new Map());
  // Ref para rastrear metas que ya recibieron recordatorio semanal en esta sesión
  const weeklyRemindedRef = useRef<Set<number>>(new Set());

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  const getToastBgColor = () => {
    switch (toastType) {
      case 'success': return themeColors.success;
      case 'info': return themeColors.primary;
      case 'error': return themeColors.danger;
      default: return themeColors.text;
    }
  };

  const loadData = async () => {
    const data = await getGoals();
    // Cargar items para cada meta
    const goalsWithItems: GoalWithItems[] = [];
    for (const goal of data) {
      const items = await getItemsByGoalId(goal.id);
      goalsWithItems.push({ ...goal, items });
    }
    setGoals(goalsWithItems);

    // Verificar mensajes alentadores y celebración
    for (const goal of goalsWithItems) {
      const progress = goal.targetAmount > 0
        ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
        : 0;
      const prev = prevProgressRef.current.get(goal.id) ?? 0;

      // Verificar umbrales de progreso
      const thresholds = [10, 25, 50, 75, 90];
      for (const threshold of thresholds) {
        if (prev < threshold && progress >= threshold) {
          showToast(ENCOURAGEMENT_MESSAGES[threshold], 'info');
        }
      }

      // Verificar si se completó (100%) y no se ha celebrado
      if (progress >= 100 && !goal.celebratedAt && !celebrationGoal) {
        setCelebrationGoal(goal);
      }

      prevProgressRef.current.set(goal.id, progress);

      // Verificar recordatorio semanal para metas weekly sin progreso
      if (goal.periodType === 'weekly' && !weeklyRemindedRef.current.has(goal.id)) {
        if (goal.lastProgressAt) {
          const lastProgress = new Date(goal.lastProgressAt + 'Z');
          const now = new Date();
          const diffDays = (now.getTime() - lastProgress.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 7) {
            const randomIdx = Math.floor(Math.random() * NO_PROGRESS_MESSAGES.length);
            showToast(NO_PROGRESS_MESSAGES[randomIdx](goal.name), 'info');
            weeklyRemindedRef.current.add(goal.id);
          }
        } else if (goal.currentAmount === 0) {
          // Nunca ha tenido progreso y pasó 1+ día desde creación
          const created = new Date(goal.createdAt + 'Z');
          const now = new Date();
          const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= 1) {
            const randomIdx = Math.floor(Math.random() * NO_PROGRESS_MESSAGES.length);
            showToast(NO_PROGRESS_MESSAGES[randomIdx](goal.name), 'info');
            weeklyRemindedRef.current.add(goal.id);
          }
        }
      }
    }
  };

  // Recargar datos cada vez que la pantalla obtiene foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!name.trim() || !targetAmount) {
      Alert.alert('Error', 'Completa todos los campos requeridos');
      return;
    }
    const target = parseFloat(targetAmount);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Error', 'Ingresa un monto objetivo válido');
      return;
    }
    let deadline: string | null = null;
    if (periodType === 'none' && hasDeadline && deadlineDate.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(deadlineDate.trim())) {
        Alert.alert('Error', 'La fecha debe tener formato YYYY-MM-DD (ej: 2026-12-31)');
        return;
      }
      deadline = deadlineDate.trim();
    }
    await createGoal({
      name: name.trim(),
      targetAmount: target,
      currentAmount: 0,
      currency,
      accountId: null,
      deadline,
      periodType,
      celebratedAt: null,
      lastProgressAt: null,
    });
    setShowModal(false);
    setName('');
    setTargetAmount('');
    setCurrency('USD');
    setPeriodType('none');
    setHasDeadline(false);
    setDeadlineDate('');
    await loadData();
    showToast('🎯 Meta creada correctamente', 'success');
  };

  const handleDelete = (id: number, goalName: string) => {
    Alert.alert('Eliminar meta', `¿Estás seguro de eliminar "${goalName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteGoal(id);
        await loadData();
        showToast('🗑️ Meta eliminada', 'success');
      }},
    ]);
  };

  const toggleExpand = (goalId: number) => {
    setExpandedGoalId(expandedGoalId === goalId ? null : goalId);
  };

  const openNewItemModal = (goalId: number) => {
    setItemGoalId(goalId);
    setItemName('');
    setItemTarget('');
    setShowItemModal(true);
  };

  const handleCreateItem = async () => {
    if (!itemName.trim() || !itemTarget || itemGoalId === null) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    const target = parseFloat(itemTarget);
    if (isNaN(target) || target <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    await createItem({
      goalId: itemGoalId,
      name: itemName.trim(),
      targetAmount: target,
      currentAmount: 0,
      isCompleted: 0,
      sortOrder: 0,
    });
    // Recalcular el progreso de la meta sumando todos los items
    await recalculateGoalProgress(itemGoalId);
    setShowItemModal(false);
    setItemName('');
    setItemTarget('');
    await loadData();
    showToast('✅ Ítem agregado', 'success');
  };

  const handleToggleItem = async (item: GoalItem) => {
    await toggleItemCompleted(item.id);
    await recalculateGoalProgress(item.goalId);
    await loadData();
  };

  const handleDeleteItem = (item: GoalItem) => {
    Alert.alert('Eliminar ítem', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteItem(item.id);
        await recalculateGoalProgress(item.goalId);
        await loadData();
        showToast('🗑️ Ítem eliminado', 'success');
      }},
    ]);
  };

  const handleCelebrate = async () => {
    if (celebrationGoal) {
      await markGoalCelebrated(celebrationGoal.id);
      setCelebrationGoal(null);
      await loadData();
    }
  };

  const openDepositModal = (goalId: number) => {
    setDepositGoalId(goalId);
    setDepositAmount('');
    setShowDepositModal(true);
  };

  const handleDeposit = async () => {
    if (!depositAmount || depositGoalId === null) {
      Alert.alert('Error', 'Ingresa un monto');
      return;
    }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    // Actualizar el progreso de la meta
    await updateGoalProgress(depositGoalId, amount);
    setShowDepositModal(false);
    setDepositAmount('');
    await loadData();
    showToast('💰 Abono registrado correctamente', 'success');
  };

  const getPeriodLabel = (pt: string) => {
    switch (pt) {
      case 'weekly': return '📅 Semanal';
      case 'monthly': return '📅 Mensual';
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <ThemedText type="h1" themeColor="text">
            Metas
          </ThemedText>
          <TouchableOpacity
            onPress={() => setShowModal(true)}
            accessibilityLabel="Crear nueva meta"
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <ThemedText style={{ color: '#FFF' }} type="button">Nueva</ThemedText>
          </TouchableOpacity>
        </View>

        {goals.map((goal) => {
          const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
          const isExpanded = expandedGoalId === goal.id;
          const completedItems = goal.items.filter(i => i.isCompleted === 1).length;
          const periodLabel = getPeriodLabel(goal.periodType);

          // Círculo de progreso con dos semicírculos (soporta 0-100%)
          const progressFraction = progress / 100;
          const halfSize = 40; // radio
          const borderW = 6;

          return (
            <View key={goal.id} style={{ marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => toggleExpand(goal.id)}
                onLongPress={() => handleDelete(goal.id, goal.name)}
                accessibilityLabel={`Meta: ${goal.name}, ${Math.round(progress)}% completada`}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 20,
                  padding: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  ...shadows.md,
                }}
              >
                <View style={{ width: 90, height: 90, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                  {/* Círculo de fondo (gris) */}
                  <View style={{
                    width: 80, height: 80, borderRadius: 40, borderWidth: borderW,
                    borderColor: themeColors.border, position: 'absolute',
                  }} />
                  {/* Círculo de progreso con dos semicírculos */}
                  {progress > 0 && progress < 100 && (
                    <>
                      {/* Semicírculo izquierdo: se muestra cuando progress > 50% */}
                      {progressFraction > 0.5 && (
                        <View style={{
                          width: halfSize, height: 80, position: 'absolute',
                          left: 0, overflow: 'hidden',
                        }}>
                          <View style={{
                            width: 80, height: 80, borderRadius: 40, borderWidth: borderW,
                            borderColor: themeColors.primary, position: 'absolute',
                            left: 0,
                            borderRightColor: 'transparent', borderBottomColor: 'transparent',
                            transform: [{ rotate: `${-90 + (progressFraction - 0.5) * 360}deg` }],
                          }} />
                        </View>
                      )}
                      {/* Semicírculo derecho: se muestra siempre que progress > 0 */}
                      <View style={{
                        width: halfSize, height: 80, position: 'absolute',
                        right: 0, overflow: 'hidden',
                      }}>
                        <View style={{
                          width: 80, height: 80, borderRadius: 40, borderWidth: borderW,
                          borderColor: themeColors.primary, position: 'absolute',
                          right: 0,
                          borderLeftColor: 'transparent', borderBottomColor: 'transparent',
                          transform: [{ rotate: `${-90 + Math.min(progressFraction, 0.5) * 360}deg` }],
                        }} />
                      </View>
                    </>
                  )}
                  {/* Círculo completo al 100% */}
                  {progress >= 100 && (
                    <View style={{
                      width: 80, height: 80, borderRadius: 40, borderWidth: borderW,
                      borderColor: themeColors.primary, position: 'absolute',
                    }} />
                  )}
                  <ThemedText type="h3" themeColor="primary">
                    {Math.round(progress)}%
                  </ThemedText>
                </View>
                <View style={{ flex: 1, flexShrink: 1 }}>
                  <ThemedText
                    type="body"
                    themeColor="text"
                    style={{ marginBottom: 4 }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {goal.name}
                  </ThemedText>
                  <ThemedText type="body" themeColor="textSecondary">
                    {goal.currency === 'USD' ? formatUSD(goal.currentAmount) : formatBS(goal.currentAmount)}
                    {' / '}
                    {goal.currency === 'USD' ? formatUSD(goal.targetAmount) : formatBS(goal.targetAmount)}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {periodLabel && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {periodLabel}
                      </ThemedText>
                    )}
                    {goal.deadline && (
                      <ThemedText type="caption" themeColor="textSecondary">
                        {goal.deadline}
                      </ThemedText>
                    )}
                  </View>
                  {goal.items.length > 0 && (
                    <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 4 }}>
                      {completedItems}/{goal.items.length} ítems
                    </ThemedText>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); openDepositModal(goal.id); }}
                    accessibilityLabel={`Abonar a meta ${goal.name}`}
                    style={{
                      backgroundColor: '#10B981',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                  >
                    <ThemedText style={{ color: '#FFF' }} type="badge">
                      Abonar
                    </ThemedText>
                  </TouchableOpacity>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={themeColors.textSecondary}
                  />
                </View>
              </TouchableOpacity>

              {/* Sub-ítems expandibles */}
              {isExpanded && (
                <View style={{
                  backgroundColor: themeColors.surface,
                  marginTop: -16,
                  paddingTop: 20,
                  paddingHorizontal: 20,
                  paddingBottom: 16,
                  borderRadius: 20,
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                }}>
                  {goal.items.length === 0 && (
                    <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: 12 }}>
                      Sin sub-ítems aún. ¡Agrega los componentes de tu meta!
                    </ThemedText>
                  )}
                  {goal.items.map((item) => {
                    const itemProgress = item.targetAmount > 0
                      ? Math.round((item.currentAmount / item.targetAmount) * 100)
                      : 0;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleToggleItem(item)}
                        onLongPress={() => handleDeleteItem(item)}
                        accessibilityLabel={`Ítem: ${item.name}, ${itemProgress}% completado. Presiona para marcar como ${item.isCompleted ? 'pendiente' : 'completado'}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: themeColors.border,
                        }}
                      >
                        <View style={{
                          width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                          borderColor: item.isCompleted ? '#10B981' : themeColors.border,
                          backgroundColor: item.isCompleted ? '#10B981' : 'transparent',
                          justifyContent: 'center', alignItems: 'center', marginRight: 12,
                        }}>
                          {item.isCompleted === 1 && (
                            <Ionicons name="checkmark" size={16} color="#FFF" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText
                            type="body"
                            themeColor="text"
                            style={{ textDecorationLine: item.isCompleted === 1 ? 'line-through' : 'none' }}
                          >
                            {item.name}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textSecondary">
                            {goal.currency === 'USD' ? formatUSD(item.currentAmount) : formatBS(item.currentAmount)}
                            {' / '}
                            {goal.currency === 'USD' ? formatUSD(item.targetAmount) : formatBS(item.targetAmount)}
                            {'  ·  '}{itemProgress}%
                          </ThemedText>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => openNewItemModal(goal.id)}
                    accessibilityLabel={`Agregar ítem a meta ${goal.name}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 12,
                      marginTop: 4,
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={themeColors.primary} />
                    <ThemedText type="body" themeColor="primary">
                      Agregar ítem
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {goals.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎯</Text>
            <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              No tienes metas aún.{'\n'}¡Crea tu primera meta de ahorro!
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* Toast Notification */}
      {toastVisible && (
        <View style={{
          position: 'absolute',
          bottom: 120,
          left: 20,
          right: 20,
          backgroundColor: getToastBgColor(),
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          ...shadows.lg,
        }}>
          <ThemedText style={{ color: '#FFF' }} type="button">
            {toastMessage}
          </ThemedText>
        </View>
      )}

      {/* Modal Celebración */}
      <Modal visible={celebrationGoal !== null} animationType="fade" transparent>
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center', padding: 40,
        }}>
          <View style={{
            backgroundColor: themeColors.surface, borderRadius: 24,
            padding: 32, alignItems: 'center', width: '100%', maxWidth: 320,
          }}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🎉🎊🎉</Text>
            <ThemedText type="h2" themeColor="text" style={{ marginBottom: 8 }}>
              ¡Meta Completada!
            </ThemedText>
            <ThemedText type="h3" themeColor="primary" style={{ marginBottom: 12 }}>
              "{celebrationGoal?.name}"
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: 24 }}>
              Has alcanzado tu meta de {'\n'}
              {celebrationGoal?.currency === 'USD'
                ? formatUSD(celebrationGoal?.targetAmount ?? 0)
                : formatBS(celebrationGoal?.targetAmount ?? 0)}
              {' '}en ahorros.
              {'\n'}¡Eres increíble, nunca dejes de soñar!
            </ThemedText>
            <TouchableOpacity
              onPress={handleCelebrate}
              accessibilityLabel="Celebrar meta completada"
              style={{
                backgroundColor: '#F59E0B',
                borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
              }}
            >
              <ThemedText style={{ color: '#FFF' }} type="button">
                Celebrar!
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Nueva Meta */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  Nueva Meta
                </ThemedText>
                <TouchableOpacity onPress={() => setShowModal(false)} accessibilityLabel="Cerrar modal de nueva meta">
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Nombre de la meta
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ej: Computadora nueva"
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                  fontSize: 15, color: themeColors.text, marginBottom: 16,
                  ...shadows.sm,
                }}
              />

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Moneda
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['USD', 'BS'] as const).map((cur) => (
                  <TouchableOpacity
                    key={cur}
                    onPress={() => setCurrency(cur)}
                    accessibilityLabel={`Seleccionar moneda ${cur === 'USD' ? 'USD' : 'Bolívares'}`}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 10,
                      backgroundColor: currency === cur ? themeColors.primary : themeColors.surface,
                      alignItems: 'center',
                      ...(currency === cur ? shadows.primary : shadows.sm),
                    }}
                  >
                    <ThemedText
                      type="button"
                      color={currency === cur ? '#FFF' : themeColors.text}
                    >
                      {cur === 'USD' ? '$ USD' : 'Bs'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Tipo de plazo
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['none', 'weekly', 'monthly'] as const).map((pt) => (
                  <TouchableOpacity
                    key={pt}
                    onPress={() => setPeriodType(pt)}
                    accessibilityLabel={`Seleccionar plazo ${pt === 'none' ? 'sin fecha' : pt === 'weekly' ? 'semanal' : 'mensual'}`}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10,
                      backgroundColor: periodType === pt ? themeColors.primary : themeColors.surface,
                      alignItems: 'center',
                      ...(periodType === pt ? shadows.primary : shadows.sm),
                    }}
                  >
                    <ThemedText
                      type="buttonSmall"
                      color={periodType === pt ? '#FFF' : themeColors.text}
                    >
                      {pt === 'none' ? 'Sin fecha' : pt === 'weekly' ? 'Semanal' : 'Mensual'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Monto objetivo
              </ThemedText>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="Ej: 5000.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                  fontSize: 18, fontWeight: '600', color: themeColors.text, marginBottom: 16,
                  ...shadows.sm,
                }}
              />

              {/* Fecha límite solo si periodType es 'none' */}
              {periodType === 'none' && (
                <>
                  <TouchableOpacity
                    onPress={() => setHasDeadline(!hasDeadline)}
                    accessibilityLabel={hasDeadline ? 'Quitar fecha límite' : 'Establecer fecha límite'}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}
                  >
                    <View style={{
                      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                      borderColor: hasDeadline ? themeColors.primary : themeColors.border,
                      backgroundColor: hasDeadline ? themeColors.primary : 'transparent',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      {hasDeadline && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <ThemedText type="body" themeColor="text">
                      Establecer fecha límite
                    </ThemedText>
                  </TouchableOpacity>

                  {hasDeadline && (
                    <>
                      <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                        Fecha límite (YYYY-MM-DD)
                      </ThemedText>
                      <TextInput
                        value={deadlineDate}
                        onChangeText={setDeadlineDate}
                        placeholder="Ej: 2026-12-31"
                        placeholderTextColor={themeColors.textSecondary}
                        keyboardType="numbers-and-punctuation"
                        style={{
                          backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                          fontSize: 15, color: themeColors.text, marginBottom: 24,
                          borderWidth: 1, borderColor: themeColors.border,
                        }}
                      />
                    </>
                  )}
                  {!hasDeadline && <View style={{ marginBottom: 24 }} />}
                </>
              )}
              {periodType !== 'none' && <View style={{ marginBottom: 24 }} />}

              <TouchableOpacity
                onPress={handleCreate}
                accessibilityLabel="Crear nueva meta"
                style={{
                  backgroundColor: themeColors.primary, borderRadius: 14,
                  padding: 16, alignItems: 'center',
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
                  Crear Meta
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal Nuevo Ítem */}
      <Modal visible={showItemModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  Nuevo Ítem
                </ThemedText>
                <TouchableOpacity onPress={() => setShowItemModal(false)} accessibilityLabel="Cerrar modal de nuevo ítem">
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Nombre del ítem
              </ThemedText>
              <TextInput
                value={itemName}
                onChangeText={setItemName}
                placeholder="Ej: Placa base"
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                  fontSize: 15, color: themeColors.text, marginBottom: 16,
                  borderWidth: 1, borderColor: themeColors.border,
                }}
              />

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Monto objetivo
              </ThemedText>
              <TextInput
                value={itemTarget}
                onChangeText={setItemTarget}
                placeholder="Ej: 250.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                  fontSize: 18, fontWeight: '600', color: themeColors.text, marginBottom: 32,
                  borderWidth: 1, borderColor: themeColors.border,
                }}
              />

              <TouchableOpacity
                onPress={handleCreateItem}
                accessibilityLabel="Agregar nuevo ítem a la meta"
                style={{
                  backgroundColor: themeColors.primary, borderRadius: 14,
                  padding: 16, alignItems: 'center',
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
                  Agregar Ítem
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal Abonar a Meta */}
      <Modal visible={showDepositModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  Abonar a Meta
                </ThemedText>
                <TouchableOpacity onPress={() => setShowDepositModal(false)} accessibilityLabel="Cerrar modal de abono">
                  <Ionicons name="close" size={24} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 8 }}>
                Monto a abonar
              </ThemedText>
              <TextInput
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="Ej: 100.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface, borderRadius: 12, padding: 14,
                  fontSize: 18, fontWeight: '600', color: themeColors.text, marginBottom: 32,
                  borderWidth: 1, borderColor: themeColors.border,
                }}
              />

              <TouchableOpacity
                onPress={handleDeposit}
                accessibilityLabel="Confirmar abono a meta"
                style={{
                  backgroundColor: '#10B981', borderRadius: 14,
                  padding: 16, alignItems: 'center',
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
                  Abonar
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
      );
    }
