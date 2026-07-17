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
import type { AccountType, CurrencyType } from '../../src/utils/types';

// Mapeo de tipos del diseño Kinetic Ledger a tipos existentes
const accountTypeOptions: { key: AccountType; label: string }[] = [
  { key: 'bank', label: 'Corriente' },
  { key: 'cash', label: 'Ahorros' },
  { key: 'exchange', label: 'Digital' },
];

// Iconos del diseño Kinetic Ledger mapeados a Ionicons
const accountIconOptions: { iconName: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { iconName: 'wallet-outline', label: 'Billetera' },
  { iconName: 'business-outline', label: 'Banco' },
  { iconName: 'save-outline', label: 'Ahorros' },
  { iconName: 'card-outline', label: 'Tarjeta' },
  { iconName: 'briefcase-outline', label: 'Trabajo' },
];

// Colores del diseño Kinetic Ledger
const colorOptions = [
  { hex: '#dae2fd', name: 'Azul' },    // primary-fixed
  { hex: '#4edea3', name: 'Verde' },   // secondary
  { hex: '#ffb95f', name: 'Naranja' }, // tertiary
  { hex: '#818cf8', name: 'Púrpura' }, // indigo-400
  { hex: '#ffb4ab', name: 'Rojo' },    // error/danger
];

