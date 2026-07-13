import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../src/services/categories';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../src/services/categoryGroups';
import { shadows } from '../../src/theme/shadows';
import type { Category, CategoryGroup, CategoryWithGroup } from '../../src/utils/types';

const CATEGORY_ICONS = [
  '🍔', '🚗', '💊', '📚', '🎮', '🏠', '💡', '👕',
  '💼', '💻', '📈', '📦', '🎵', '🎬', '✈️', '🐕',
  '💵', '🎓', '🛒', '🍕', '☕', '🎂', '🍺', '🏋️',
];

// Usar el índice como key para evitar duplicados

const CATEGORY_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#6366F1', '#8B5CF6',
  '#EC4899', '#F97316', '#14B8A6', '#6B7280', '#3B82F6',
];

const GROUP_ICONS = ['📁', '📋', '🎯', '💰', '🏠', '🛒', '💼', '🎓', '✈️', '🎵'];

export default function CategoriesScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const [categories, setCategories] = useState<CategoryWithGroup[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

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

  const getCategoriesByGroup = (groupId: number): CategoryWithGroup[] => {
    return categories.filter((c) => c.groupId === groupId);
  };

  // Modal de categoría
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithGroup | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#6366F1');
  const [catType, setCatType] = useState<'expense' | 'income'>('expense');
  const [catGroupId, setCatGroupId] = useState<number | null>(null);

  // Modal de grupo
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState('📁');
  const [groupColor, setGroupColor] = useState('#6B7280');
  const [groupType, setGroupType] = useState<'expense' | 'income'>('expense');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const loadData = async () => {
    const [cats, grps] = await Promise.all([
      getCategories() as Promise<CategoryWithGroup[]>,
      getGroups(),
    ]);
    setCategories(cats);
    setGroups(grps);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // --- CRUD Categorías ---
  const openNewCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatIcon('📦');
    setCatColor('#6366F1');
    setCatType('expense');
    setCatGroupId(null);
    setShowCatModal(true);
  };

  const openEditCategory = (cat: CategoryWithGroup) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon);
    setCatColor(cat.color);
    setCatType(cat.type as 'expense' | 'income');
    setCatGroupId(cat.groupId);
    setShowCatModal(true);
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          type: catType,
          groupId: catGroupId,
        });
        showToast('Categoría actualizada ✓');
      } else {
        await createCategory({
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          type: catType,
          budget: null as unknown as number,
          groupId: catGroupId,
          sortOrder: 0,
        });
        showToast('Categoría creada ✓');
      }
      setShowCatModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la categoría');
    }
  };

  const handleDeleteCategory = (cat: CategoryWithGroup) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${cat.name}"? Las transacciones con esta categoría se quedarán sin categoría.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(cat.id);
              showToast('Categoría eliminada ✓');
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  // --- CRUD Grupos ---
  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupIcon('📁');
    setGroupColor('#6B7280');
    setGroupType('expense');
    setShowGroupModal(true);
  };

  const openEditGroup = (g: CategoryGroup) => {
    setEditingGroup(g);
    setGroupName(g.name);
    setGroupIcon(g.icon);
    setGroupColor(g.color);
    setGroupType(g.type as 'expense' | 'income');
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'El nombre del grupo es obligatorio');
      return;
    }

    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, {
          name: groupName.trim(),
          icon: groupIcon,
          color: groupColor,
          type: groupType,
        });
        showToast('Grupo actualizado ✓');
      } else {
        await createGroup({
          name: groupName.trim(),
          icon: groupIcon,
          color: groupColor,
          type: groupType,
          sortOrder: groups.length + 1,
        });
        showToast('Grupo creado ✓');
      }
      setShowGroupModal(false);
      await loadData();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el grupo');
    }
  };

  const handleDeleteGroup = (g: CategoryGroup) => {
    Alert.alert(
      'Eliminar grupo',
      `¿Eliminar "${g.name}"? Las categorías de este grupo se quedarán sin grupo asignado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroup(g.id);
              showToast('Grupo eliminado ✓');
              await loadData();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el grupo');
            }
          },
        },
      ]
    );
  };

  const getGroupName = (groupId: number | null): string => {
    if (groupId === null) return 'Sin grupo';
    const group = groups.find((g) => g.id === groupId);
    return group ? group.name : 'Sin grupo';
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');
  const expenseGroups = groups.filter((g) => g.type === 'expense');
  const incomeGroups = groups.filter((g) => g.type === 'income');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver">
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <ThemedText type="h1" themeColor="text">
              Categorías
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={openNewCategory}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
            accessibilityLabel="Crear nueva categoría"
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <ThemedText type="button" color="#FFF">Nueva</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Sección de Grupos con Categorías Expandibles */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          Grupos ({groups.length})
        </ThemedText>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {groups.map((g) => {
            const isExpanded = expandedGroups.has(g.id);
            const groupCategories = getCategoriesByGroup(g.id);
            return (
              <View key={g.id} style={{ borderRadius: 14, overflow: 'hidden' }}>
                <TouchableOpacity
                  onPress={() => toggleGroup(g.id)}
                  style={{
                    backgroundColor: themeColors.surface,
                    padding: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  accessibilityLabel={`${isExpanded ? 'Colapsar' : 'Expandir'} grupo ${g.name}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: g.color + '20',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <ThemedText type="h4" themeColor="text">{g.icon}</ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="body" themeColor="text" style={{ fontWeight: '600' }}>
                        {g.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {groupCategories.length} categorías · {g.type === 'expense' ? 'Gasto' : 'Ingreso'}
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={themeColors.textSecondary}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                    <TouchableOpacity
                      onPress={() => openEditGroup(g)}
                      style={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                      accessibilityLabel={`Editar grupo ${g.name}`}
                    >
                      <Ionicons name="pencil-outline" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteGroup(g)}
                      style={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                      accessibilityLabel={`Eliminar grupo ${g.name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ backgroundColor: themeColors.background, paddingLeft: 14, paddingRight: 14, paddingBottom: 8, gap: 4 }}>
                    {groupCategories.length === 0 ? (
                      <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center', paddingVertical: 12 }}>
                        Sin categorías en este grupo
                      </ThemedText>
                    ) : (
                      groupCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => openEditCategory(cat)}
                          style={{
                            backgroundColor: themeColors.surface,
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: 4,
                          }}
                          accessibilityLabel={`Editar categoría ${cat.name}`}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name={(cat.icon as any) || 'cube-outline'} size={20} color={themeColors.primary} />
                            <View>
                              <ThemedText type="body" themeColor="text" style={{ fontWeight: '500' }}>
                                {cat.name}
                              </ThemedText>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteCategory(cat)}
                            style={{ padding: 12, justifyContent: 'center', alignItems: 'center' }}
                            accessibilityLabel={`Eliminar categoría ${cat.name}`}
                          >
                            <Ionicons name="trash-outline" size={16} color={themeColors.danger} />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        setCatGroupId(g.id);
                        setCatType(g.type);
                        openNewCategory();
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        marginTop: 4,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: themeColors.border,
                        borderStyle: 'dashed',
                      }}
                      accessibilityLabel="Agregar categoría a este grupo"
                    >
                      <Ionicons name="add-circle-outline" size={16} color={themeColors.primary} />
                      <ThemedText type="caption" color={themeColors.primary} style={{ fontWeight: '500' }}>
                        Nueva categoría
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          <TouchableOpacity
            onPress={openNewGroup}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 14,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: themeColors.border,
              borderStyle: 'dashed',
            }}
            accessibilityLabel="Crear nuevo grupo"
          >
            <Ionicons name="add-circle-outline" size={20} color={themeColors.primary} />
            <ThemedText type="button" color={themeColors.primary}>
              Nuevo Grupo
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Toast */}
      {toastVisible && (
        <View style={{
          position: 'absolute', bottom: 40, left: 20, right: 20,
          backgroundColor: themeColors.success || '#10B981',
          borderRadius: 12, padding: 14, alignItems: 'center',
          ...shadows.lg,
        }}>
          <ThemedText type="button" color="#FFF">{toastMsg}</ThemedText>
        </View>
      )}

      {/* Modal crear/editar CATEGORÍA */}
      <Modal visible={showCatModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                </ThemedText>
                <TouchableOpacity onPress={() => setShowCatModal(false)} accessibilityLabel="Cerrar modal de categoría">
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Nombre
              </ThemedText>
              <TextInput
                value={catName}
                onChangeText={setCatName}
                placeholder="Ej: Comida, Transporte..."
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                  marginBottom: 20,
                }}
              />

              {/* Tipo */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Tipo
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {(['expense', 'income'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setCatType(t)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: catType === t ? themeColors.primary : themeColors.surface,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: catType === t ? themeColors.primary : themeColors.border,
                    }}
                    accessibilityLabel={`Tipo ${t === 'expense' ? 'gasto' : 'ingreso'}`}
                  >
                    <ThemedText type="button" color={catType === t ? '#FFF' : themeColors.text}>
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Grupo */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Grupo
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => setCatGroupId(null)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: catGroupId === null ? themeColors.primary : themeColors.surface,
                    borderWidth: 1,
                    borderColor: catGroupId === null ? themeColors.primary : themeColors.border,
                  }}
                  accessibilityLabel="Sin grupo"
                >
                  <ThemedText type="buttonSmall" color={catGroupId === null ? '#FFF' : themeColors.text}>
                    Sin grupo
                  </ThemedText>
                </TouchableOpacity>
                {(catType === 'expense' ? expenseGroups : incomeGroups).map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => setCatGroupId(g.id)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: catGroupId === g.id ? themeColors.primary : themeColors.surface,
                      borderWidth: 1,
                      borderColor: catGroupId === g.id ? themeColors.primary : themeColors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    accessibilityLabel={`Seleccionar grupo ${g.name}`}
                  >
                    <ThemedText type="body" themeColor="text">{g.icon}</ThemedText>
                    <ThemedText type="buttonSmall" color={catGroupId === g.id ? '#FFF' : themeColors.text}>
                      {g.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Icono
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {CATEGORY_ICONS.map((ic, index) => (
                  <TouchableOpacity
                    key={`cat-icon-${index}`}
                    onPress={() => setCatIcon(ic)}
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: catIcon === ic ? themeColors.primary + '20' : themeColors.surface,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 2,
                      borderColor: catIcon === ic ? themeColors.primary : 'transparent',
                    }}
                    accessibilityLabel={`Seleccionar icono ${ic}`}
                  >
                    <ThemedText type="h3" themeColor="text">{ic}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Color
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {CATEGORY_COLORS.map((c, index) => (
                  <TouchableOpacity
                    key={`cat-color-${index}`}
                    onPress={() => setCatColor(c)}
                    style={{
                      width: 44, height: 44, borderRadius: 10,
                      backgroundColor: c,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 3,
                      borderColor: catColor === c ? '#FFF' : 'transparent',
                      shadowColor: catColor === c ? c : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 4,
                      elevation: catColor === c ? 4 : 0,
                    }}
                    accessibilityLabel={`Seleccionar color`}
                  >
                    {catColor === c && (
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSaveCategory}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
                accessibilityLabel={editingCategory ? 'Guardar cambios de categoría' : 'Crear categoría'}
              >
                <ThemedText type="body" color="#FFF" style={{ fontWeight: '700' }}>
                  {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal crear/editar GRUPO */}
      <Modal visible={showGroupModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <ThemedText type="h2" themeColor="text">
                  {editingGroup ? 'Editar grupo' : 'Nuevo grupo'}
                </ThemedText>
                <TouchableOpacity onPress={() => setShowGroupModal(false)} accessibilityLabel="Cerrar modal de grupo">
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Nombre del grupo
              </ThemedText>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Ej: Necesidades, Deseos..."
                placeholderTextColor={themeColors.textSecondary}
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: themeColors.text,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                  marginBottom: 20,
                }}
              />

              {/* Tipo */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Tipo
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {(['expense', 'income'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setGroupType(t)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: groupType === t ? themeColors.primary : themeColors.surface,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: groupType === t ? themeColors.primary : themeColors.border,
                    }}
                    accessibilityLabel={`Tipo de grupo ${t === 'expense' ? 'gasto' : 'ingreso'}`}
                  >
                    <ThemedText type="button" color={groupType === t ? '#FFF' : themeColors.text}>
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Icono
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {GROUP_ICONS.map((ic, index) => (
                  <TouchableOpacity
                    key={`group-icon-${index}`}
                    onPress={() => setGroupIcon(ic)}
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: groupIcon === ic ? themeColors.primary + '20' : themeColors.surface,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 2,
                      borderColor: groupIcon === ic ? themeColors.primary : 'transparent',
                    }}
                    accessibilityLabel={`Seleccionar icono de grupo ${ic}`}
                  >
                    <ThemedText type="h3" themeColor="text">{ic}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <ThemedText type="small" themeColor="textSecondary" style={{ fontWeight: '600', marginBottom: 6 }}>
                Color
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {CATEGORY_COLORS.map((c, index) => (
                  <TouchableOpacity
                    key={`group-color-${index}`}
                    onPress={() => setGroupColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: c,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 3,
                      borderColor: groupColor === c ? '#FFF' : 'transparent',
                      shadowColor: groupColor === c ? c : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 4,
                      elevation: groupColor === c ? 4 : 0,
                    }}
                    accessibilityLabel={`Seleccionar color de grupo`}
                  >
                    {groupColor === c && (
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSaveGroup}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
                accessibilityLabel={editingGroup ? 'Guardar cambios de grupo' : 'Crear grupo'}
              >
                <ThemedText type="body" color="#FFF" style={{ fontWeight: '700' }}>
                  {editingGroup ? 'Guardar cambios' : 'Crear grupo'}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
