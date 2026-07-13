import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { accountColors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useAccounts } from '../../src/store/useAccounts';
import AnimatedScreen from '../../src/components/AnimatedScreen';
import ThemedText from '../../src/components/ThemedText';
import { shadows } from '../../src/theme/shadows';
import type { AccountType, CurrencyType } from '../../src/utils/types';

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
  const { addAccount, loadAccounts } = useAccounts();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('exchange');
  const [currency, setCurrency] = useState<CurrencyType>('BOTH');
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
      currency,
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
    <AnimatedScreen>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nombre */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Nombre de la cuenta
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ej: Binance, Facebank, Mercantil..."
            placeholderTextColor={themeColors.textSecondary}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              color: themeColors.text,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          />

          {/* Tipo */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Tipo de cuenta
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountTypes.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => setType(t.key)}
                accessibilityLabel={`Tipo de cuenta: ${t.label}`}
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
                <ThemedText style={{ fontSize: 16 }}>{t.icon}</ThemedText>
                <ThemedText type="body" color={type === t.key ? '#FFF' : themeColors.text}>
                  {t.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Moneda */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Moneda
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {(['USD', 'BS', 'BOTH'] as CurrencyType[]).map((cur) => (
              <TouchableOpacity
                key={cur}
                onPress={() => setCurrency(cur)}
                accessibilityLabel={`Moneda: ${cur === 'USD' ? 'USD' : cur === 'BS' ? 'Bolívares' : 'Ambas monedas'}`}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: currency === cur ? themeColors.primary : themeColors.surface,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: currency === cur ? themeColors.primary : themeColors.border,
                }}
              >
                <ThemedText type="bodyMedium" color={currency === cur ? '#FFF' : themeColors.text}>
                  {cur === 'USD' ? 'USD' : cur === 'BS' ? 'BS' : 'Ambas'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Plataforma (para billeteras digitales/cripto) */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Plataforma (opcional)
          </ThemedText>
          <TextInput
            value={platform}
            onChangeText={setPlatform}
            placeholder="Ej: Binance, Coinbase, Facebank..."
            placeholderTextColor={themeColors.textSecondary}
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 12,
              padding: 14,
              fontSize: 15,
              color: themeColors.text,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
          />

          {/* Icono */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Icono
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountIcons.map((ic) => (
              <TouchableOpacity
                key={ic}
                onPress={() => setIcon(ic)}
                accessibilityLabel={`Seleccionar icono ${ic}`}
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
                <ThemedText style={{ fontSize: 22 }}>{ic}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Color */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Color
          </ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {accountColors.map((c) => (
              <TouchableOpacity
                key={c.hex}
                onPress={() => setColor(c.hex)}
                accessibilityLabel={`Seleccionar color ${c.hex}`}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: c.hex,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: color === c.hex ? 3 : 0,
                  borderColor: themeColors.surface,
                }}
              >
                {color === c.hex && (
                  <Ionicons name="checkmark" size={22} color="#FFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Saldo Inicial */}
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8 }}>
            Saldo inicial (opcional)
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
            <View style={{ flex: 1 }}>
              <ThemedText type="badge" themeColor="usd" style={{ marginBottom: 4 }}>USD</ThemedText>
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
              <ThemedText type="badge" themeColor="bs" style={{ marginBottom: 4 }}>Bs</ThemedText>
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
            accessibilityLabel="Crear cuenta"
            style={{
              backgroundColor: themeColors.primary,
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
            }}
          >
            <ThemedText type="button" style={{ color: '#FFF' }}>
              Crear Cuenta
            </ThemedText>
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
          ...shadows.lg,
        }}>
          <ThemedText type="button" style={{ color: '#FFF' }}>
            {toastMessage}
          </ThemedText>
        </View>
      )}
    </SafeAreaView>
    </AnimatedScreen>
  );
}