export default function NewAccountScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { addAccount, loadAccounts } = useAccounts();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<CurrencyType>('BOTH');
  const [icon, setIcon] = useState('wallet-outline');
  const [color, setColor] = useState<string>(colorOptions[0].hex);
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
      platform: null,
    });

    await loadAccounts();
    showToast('✅ Cuenta creada correctamente');
    setTimeout(() => router.back(), 800);
  };

  const inputStyle = {
    backgroundColor: themeColors.surfaceContainer,
    borderWidth: 1,
    borderColor: themeColors.outlineVariant + '50',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: themeColors.text,
  };

  return (
    <AnimatedScreen>
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
        {/* Ambient Background Gradient */}
        <View
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: themeColors.surfaceVariant + '30',
            opacity: 0.3,
          }}
          pointerEvents="none"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <ThemedText type="h1" themeColor="text" style={{ fontSize: 24 }}>
                Nueva Cuenta
              </ThemedText>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: themeColors.surfaceContainer + '99',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <Ionicons name="close" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Account Name */}
            <View style={{ marginBottom: 24 }}>
              <ThemedText
                type="caption"
                themeColor="onSurfaceVariant"
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}
              >
                Nombre de la Cuenta
              </ThemedText>
              <View
                style={[
                  inputStyle,
                  {
                    borderRadius: 12,
                    borderColor: name ? themeColors.secondary + '60' : themeColors.outlineVariant + '50',
                  },
                ]}
              >
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ej. Principal, Ahorros Viaje"
                  placeholderTextColor={themeColors.textSecondary + '80'}
                  style={{
                    fontSize: 15,
                    color: themeColors.text,
                    padding: 0,
                  }}
                />
              </View>
            </View>

            {/* Account Type - Segmented Pill */}
            <View style={{ marginBottom: 24 }}>
              <ThemedText
                type="caption"
                themeColor="onSurfaceVariant"
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}
              >
                Tipo de Cuenta
              </ThemedText>
              <View
                style={{
                  flexDirection: 'row',
                  padding: 4,
                  backgroundColor: themeColors.surfaceContainer + '99',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '20',
                }}
              >
                {accountTypeOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setType(opt.key)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: type === opt.key ? themeColors.surfaceContainerHighest : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <ThemedText
                      type="body"
                      color={type === opt.key ? themeColors.text : themeColors.textSecondary}
                      style={{ fontSize: 13, fontWeight: type === opt.key ? '600' : '400' }}
                    >
                      {opt.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Initial Balance */}
            <View style={{ marginBottom: 24 }}>
              <ThemedText
                type="caption"
                themeColor="onSurfaceVariant"
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}
              >
                Saldo Inicial
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <View
                    style={[
                      inputStyle,
                      {
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderColor: initialUSD ? themeColors.secondary + '60' : themeColors.outlineVariant + '50',
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      themeColor="textSecondary"
                      style={{ fontSize: 16, fontWeight: '500', marginRight: 6 }}
                    >
                      $
                    </ThemedText>
                    <TextInput
                      value={initialUSD}
                      onChangeText={setInitialUSD}
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textSecondary + '80'}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: '600',
                        color: themeColors.usd,
                        padding: 0,
                      }}
                    />
                  </View>
                  <ThemedText
                    type="caption"
                    themeColor="onSurfaceVariant"
                    style={{
                      textAlign: 'center',
                      marginTop: 4,
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    USD
                  </ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <View
                    style={[
                      inputStyle,
                      {
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderColor: initialBS ? themeColors.secondary + '60' : themeColors.outlineVariant + '50',
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      themeColor="textSecondary"
                      style={{ fontSize: 16, fontWeight: '500', marginRight: 6 }}
                    >
                      Bs
                    </ThemedText>
                    <TextInput
                      value={initialBS}
                      onChangeText={setInitialBS}
                      placeholder="0.00"
                      placeholderTextColor={themeColors.textSecondary + '80'}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: '600',
                        color: themeColors.bs,
                        padding: 0,
                      }}
                    />
                  </View>
                  <ThemedText
                    type="caption"
                    themeColor="onSurfaceVariant"
                    style={{
                      textAlign: 'center',
                      marginTop: 4,
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    VES
                  </ThemedText>
                </View>
              </View>
            </View>

            {/* Color Selection Gallery */}
            <View style={{ marginBottom: 24 }}>
              <ThemedText
                type="caption"
                themeColor="onSurfaceVariant"
                style={{
                  marginBottom: 12,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}
              >
                Color de Tema
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                {colorOptions.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setColor(c.hex)}
                    activeOpacity={0.7}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: c.hex,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: color === c.hex ? 3 : 0,
                      borderColor: themeColors.secondary,
                      shadowColor: color === c.hex ? themeColors.secondary : 'transparent',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: color === c.hex ? 0.5 : 0,
                      shadowRadius: 8,
                      elevation: color === c.hex ? 6 : 0,
                    }}
                  >
                    {color === c.hex && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={c.hex === '#dae2fd' || c.hex === '#ffb4ab' ? '#0f172a' : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Icon Selection Gallery */}
            <View style={{ marginBottom: 32 }}>
              <ThemedText
                type="caption"
                themeColor="onSurfaceVariant"
                style={{
                  marginBottom: 12,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  fontWeight: '600',
                }}
              >
                Icono
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {accountIconOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.iconName}
                    onPress={() => setIcon(opt.iconName)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      height: 56,
                      borderRadius: 12,
                      backgroundColor: icon === opt.iconName ? themeColors.secondary : themeColors.surfaceContainer + '99',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: icon === opt.iconName ? themeColors.secondary : themeColors.outlineVariant + '30',
                      shadowColor: icon === opt.iconName ? themeColors.secondary : 'transparent',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: icon === opt.iconName ? 0.2 : 0,
                      shadowRadius: 12,
                      elevation: icon === opt.iconName ? 6 : 0,
                    }}
                  >
                    <Ionicons
                      name={opt.iconName}
                      size={24}
                      color={icon === opt.iconName ? themeColors.text : themeColors.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              onPress={handleCreate}
              activeOpacity={0.9}
              style={{
                backgroundColor: themeColors.secondary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                shadowColor: themeColors.secondary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <ThemedText
                type="button"
                color={themeColors.text}
                style={{ fontSize: 16, fontWeight: '600' }}
              >
                Crear Cuenta
              </ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Toast Notification */}
        {toastVisible && (
          <View
            style={{
              position: 'absolute',
              bottom: 40,
              left: 24,
              right: 24,
              backgroundColor: themeColors.surfaceContainer + '99',
              borderRadius: 14,
              padding: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '30',
              shadowColor: '#0A1E3D',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.7,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            <ThemedText type="button" color={themeColors.text}>
              {toastMessage}
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </AnimatedScreen>
  );
}
