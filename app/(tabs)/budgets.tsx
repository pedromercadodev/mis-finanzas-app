import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { getGroupSummaries, setAllocation } from '../../src/services/budgetAllocations';
import { formatUSD, getCurrentMonthRange } from '../../src/utils/format';
import type { GroupWithCategories } from '../../src/utils/types';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function BudgetsScreen() {
  const themeColors = useThemeColors();
  const [groups, setGroups] = useState<GroupWithCategories[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [currentMonth, setCurrentMonth] = useState('');
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [allocCategoryId, setAllocCategoryId] = useState<number | null>(null);
  const [allocCategoryName, setAllocCategoryName] = useState('');
  const [allocAmount, setAllocAmount] = useState('');
  const [allocCurrentSpent, setAllocCurrentSpent] = useState(0);
  const [allocCurrentBudget, setAllocCurrentBudget] = useState(0);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const month = getCurrentMonthRange().start.substring(0, 7);
    setCurrentMonth(month);
    const data = await getGroupSummaries(month);
    setGroups(data);
  }, []);

  // Recargar datos cada vez que la pantalla obtiene foco
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const openAllocationModal = (cat: any) => {
    setAllocCategoryId(cat.id);
    setAllocCategoryName(cat.name);
    setAllocAmount(String(cat.allocation?.amountUSD || ''));
    setAllocCurrentSpent(cat.spending?.spentUSD || 0);
    setAllocCurrentBudget(cat.allocation?.amountUSD || 0);
    setShowAllocationModal(true);
  };

  const handleSaveAllocation = async () => {
    if (allocCategoryId === null) return;

    const amount = parseFloat(allocAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    setSaving(true);
    try {
      await setAllocation(allocCategoryId, currentMonth, amount);
      setShowAllocationModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la asignación');
    } finally {
      setSaving(false);
    }
  };

  const getMonthLabel = (month: string) => {
    const [year, num] = month.split('-');
    const monthIndex = parseInt(num, 10) - 1;
    return `${MONTH_NAMES[monthIndex] || num} ${year}`;
  };

  const getBarColor = (percentage: number) => {
    if (percentage >= 100) return themeColors.danger || '#EF4444';
    if (percentage >= 80) return themeColors.tertiary || '#F59E0B';
    return themeColors.secondary || '#10B981';
  };

  // Calcular totales
  const totalBudget = groups.reduce((sum, g) => sum + g.totalBudgetUSD, 0);
  const totalSpent = groups.reduce((sum, g) => sum + g.totalSpentUSD, 0);
  const totalPercentage = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  const exceededCategories = groups.reduce((count, g) => {
    return count + g.categories.filter(c => {
      const budget = c.allocation?.amountUSD || 0;
      const spent = c.spending?.spentUSD || 0;
      return budget > 0 && spent >= budget;
    }).length;
  }, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: themeColors.primaryContainer,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="wallet" size={20} color={themeColors.onPrimaryContainer} />
              </View>
              <ThemedText type="h1" themeColor="text" style={{ fontSize: 28, fontWeight: '700' }}>
                Presupuestos
              </ThemedText>
            </View>
          </View>
          <ThemedText type="body" themeColor="onSurfaceVariant" style={{ marginTop: 4, fontSize: 14 }}>
            {getMonthLabel(currentMonth)}
          </ThemedText>
        </View>

        {/* Budget Summary Bento */}
        {groups.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Total Budget Card */}
              <View style={{
                flex: 2,
                backgroundColor: themeColors.surfaceContainer + '99',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
                padding: 20,
                overflow: 'hidden',
              }}>
                <View style={{
                  position: 'absolute', right: -40, top: -40,
                  width: 192, height: 192,
                  backgroundColor: themeColors.secondary + '10',
                  borderRadius: 96,
                }} />
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Presupuesto Total
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <ThemedText type="h1" themeColor="text" style={{ fontSize: 28, fontWeight: '700' }}>
                    {formatUSD(totalSpent)}
                  </ThemedText>
                  <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 16 }}>
                    / {formatUSD(totalBudget)}
                  </ThemedText>
                </View>
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <ThemedText type="caption" themeColor="tertiary" style={{ fontSize: 11, fontWeight: '600' }}>
                      {Math.round(totalPercentage)}% Utilizado
                    </ThemedText>
                  </View>
                  <View style={{
                    height: 8,
                    backgroundColor: themeColors.surfaceContainerHigh,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      width: `${Math.max(totalPercentage, 2)}%` as any,
                      height: '100%',
                      backgroundColor: getBarColor(totalPercentage),
                      borderRadius: 4,
                    }} />
                  </View>
                </View>
              </View>

              {/* Exceeded Alert Card */}
              <View style={{
                flex: 1,
                backgroundColor: themeColors.surfaceContainer + '99',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
                padding: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 24,
                  backgroundColor: themeColors.errorContainer + '20',
                  justifyContent: 'center', alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Ionicons name="warning" size={24} color={themeColors.danger} />
                </View>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600', textAlign: 'center' }}>
                  {exceededCategories}
                </ThemedText>
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textAlign: 'center', fontSize: 11 }}>
                  {exceededCategories === 1 ? 'Categoría excedida' : 'Categorías excedidas'}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Empty State */}
        {groups.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: themeColors.primaryContainer,
              justifyContent: 'center', alignItems: 'center',
              marginBottom: 16,
            }}>
              <Ionicons name="wallet-outline" size={40} color={themeColors.onPrimaryContainer} />
            </View>
            <ThemedText type="body" themeColor="onSurfaceVariant" style={{ textAlign: 'center' }}>
              No hay categorías de gasto.{'\n'}Crea categorías en la sección de Categorías.
            </ThemedText>
          </View>
        )}

        {/* Budget Categories List */}
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          {groups.map((groupWrapper) => {
            const isExpanded = expandedGroups.has(groupWrapper.group.id);
            const groupPercentage = groupWrapper.totalBudgetUSD > 0
              ? Math.min((groupWrapper.totalSpentUSD / groupWrapper.totalBudgetUSD) * 100, 100)
              : 0;
            const groupBarColor = getBarColor(groupPercentage);

            return (
              <View
                key={groupWrapper.group.id}
                style={{
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                  overflow: 'hidden',
                  shadowColor: '#0A1E3D',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                {/* Group Header */}
                <TouchableOpacity
                  onPress={() => toggleGroup(groupWrapper.group.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                  }}
                  accessibilityLabel={`${isExpanded ? 'Colapsar' : 'Expandir'} grupo ${groupWrapper.group.name}`}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: themeColors.surfaceContainerHigh,
                    justifyContent: 'center', alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 18 }}>
                      {groupWrapper.group.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                          {groupWrapper.group.name}
                        </ThemedText>
                        <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11 }}>
                          {groupWrapper.categories.length} {groupWrapper.categories.length === 1 ? 'subcategoría' : 'subcategorías'}
                        </ThemedText>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <ThemedText type="body" themeColor="text" style={{ fontSize: 13, fontWeight: '600' }}>
                            {formatUSD(groupWrapper.totalSpentUSD)} / {formatUSD(groupWrapper.totalBudgetUSD)}
                          </ThemedText>
                          <ThemedText type="caption" color={groupBarColor} style={{ fontSize: 11, fontWeight: '600' }}>
                            {Math.round(groupPercentage)}%
                          </ThemedText>
                        </View>
                        <Ionicons
                          name={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={themeColors.onSurfaceVariant}
                        />
                      </View>
                    </View>
                    {/* Group progress bar */}
                    <View style={{
                      height: 6,
                      backgroundColor: themeColors.surfaceContainerHigh,
                      borderRadius: 3,
                      overflow: 'hidden',
                      marginTop: 8,
                    }}>
                      <View style={{
                        width: `${groupPercentage}%` as any,
                        height: '100%',
                        backgroundColor: groupBarColor,
                        borderRadius: 3,
                      }} />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Categories dentro del grupo */}
                {isExpanded && (
                  <View style={{
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    paddingTop: 4,
                    borderTopWidth: 1,
                    borderTopColor: themeColors.outlineVariant + '20',
                    gap: 2,
                  }}>
                    {groupWrapper.categories.length === 0 && (
                      <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontStyle: 'italic', paddingVertical: 8, paddingLeft: 34, fontSize: 13 }}>
                        Sin categorías
                      </ThemedText>
                    )}
                    {groupWrapper.categories.map((cat) => {
                      const spent = cat.spending?.spentUSD || 0;
                      const budget = cat.allocation?.amountUSD || 0;
                      const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                      const barColor = getBarColor(percentage);
                      const isOverBudget = percentage >= 100;

                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => openAllocationModal(cat)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            borderRadius: 10,
                            backgroundColor: isOverBudget ? themeColors.errorContainer + '10' : 'transparent',
                            borderWidth: isOverBudget ? 1 : 0,
                            borderColor: isOverBudget ? themeColors.danger + '20' : 'transparent',
                          }}
                          activeOpacity={0.6}
                          accessibilityLabel={`Asignar presupuesto a ${cat.name}`}
                        >
                          <Ionicons
                            name={getIcon(cat.icon)}
                            size={18}
                            color={isOverBudget ? themeColors.danger : themeColors.secondary}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <ThemedText
                                type="body"
                                themeColor={isOverBudget ? 'danger' : 'text'}
                                style={{ fontSize: 14, fontWeight: isOverBudget ? '600' : '400' }}
                              >
                                {cat.name}
                              </ThemedText>
                              <ThemedText type="caption" color={barColor} style={{ fontWeight: '600', fontSize: 12 }}>
                                {formatUSD(spent)} / {formatUSD(budget)}
                              </ThemedText>
                            </View>
                            <View style={{
                              height: 4,
                              backgroundColor: themeColors.surfaceContainerHigh,
                              borderRadius: 2,
                              overflow: 'hidden',
                              marginTop: 4,
                            }}>
                              <View style={{
                                width: `${percentage}%` as any,
                                height: '100%',
                                backgroundColor: barColor,
                                borderRadius: 2,
                              }} />
                            </View>
                            {percentage >= 80 && (
                              <View style={{
                                marginTop: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}>
                                <Ionicons
                                  name={percentage >= 100 ? 'alert-circle' : 'alert-circle-outline'}
                                  size={12}
                                  color={barColor}
                                />
                                <ThemedText type="badge" color={barColor} style={{ fontSize: 10 }}>
                                  {percentage >= 100 ? 'Límite alcanzado' : 'Cerca del límite'}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Modal de Asignación Mensual */}
      <Modal visible={showAllocationModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  Asignar Presupuesto
                </ThemedText>
                <TouchableOpacity onPress={() => setShowAllocationModal(false)} accessibilityLabel="Cerrar modal de asignación">
                  <Ionicons name="close" size={24} color={themeColors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {/* Categoría */}
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 6 }}>
                Categoría
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
                marginBottom: 20,
              }}>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  {allocCategoryName}
                </ThemedText>
              </View>

              {/* Mes */}
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 6 }}>
                Mes
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
                marginBottom: 20,
              }}>
                <ThemedText type="body" themeColor="text">
                  {getMonthLabel(currentMonth)}
                </ThemedText>
              </View>

              {/* Presupuesto USD */}
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 6 }}>
                Presupuesto en USD
              </ThemedText>
              <TextInput
                value={allocAmount}
                onChangeText={setAllocAmount}
                placeholder="Ej: 500.00"
                placeholderTextColor={themeColors.onSurfaceVariant}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 20,
                  fontWeight: '700',
                  color: themeColors.text,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                  marginBottom: 20,
                }}
              />

              {/* Resumen */}
              <View style={{
                backgroundColor: themeColors.surfaceContainer,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '30',
                marginBottom: 32,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <ThemedText type="body" themeColor="onSurfaceVariant">Gasto actual:</ThemedText>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    {formatUSD(allocCurrentSpent)}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText type="body" themeColor="onSurfaceVariant">Presupuesto anterior:</ThemedText>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    {formatUSD(allocCurrentBudget)}
                  </ThemedText>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveAllocation}
                disabled={saving}
                accessibilityLabel={saving ? 'Guardando asignación' : 'Guardar asignación de presupuesto'}
                style={{
                  backgroundColor: saving ? themeColors.onSurfaceVariant : themeColors.secondary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  opacity: saving ? 0.6 : 1,
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <ThemedText style={{ color: themeColors.background }} type="button">
                  {saving ? 'Guardando...' : 'Guardar Asignación'}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
