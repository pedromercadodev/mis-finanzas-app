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
import { useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { shadows } from '../../src/theme/shadows';
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
    if (percentage >= 80) return themeColors.warning || '#F59E0B';
    return themeColors.success || '#10B981';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText type="h1" themeColor="text">
            Presupuestos
          </ThemedText>
        </View>
        <ThemedText type="body" themeColor="textSecondary" style={{ marginBottom: 20 }}>
          {getMonthLabel(currentMonth)}
        </ThemedText>

        {/* Grupos */}
        {groups.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
            <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center' }}>
              No hay categorías de gasto.{'\n'}Crea categorías en la sección de Categorías.
            </ThemedText>
          </View>
        )}

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
                backgroundColor: themeColors.surface,
                borderRadius: 16,
                marginBottom: 12,
                overflow: 'hidden',
                ...shadows.sm,
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
                <Text style={{ fontSize: 20, marginRight: 10 }}>
                  {groupWrapper.group.icon}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedText type="body" themeColor="text" style={{ fontWeight: '700' }}>
                      {groupWrapper.group.name}
                    </ThemedText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ThemedText type="caption" color={groupBarColor} style={{ fontWeight: '600' }}>
                        {formatUSD(groupWrapper.totalSpentUSD)} / {formatUSD(groupWrapper.totalBudgetUSD)}
                      </ThemedText>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={themeColors.textSecondary}
                      />
                    </View>
                  </View>
                  {/* Group progress bar */}
                  <View style={{
                    height: 4,
                    backgroundColor: themeColors.border,
                    borderRadius: 2,
                    overflow: 'hidden',
                    marginTop: 8,
                  }}>
                    <View style={{
                      width: `${groupPercentage}%`,
                      height: '100%',
                      backgroundColor: groupBarColor,
                      borderRadius: 2,
                    }} />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Categories dentro del grupo */}
              {isExpanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 2 }}>
                  {groupWrapper.categories.length === 0 && (
                    <ThemedText type="body" themeColor="textSecondary" style={{ fontStyle: 'italic', paddingVertical: 8, paddingLeft: 34 }}>
                      Sin categorías
                    </ThemedText>
                  )}
                  {groupWrapper.categories.map((cat) => {
                    const spent = cat.spending?.spentUSD || 0;
                    const budget = cat.allocation?.amountUSD || 0;
                    const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
                    const barColor = getBarColor(percentage);

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
                        }}
                        activeOpacity={0.6}
                        accessibilityLabel={`Asignar presupuesto a ${cat.name}`}
                      >
                        <Ionicons name={(cat.icon as any) || 'cube-outline'} size={18} color={themeColors.primary} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <ThemedText type="body" themeColor="text">
                              {cat.name}
                            </ThemedText>
                            <ThemedText type="caption" color={barColor} style={{ fontWeight: '600' }}>
                              {formatUSD(spent)} / {formatUSD(budget)}
                            </ThemedText>
                          </View>
                          <View style={{
                            height: 6,
                            backgroundColor: themeColors.border,
                            borderRadius: 3,
                            overflow: 'hidden',
                            marginTop: 4,
                          }}>
                            <View style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: barColor,
                              borderRadius: 3,
                            }} />
                          </View>
                          {percentage >= 80 && (
                            <View style={{
                              marginTop: 4,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                            }}>
                              <Text style={{ fontSize: 11 }}>⚠️</Text>
                              <ThemedText type="badge" color={barColor}>
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
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Categoría */}
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 6 }}>
                Categoría
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.surface,
                borderRadius: 12,
                padding: 14,
                ...shadows.sm,
                marginBottom: 20,
              }}>
                <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                  {allocCategoryName}
                </ThemedText>
              </View>

              {/* Mes */}
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 6 }}>
                Mes
              </ThemedText>
              <View style={{
                backgroundColor: themeColors.surface,
                borderRadius: 12,
                padding: 14,
                ...shadows.sm,
                marginBottom: 20,
              }}>
                <ThemedText type="body" themeColor="text">
                  {getMonthLabel(currentMonth)}
                </ThemedText>
              </View>

              {/* Presupuesto USD */}
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 6 }}>
                Presupuesto en USD
              </ThemedText>
              <TextInput
                value={allocAmount}
                onChangeText={setAllocAmount}
                placeholder="Ej: 500.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 20,
                  fontWeight: '700',
                  color: themeColors.text,
                  ...shadows.sm,
                  marginBottom: 20,
                }}
              />

              {/* Resumen */}
              <View style={{
                backgroundColor: themeColors.surface,
                borderRadius: 12,
                padding: 16,
                ...shadows.sm,
                marginBottom: 32,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <ThemedText type="body" themeColor="textSecondary">Gasto actual:</ThemedText>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                    {formatUSD(allocCurrentSpent)}
                  </ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText type="body" themeColor="textSecondary">Presupuesto anterior:</ThemedText>
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
                  backgroundColor: saving ? themeColors.textSecondary : themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  opacity: saving ? 0.6 : 1,
                  ...shadows.primary,
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
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
