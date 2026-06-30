import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { accountColors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAccounts } from '../../src/store/useAccounts';
import type { AccountType } from '../../src/utils/types';

const accountTypes: { key: AccountType; label: string; icon: string }[] = [
  { key: 'exchange', label: 'Exchange', icon: '💰' },
  { key: 'bank', label: 'Banco', icon: '🏦' },
  { key: 'virtual_card', label: 'Tarjeta Virtual', icon: '💳' },
  { key: 'cash', label: 'Efectivo', icon: '💵' },
  { key: 'other', label: 'Otra', icon: '📦' },
];

const accountIcons = [
  '💰', '🏦', '💳', '💵', '📱', '🌐', '🏧', '🎯',
  '💼', '📊', '🪙', '💎', '🏠', '🚗', '✈️', '🎓',
  '🛒', '🍔', '🎮', '👕', '💊', '🐕', '🎵', '📸',
];

export default function NewAccountScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const isSmall = screenWidth < 400;
  const { addAccount, loadAccounts } = useAccounts();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('exchange');
  const [icon, setIcon] = useState('💰');
  const [color, setColor] = useState<string>(accountColors[0].hex);
  const [platform, setPlatform] = useState('');
  const [initialUSD, setInitialUSD] = useState('');
  const [initialBS, setInitialBS] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    await addAccount({
      name: name.trim(),
      type,
      currency: 'BOTH',
      initialBalanceUSD: parseFloat(initialUSD) || 0,
      initialBalanceBS: parseFloat(initialBS) || 0,
      icon,
      color,
      isActive: 1,
      platform: platform.trim() || null,
    });

    await loadAccounts();
    showToast('✅ Cuenta creada correctamente');
    setTimeout(() => router.back(), 800);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: isSmall ? 14 : 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nombre */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Nombre de la cuenta
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej: Binance, Facebank, Mercantil..."
            placeholderTextColor={themeColors.textSecondary}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 12,
              padding: isSmall ? 12 : 14,
              fontSize: isSmall ? 14 : 15,
              color: themeColors.text,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          />

          {/* Tipo */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Tipo de cuenta
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountTypes.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: type === t.key ? themeColors.primary : themeColors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: type === t.key ? themeColors.primary : themeColors.border,
                }}
              >
                <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: type === t.key ? '#FFF' : themeColors.text,
                }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Plataforma (para billeteras digitales/cripto) */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Plataforma (opcional)
          </Text>
          <TextInput
            value={platform}
            onChangeText={setPlatform}
            placeholder="Ej: Binance, Coinbase, Facebank..."
            placeholderTextColor={themeColors.textSecondary}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 12,
              padding: isSmall ? 12 : 14,
              fontSize: 15,
              color: themeColors.text,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          />

          {/* Icono */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Icono
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountIcons.map((ic) => (
              <TouchableOpacity
                key={ic}
                onPress={() => setIcon(ic)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: icon === ic ? themeColors.primaryLight : themeColors.surface,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: icon === ic ? themeColors.primary : themeColors.border,
                }}
              >
                <Text style={{ fontSize: 22 }}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Color
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountColors.map((c) => (
              <TouchableOpacity
                key={c.hex}
                onPress={() => setColor(c.hex)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: c.hex,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: color === c.hex ? 3 : 0,
                  borderColor: themeColors.surface,
                }}
              >
                {color === c.hex && (
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Saldo Inicial */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8 }}>
            Saldo inicial (opcional)
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: themeColors.usd, marginBottom: 4 }}>USD</Text>
              <TextInput
                value={initialUSD}
                onChangeText={setInitialUSD}
                placeholder="0.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  fontWeight: '600',
                  color: themeColors.usd,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: themeColors.bs, marginBottom: 4 }}>Bs</Text>
              <TextInput
                value={initialBS}
                onChangeText={setInitialBS}
                placeholder="0.00"
                placeholderTextColor={themeColors.textSecondary}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: themeColors.surface,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  fontWeight: '600',
                  color: themeColors.bs,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />
            </View>
          </View>

          {/* Guardar */}
          <TouchableOpacity
            onPress={handleCreate}
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>
              Crear Cuenta
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast Notification */}
      {toastVisible && (
        <View style={{
          position: 'absolute',
          bottom: 40,
          left: 20,
          right: 20,
          backgroundColor: themeColors.text,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
            {toastMessage}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
