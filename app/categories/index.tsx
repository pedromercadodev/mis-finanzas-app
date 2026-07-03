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
import { colors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../src/services/categories';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../src/services/categoryGroups';
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
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text }}>
              Categorías
            </Text>
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
          >
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Nueva</Text>
          </TouchableOpacity>
        </View>

        {/* Sección de Grupos con Categorías Expandibles */}
        <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          Grupos ({groups.length})
        </Text>
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
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: g.color + '20',
                      justifyContent: 'center', alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 20 }}>{g.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                        {g.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        {groupCategories.length} categorías · {g.type === 'expense' ? 'Gasto' : 'Ingreso'}
                      </Text>
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
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="pencil-outline" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteGroup(g)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={18} color={themeColors.danger || '#EF4444'} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ backgroundColor: themeColors.background, paddingLeft: 14, paddingRight: 14, paddingBottom: 8, gap: 4 }}>
                    {groupCategories.length === 0 ? (
                      <Text style={{ fontSize: 13, color: themeColors.textSecondary, textAlign: 'center', paddingVertical: 12 }}>
                        Sin categorías en este grupo
                      </Text>
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
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                            <View>
                              <Text style={{ fontSize: 14, fontWeight: '500', color: themeColors.text }}>
                                {cat.name}
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleDeleteCategory(cat)}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={themeColors.danger || '#EF4444'} />
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
                    >
                      <Ionicons name="add-circle-outline" size={16} color={themeColors.primary} />
                      <Text style={{ color: themeColors.primary, fontWeight: '500', fontSize: 13 }}>
                        Nueva categoría
                      </Text>
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
          >
            <Ionicons name="add-circle-outline" size={20} color={themeColors.primary} />
            <Text style={{ color: themeColors.primary, fontWeight: '600', fontSize: 14 }}>
              Nuevo Grupo
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Toast */}
      {toastVisible && (
        <View style={{
          position: 'absolute', bottom: 40, left: 20, right: 20,
          backgroundColor: themeColors.success || '#10B981',
          borderRadius: 12, padding: 14, alignItems: 'center',
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
        }}>
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>{toastMsg}</Text>
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
                <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                  {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                </Text>
                <TouchableOpacity onPress={() => setShowCatModal(false)}>
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Nombre
              </Text>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Tipo
              </Text>
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
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: catType === t ? '#FFF' : themeColors.text,
                    }}>
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Grupo */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Grupo
              </Text>
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
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: catGroupId === null ? '#FFF' : themeColors.text,
                  }}>
                    Sin grupo
                  </Text>
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
                  >
                    <Text style={{ fontSize: 14 }}>{g.icon}</Text>
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: catGroupId === g.id ? '#FFF' : themeColors.text,
                    }}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Icono
              </Text>
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
                  >
                    <Text style={{ fontSize: 22 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Color
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {CATEGORY_COLORS.map((c, index) => (
                  <TouchableOpacity
                    key={`cat-color-${index}`}
                    onPress={() => setCatColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
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
                  >
                    {catColor === c && (
                      <Ionicons name="checkmark" size={18} color="#FFF" />
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
              >
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>
                  {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
                </Text>
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
                <Text style={{ fontSize: 22, fontWeight: '700', color: themeColors.text }}>
                  {editingGroup ? 'Editar grupo' : 'Nuevo grupo'}
                </Text>
                <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Nombre del grupo
              </Text>
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Tipo
              </Text>
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
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: groupType === t ? '#FFF' : themeColors.text,
                    }}>
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Icono
              </Text>
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
                  >
                    <Text style={{ fontSize: 22 }}>{ic}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 6 }}>
                Color
              </Text>
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
              >
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>
                  {editingGroup ? 'Guardar cambios' : 'Crear grupo'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
