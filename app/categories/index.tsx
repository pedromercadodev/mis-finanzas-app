import { useEffect, useState, useMemo } from 'react';
import {
  View,
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
import GlassCard from '../../src/components/GlassCard';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../src/services/categories';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../../src/services/categoryGroups';
import type { Category, CategoryGroup, CategoryWithGroup } from '../../src/utils/types';

const CATEGORY_ICONS = [
  '🍔', '🚗', '💊', '📚', '🎮', '🏠', '💡', '👕',
  '💼', '💻', '📈', '📦', '🎵', '🎬', '✈️', '🐕',
  '💵', '🎓', '🛒', '🍕', '☕', '🎂', '🍺', '🏋️',
];

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
  const [searchQuery, setSearchQuery] = useState('');

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

  const inputStyle = {
    backgroundColor: themeColors.surfaceContainer,
    borderWidth: 1,
    borderColor: themeColors.outlineVariant + '50',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: themeColors.text,
  };

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

  // Filtrar categorías por búsqueda
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  // Separar por tipo
  const expenseCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === 'expense'),
    [filteredCategories]
  );
  const incomeCategories = useMemo(
    () => filteredCategories.filter((c) => c.type === 'income'),
    [filteredCategories]
  );

  // --- CRUD Categorías ---
  const openNewCategory = (prefillType?: 'expense' | 'income', prefillGroupId?: number | null) => {
    setEditingCategory(null);
    setCatName('');
    setCatIcon('📦');
    setCatColor('#6366F1');
    setCatType(prefillType || 'expense');
    setCatGroupId(prefillGroupId ?? null);
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

  const expenseGroups = groups.filter((g) => g.type === 'expense');
  const incomeGroups = groups.filter((g) => g.type === 'income');

  // Renderizar lista de categorías
  const renderCategoryList = (cats: CategoryWithGroup[], type: 'expense' | 'income') => {
    const isExpense = type === 'expense';
    const accentColor = isExpense ? themeColors.danger : themeColors.secondary;
    const iconName = isExpense ? 'trending-down' : 'trending-up';

    return (
      <GlassCard padding={20} style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Decorative blur circle */}
        <View
          style={{
            position: 'absolute',
            top: -96,
            [isExpense ? 'left' : 'right']: -96,
            width: 192,
            height: 192,
            backgroundColor: isExpense
              ? themeColors.danger + '10'
              : themeColors.secondary + '10',
            borderRadius: 999,
            pointerEvents: 'none' as any,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.outlineVariant + '50',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={iconName} size={22} color={accentColor} />
            <ThemedText
              type="body"
              themeColor="text"
              style={{ fontSize: 18, fontWeight: '600' }}
            >
              {isExpense ? 'Gastos' : 'Ingresos'}
            </ThemedText>
          </View>
          <View
            style={{
              backgroundColor: themeColors.surfaceVariant,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
            }}
          >
            <ThemedText
              type="small"
              themeColor="onSurfaceVariant"
              style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }}
            >
              {cats.length} items
            </ThemedText>
          </View>
        </View>

        {/* List */}
        <View style={{ gap: 4, marginTop: 8 }}>
          {cats.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ThemedText type="caption" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {searchQuery
                  ? 'Sin resultados'
                  : `No hay categorías de ${isExpense ? 'gasto' : 'ingreso'}`}
              </ThemedText>
            </View>
          ) : (
            cats.map((cat) => {
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => openEditCategory(cat)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: 12,
                  }}
                  accessibilityLabel={`Editar categoría ${cat.name}`}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    {/* Icon wrapper */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: themeColors.surfaceVariant + '40',
                        borderWidth: 1,
                        borderColor: themeColors.outlineVariant,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <ThemedText type="body" style={{ fontSize: 18 }}>
                        {cat.icon || '📦'}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type="body"
                        themeColor="text"
                        style={{ fontWeight: '500' }}
                      >
                        {cat.name}
                      </ThemedText>
                    </View>
                  </View>
                  {/* Edit button */}
                  <TouchableOpacity
                    onPress={() => openEditCategory(cat)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    accessibilityLabel={`Editar ${cat.name}`}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={themeColors.textSecondary}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </GlassCard>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* TopAppBar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: themeColors.surface + '80',
          borderBottomWidth: 1,
          borderBottomColor: themeColors.outlineVariant + '20',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <ThemedText
          type="body"
          themeColor="text"
          style={{
            fontSize: 20,
            fontWeight: '600',
            position: 'absolute',
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none' as any,
          }}
        >
          Categorías
        </ThemedText>
        <TouchableOpacity
          onPress={() => openNewGroup()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
          }}
          accessibilityLabel="Gestionar grupos"
        >
          <Ionicons name="layers-outline" size={22} color={themeColors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ position: 'relative' }}>
            <View
              style={{
                position: 'absolute',
                left: 16,
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <Ionicons
                name="search"
                size={20}
                color={themeColors.textSecondary}
              />
            </View>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar categoría..."
              placeholderTextColor={themeColors.textSecondary + '80'}
              style={{
                width: '100%',
                backgroundColor: themeColors.surfaceContainerHigh,
                borderWidth: 1,
                borderColor: themeColors.outlineVariant,
                borderRadius: 12,
                paddingVertical: 12,
                paddingLeft: 44,
                paddingRight: 16,
                fontSize: 16,
                color: themeColors.text,
              }}
            />
          </View>
        </View>

        {/* Bento Grid */}
        <View style={{ paddingHorizontal: 24, gap: 24, marginTop: 16 }}>
          {renderCategoryList(expenseCategories, 'expense')}
          {renderCategoryList(incomeCategories, 'income')}
        </View>
      </ScrollView>

      {/* FAB - Nueva Categoría */}
      <TouchableOpacity
        onPress={() => openNewCategory()}
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          backgroundColor: themeColors.secondary,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: themeColors.secondary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 24,
          elevation: 8,
          zIndex: 40,
        }}
        accessibilityLabel="Crear nueva categoría"
      >
        <Ionicons name="add" size={28} color="#003824" />
      </TouchableOpacity>

      {/* Toast */}
      {toastVisible && (
        <View
          style={{
            position: 'absolute',
            bottom: 100,
            left: 24,
            right: 24,
            backgroundColor: themeColors.success || '#10B981',
            borderRadius: 12,
            padding: 14,
            alignItems: 'center',
            shadowColor: '#0A1E3D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <ThemedText type="button" color="#FFF">
            {toastMsg}
          </ThemedText>
        </View>
      )}

      {/* Modal crear/editar CATEGORÍA */}
      <Modal visible={showCatModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 32,
                }}
              >
                <ThemedText
                  type="body"
                  themeColor="text"
                  style={{ fontSize: 22, fontWeight: '600' }}
                >
                  {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowCatModal(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Nombre
              </ThemedText>
              <TextInput
                value={catName}
                onChangeText={setCatName}
                placeholder="Ej: Comida, Transporte..."
                placeholderTextColor={themeColors.textSecondary + '80'}
                style={[inputStyle, { marginBottom: 20 }]}
              />

              {/* Tipo */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
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
                      backgroundColor:
                        catType === t
                          ? t === 'expense'
                            ? themeColors.danger
                            : themeColors.secondary
                          : themeColors.surfaceContainer,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor:
                        catType === t
                          ? t === 'expense'
                            ? themeColors.danger
                            : themeColors.secondary
                          : themeColors.outlineVariant + '50',
                    }}
                    accessibilityLabel={`Tipo ${t === 'expense' ? 'gasto' : 'ingreso'}`}
                  >
                    <ThemedText
                      type="button"
                      color={catType === t ? '#FFF' : themeColors.text}
                    >
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Grupo */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Grupo
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => setCatGroupId(null)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor:
                      catGroupId === null ? themeColors.secondary : themeColors.surfaceContainer,
                    borderWidth: 1,
                    borderColor:
                      catGroupId === null
                        ? themeColors.secondary
                        : themeColors.outlineVariant + '50',
                  }}
                  accessibilityLabel="Sin grupo"
                >
                  <ThemedText
                    type="buttonSmall"
                    color={catGroupId === null ? '#003824' : themeColors.text}
                  >
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
                      backgroundColor:
                        catGroupId === g.id ? themeColors.secondary : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor:
                        catGroupId === g.id
                          ? themeColors.secondary
                          : themeColors.outlineVariant + '50',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    accessibilityLabel={`Seleccionar grupo ${g.name}`}
                  >
                    <ThemedText type="body" themeColor="text">
                      {g.icon}
                    </ThemedText>
                    <ThemedText
                      type="buttonSmall"
                      color={catGroupId === g.id ? '#003824' : themeColors.text}
                    >
                      {g.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Icono
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {CATEGORY_ICONS.map((ic, index) => (
                  <TouchableOpacity
                    key={`cat-icon-${index}`}
                    onPress={() => setCatIcon(ic)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor:
                        catIcon === ic ? themeColors.secondary + '20' : themeColors.surfaceContainer,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: catIcon === ic ? themeColors.secondary : 'transparent',
                    }}
                    accessibilityLabel={`Seleccionar icono ${ic}`}
                  >
                    <ThemedText type="h3" themeColor="text">
                      {ic}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Color
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {CATEGORY_COLORS.map((c, index) => (
                  <TouchableOpacity
                    key={`cat-color-${index}`}
                    onPress={() => setCatColor(c)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: c,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 3,
                      borderColor: catColor === c ? '#FFF' : 'transparent',
                      shadowColor: catColor === c ? c : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 4,
                      elevation: catColor === c ? 4 : 0,
                    }}
                    accessibilityLabel="Seleccionar color"
                  >
                    {catColor === c && (
                      <Ionicons name="checkmark" size={20} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Botón Guardar */}
              <TouchableOpacity
                onPress={handleSaveCategory}
                style={{
                  backgroundColor: themeColors.secondary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                }}
                accessibilityLabel={
                  editingCategory ? 'Guardar cambios de categoría' : 'Crear categoría'
                }
              >
                <ThemedText
                  type="body"
                  color="#003824"
                  style={{ fontWeight: '700' }}
                >
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
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 32,
                }}
              >
                <ThemedText
                  type="body"
                  themeColor="text"
                  style={{ fontSize: 22, fontWeight: '600' }}
                >
                  {editingGroup ? 'Editar grupo' : 'Nuevo grupo'}
                </ThemedText>
                <TouchableOpacity
                  onPress={() => setShowGroupModal(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={24} color={themeColors.text} />
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Nombre del grupo
              </ThemedText>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Ej: Necesidades, Deseos..."
                placeholderTextColor={themeColors.textSecondary + '80'}
                style={[inputStyle, { marginBottom: 20 }]}
              />

              {/* Tipo */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
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
                      backgroundColor:
                        groupType === t
                          ? t === 'expense'
                            ? themeColors.danger
                            : themeColors.secondary
                          : themeColors.surfaceContainer,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor:
                        groupType === t
                          ? t === 'expense'
                            ? themeColors.danger
                            : themeColors.secondary
                          : themeColors.outlineVariant + '50',
                    }}
                    accessibilityLabel={`Tipo de grupo ${t === 'expense' ? 'gasto' : 'ingreso'}`}
                  >
                    <ThemedText
                      type="button"
                      color={groupType === t ? '#FFF' : themeColors.text}
                    >
                      {t === 'expense' ? 'Gasto' : 'Ingreso'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Icono */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Icono
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {GROUP_ICONS.map((ic, index) => (
                  <TouchableOpacity
                    key={`group-icon-${index}`}
                    onPress={() => setGroupIcon(ic)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor:
                        groupIcon === ic
                          ? themeColors.secondary + '20'
                          : themeColors.surfaceContainer,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: groupIcon === ic ? themeColors.secondary : 'transparent',
                    }}
                    accessibilityLabel={`Seleccionar icono de grupo ${ic}`}
                  >
                    <ThemedText type="h3" themeColor="text">
                      {ic}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color */}
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={{ fontWeight: '600', marginBottom: 6 }}
              >
                Color
              </ThemedText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {CATEGORY_COLORS.map((c, index) => (
                  <TouchableOpacity
                    key={`group-color-${index}`}
                    onPress={() => setGroupColor(c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: c,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 3,
                      borderColor: groupColor === c ? '#FFF' : 'transparent',
                      shadowColor: groupColor === c ? c : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 4,
                      elevation: groupColor === c ? 4 : 0,
                    }}
                    accessibilityLabel="Seleccionar color de grupo"
                  >
                    {groupColor === c && (
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Botón Guardar */}
              <TouchableOpacity
                onPress={handleSaveGroup}
                style={{
                  backgroundColor: themeColors.secondary,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                }}
                accessibilityLabel={editingGroup ? 'Guardar cambios de grupo' : 'Crear grupo'}
              >
                <ThemedText
                  type="body"
                  color="#003824"
                  style={{ fontWeight: '700' }}
                >
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
