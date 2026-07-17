import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import GlassCard from '../../src/components/GlassCard';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { formatUSD, formatBS } from '../../src/utils/format';
import type { RateType } from '../../src/utils/types';
import type { ThemeMode } from '../../src/store/useSettings';
import { exportData, shareFile } from '../../src/services/export';
import { shareBackup, importBackup, getLastBackupInfo } from '../../src/services/backup';
import { testDeepSeekConnection } from '../../src/services/deepseek';

export default function SettingsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const systemColorScheme = useColorScheme();
  const {
    deepseekKey, setDeepseekKey,
    manualRate, setManualRate,
    manualRateType, setManualRateType,
    useDarkMode, setUseDarkMode,
    themeMode, setThemeMode,
    preferredRateType, setPreferredRateType,
    expectedMonthlyIncome, setExpectedMonthlyIncome,
  } = useSettings();
  const {
    bcv: bcvRate,
    parallel: parallelRate,
    loading: ratesLoading,
    lastUpdated: ratesLastUpdated,
    refresh: refreshRates,
  } = useExchangeRates();
  const [showDeepseek, setShowDeepseek] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [rateInput, setRateInput] = useState(manualRate?.toString() || '');
  const [incomeInput, setIncomeInput] = useState(expectedMonthlyIncome > 0 ? expectedMonthlyIncome.toString() : '');
  const [backupInfo, setBackupInfo] = useState<{ exists: boolean; fileName: string | null; fileSize: string | null; fileDate: string | null }>({ exists: false, fileName: null, fileSize: null, fileDate: null });
  const [importing, setImporting] = useState(false);

  // Cargar info del respaldo al enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      getLastBackupInfo().then(setBackupInfo).catch(() => {});
    }, [])
  );

  const handleUpdateRate = async () => {
    await refreshRates();
    Alert.alert(
      'Actualizado',
      `BCV: ${bcvRate ? formatBS(bcvRate.rateUSDToBS) : 'No disponible'}\nParalelo: ${parallelRate ? formatBS(parallelRate.rateUSDToBS) : 'No disponible'}`
    );
  };

  const handleSaveManualRate = () => {
    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate <= 0) {
      Alert.alert('Error', 'Ingresa una tasa válida');
      return;
    }
    setManualRate(rate);
    const label = manualRateType === 'BCV' ? 'BCV (Oficial)' : 'Paralelo (USDT)';
    Alert.alert('Guardado', `Tasa manual ${label}: ${formatBS(rate)}`);
    setShowRate(false);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const fileUri = await exportData({ format });
      await shareFile(fileUri);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo exportar los datos');
    } finally {
      setExporting(false);
    }
  }, []);

  const showExportOptions = useCallback(() => {
    Alert.alert(
      'Exportar datos',
      'Selecciona el formato para exportar tus transacciones:',
      [
        {
          text: '📄 CSV (Excel)',
          onPress: () => handleExport('csv'),
        },
        {
          text: '📋 JSON',
          onPress: () => handleExport('json'),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  }, [handleExport]);

  const rateOptions: { label: string; value: RateType; icon: string }[] = [
    { label: 'Paralelo (USDT)', value: 'PARALLEL', icon: '💱' },
    { label: 'BCV (Oficial)', value: 'BCV', icon: '🏛️' },
  ];

  // Refrescar tasas al recibir foco
  useFocusEffect(
    useCallback(() => {
      refreshRates();
    }, [refreshRates])
  );


  const inputStyle = {
    backgroundColor: themeColors.surfaceContainer,
    borderWidth: 1,
    borderColor: themeColors.outlineVariant + '50',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: themeColors.text,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: themeColors.primaryContainer,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: themeColors.outlineVariant + '50',
              }}>
                <Ionicons name="person" size={20} color={themeColors.secondary} />
              </View>
              <View>
                <ThemedText type="body" themeColor="text" style={{ fontSize: 16, fontWeight: '600' }}>
                  Buenos días
                </ThemedText>
                <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 12 }}>
                  Mis Finanzas
                </ThemedText>
              </View>
            </View>
            <TouchableOpacity
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={themeColors.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Page Title */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24, marginTop: 16 }}>
          <ThemedText type="h1" themeColor="text" style={{ fontSize: 24 }}>
            Ajustes
          </ThemedText>
          <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 14, marginTop: 4 }}>
            Gestiona tus preferencias e integraciones
          </ThemedText>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {/* Expected Monthly Income */}
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="cash" size={20} color={themeColors.secondary} />
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Ingreso Mensual Esperado
              </ThemedText>
            </View>
            <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginBottom: 12 }}>
              Usado para cálculos de presupuesto y proyecciones
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1, position: 'relative' }}>
                <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 }}>
                  <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 16 }}>$</ThemedText>
                </View>
                <TextInput
                  style={[inputStyle, { paddingLeft: 28, fontSize: 18, fontWeight: '600', textAlign: 'right' }]}
                  placeholder="0.00"
                  placeholderTextColor={themeColors.outline}
                  keyboardType="decimal-pad"
                  value={incomeInput}
                  onChangeText={setIncomeInput}
                  accessibilityLabel="Ingreso mensual esperado en USD"
                />
              </View>
              <TouchableOpacity
                accessibilityLabel="Guardar ingreso mensual"
                onPress={() => {
                  const amount = parseFloat(incomeInput);
                  if (!isNaN(amount) && amount >= 0) {
                    setExpectedMonthlyIncome(amount);
                  }
                }}
                style={{
                  backgroundColor: themeColors.secondary,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: themeColors.secondary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <Ionicons name="checkmark" size={20} color={themeColors.background} />
              </TouchableOpacity>
            </View>
            {expectedMonthlyIncome > 0 && (
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ marginTop: 8 }}>
                Actual: {formatUSD(expectedMonthlyIncome)}
              </ThemedText>
            )}
          </GlassCard>

          {/* Integrations & APIs */}
          <GlassCard noPadding>
            <TouchableOpacity
              accessibilityLabel={showDeepseek ? 'Ocultar configuración de APIs' : 'Mostrar configuración de APIs'}
              onPress={() => setShowDeepseek(!showDeepseek)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 20,
                borderBottomWidth: showDeepseek ? 1 : 0,
                borderBottomColor: themeColors.outlineVariant + '30',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={20} color={themeColors.secondary} />
                <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                  Integraciones & APIs
                </ThemedText>
              </View>
              <Ionicons
                name={showDeepseek ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={themeColors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {showDeepseek && (
              <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 14 }}>
                {/* DeepSeek API */}
                <View style={{ gap: 8 }}>
                  <ThemedText type="small" themeColor="onSurfaceVariant" style={{ letterSpacing: 0.5 }}>
                    DeepSeek API Key (Asistente IA)
                  </ThemedText>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={deepseekKey}
                      onChangeText={(text) => { setDeepseekKey(text); }}
                      placeholder="sk-..."
                      placeholderTextColor={themeColors.outline}
                      secureTextEntry
                      style={[inputStyle, { flex: 1 }]}
                    />
                    <TouchableOpacity
                      accessibilityLabel="Probar conexión con DeepSeek"
                      onPress={async () => {
                        const result = await testDeepSeekConnection(deepseekKey);
                        Alert.alert('DeepSeek', result.message);
                      }}
                      style={{
                        backgroundColor: themeColors.surfaceVariant,
                        borderRadius: 10,
                        paddingHorizontal: 16,
                        justifyContent: 'center',
                      }}
                    >
                      <ThemedText type="button" themeColor="text" style={{ fontSize: 12 }}>
                        Probar
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: themeColors.outlineVariant + '30' }} />

                {/* Exchange Rates */}
                <View style={{ gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <ThemedText type="small" themeColor="onSurfaceVariant" style={{ letterSpacing: 0.5 }}>
                      Tasas de Cambio
                    </ThemedText>
                    <TouchableOpacity
                      accessibilityLabel="Actualizar tasas"
                      onPress={handleUpdateRate}
                      disabled={ratesLoading}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="sync" size={14} color={themeColors.secondary} />
                      <ThemedText type="small" style={{ color: themeColors.secondary, fontSize: 11 }}>
                        Actualizar
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  <View style={{
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '50',
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText type="body" themeColor="text" style={{ fontSize: 14 }}>BCV (Oficial)</ThemedText>
                      <ThemedText type="body" style={{ color: themeColors.secondary, fontWeight: '600' }}>
                        {bcvRate ? formatBS(bcvRate.rateUSDToBS) : '—'}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={{
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '50',
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ThemedText type="body" themeColor="text" style={{ fontSize: 14 }}>Paralelo (USDT)</ThemedText>
                      <ThemedText type="body" style={{ color: themeColors.tertiary, fontWeight: '600' }}>
                        {parallelRate ? formatBS(parallelRate.rateUSDToBS) : '—'}
                      </ThemedText>
                    </View>
                  </View>

                  {ratesLastUpdated && (
                    <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ textAlign: 'right', fontSize: 11 }}>
                      Última actualización: {ratesLastUpdated.toLocaleString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </ThemedText>
                  )}

                  {/* Rate Preference Toggle */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 13 }}>
                      Tasa por defecto para cálculos
                    </ThemedText>
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: themeColors.surfaceContainerHigh,
                      borderRadius: 8,
                      padding: 2,
                    }}>
                      {([{ label: 'BCV', value: 'BCV' as RateType }, { label: 'Paralelo', value: 'PARALLEL' as RateType }]).map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setPreferredRateType(opt.value)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                            backgroundColor: preferredRateType === opt.value ? themeColors.secondary + '20' : 'transparent',
                          }}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color: preferredRateType === opt.value ? themeColors.secondary : themeColors.onSurfaceVariant,
                              fontSize: 11,
                            }}
                          >
                            {opt.label}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Manual Rate */}
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {([{ label: 'BCV', value: 'BCV' as RateType, icon: 'business-outline' as const }, { label: 'Paralelo', value: 'PARALLEL' as RateType, icon: 'trending-up-outline' as const }]).map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setManualRateType(opt.value)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: manualRateType === opt.value ? themeColors.secondary + '20' : themeColors.surfaceContainer,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: manualRateType === opt.value ? themeColors.secondary + '30' : themeColors.outlineVariant + '30',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name={opt.icon} size={14} color={manualRateType === opt.value ? themeColors.secondary : themeColors.onSurfaceVariant} />
                            <ThemedText
                              type="small"
                              style={{
                                color: manualRateType === opt.value ? themeColors.secondary : themeColors.onSurfaceVariant,
                                fontSize: 11,
                              }}
                            >
                              {opt.label}
                            </ThemedText>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={rateInput}
                        onChangeText={setRateInput}
                        placeholder="Tasa manual USD→Bs"
                        placeholderTextColor={themeColors.outline}
                        keyboardType="decimal-pad"
                        style={[inputStyle, { flex: 1 }]}
                      />
                      <TouchableOpacity
                        accessibilityLabel="Guardar tasa manual"
                        onPress={handleSaveManualRate}
                        style={{
                          backgroundColor: themeColors.secondary,
                          borderRadius: 10,
                          paddingHorizontal: 16,
                          justifyContent: 'center',
                          shadowColor: themeColors.secondary,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 12,
                          elevation: 6,
                        }}
                      >
                        <ThemedText style={{ color: themeColors.background, fontWeight: '600', fontSize: 13 }}>
                          Guardar
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                    {manualRate !== null && (
                      <TouchableOpacity
                        accessibilityLabel="Quitar tasa manual"
                        onPress={() => {
                          setManualRate(null);
                          setRateInput('');
                          Alert.alert('Tasa automática', 'Se ha eliminado la tasa manual. Ahora se usarán las tasas automáticas de la BD.');
                        }}
                        style={{
                          backgroundColor: themeColors.danger + '20',
                          borderRadius: 10,
                          padding: 10,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: themeColors.danger + '30',
                        }}
                      >
                        <ThemedText style={{ color: themeColors.danger, fontWeight: '600', fontSize: 13 }}>
                          Quitar tasa manual
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            )}
          </GlassCard>

          {/* Management */}
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="folder-open" size={20} color={themeColors.secondary} />
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Gestión
              </ThemedText>
            </View>

            <TouchableOpacity
              accessibilityLabel="Ir a Cuentas"
              onPress={() => router.push('/(tabs)/accounts')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 12,
                backgroundColor: themeColors.surfaceContainer,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: themeColors.secondary + '10',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="wallet" size={16} color={themeColors.secondary} />
                </View>
                <ThemedText type="body" themeColor="text" style={{ fontSize: 15 }}>
                  Cuentas
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Ir a Categorías"
              onPress={() => router.push('/categories')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 12,
                backgroundColor: themeColors.surfaceContainer,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: themeColors.tertiary + '10',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="folder" size={16} color={themeColors.tertiary} />
                </View>
                <ThemedText type="body" themeColor="text" style={{ fontSize: 15 }}>
                  Categorías
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceVariant} />
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Ir a Deudas y Préstamos"
              onPress={() => router.push('/(tabs)/debts')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: 12,
                backgroundColor: themeColors.surfaceContainer,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: themeColors.danger + '10',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons name="cash" size={16} color={themeColors.danger} />
                </View>
                <ThemedText type="body" themeColor="text" style={{ fontSize: 15 }}>
                  Deudas y Préstamos
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceVariant} />
            </TouchableOpacity>
          </GlassCard>

          {/* Appearance */}
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Ionicons name="color-palette-outline" size={20} color={themeColors.secondary} />
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Apariencia
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { key: 'light' as ThemeMode, icon: 'sunny-outline' as const, label: 'Claro' },
                { key: 'dark' as ThemeMode, icon: 'moon-outline' as const, label: 'Oscuro' },
                { key: 'system' as ThemeMode, icon: 'phone-portrait-outline' as const, label: 'Sistema' },
              ]).map((option) => {
                const isActive = themeMode === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    accessibilityLabel={`Tema ${option.label}`}
                    onPress={() => {
                      setThemeMode(option.key);
                      if (option.key === 'dark') setUseDarkMode(true);
                      else if (option.key === 'light') setUseDarkMode(false);
                      else setUseDarkMode(systemColorScheme === 'dark');
                    }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      gap: 8,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: isActive ? 2 : 1,
                      borderColor: isActive ? themeColors.secondary : themeColors.outlineVariant + '50',
                      backgroundColor: isActive ? themeColors.secondary + '08' : 'transparent',
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={isActive ? themeColors.secondary : themeColors.onSurfaceVariant}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: isActive ? themeColors.secondary : themeColors.onSurfaceVariant,
                        fontSize: 11,
                      }}
                    >
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>

          {/* Data Management */}
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Ionicons name="server-outline" size={20} color={themeColors.secondary} />
              <ThemedText type="h3" themeColor="text" style={{ fontSize: 18 }}>
                Gestión de Datos
              </ThemedText>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                accessibilityLabel="Exportar CSV"
                onPress={() => handleExport('csv')}
                disabled={exporting}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <Ionicons name="download-outline" size={20} color={themeColors.text} />
                <ThemedText type="small" themeColor="text" style={{ fontSize: 11 }}>
                  Exportar CSV
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Exportar JSON"
                onPress={() => handleExport('json')}
                disabled={exporting}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                <Ionicons name="code-slash-outline" size={20} color={themeColors.text} />
                <ThemedText type="small" themeColor="text" style={{ fontSize: 11 }}>
                  Exportar JSON
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: themeColors.outlineVariant + '30' }} />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                accessibilityLabel="Respaldar base de datos"
                onPress={async () => {
                  try {
                    await shareBackup();
                    const info = await getLastBackupInfo();
                    setBackupInfo(info);
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'No se pudo crear el respaldo');
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.secondary + '10',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: themeColors.secondary + '30',
                }}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={themeColors.secondary} />
                <ThemedText type="small" style={{ color: themeColors.secondary, fontSize: 11 }}>
                  Respaldar
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Restaurar respaldo"
                onPress={async () => {
                  if (importing) return;
                  setImporting(true);
                  try {
                    const success = await importBackup();
                    if (success) {
                      Alert.alert(
                        'Restaurado',
                        'Base de datos restaurada correctamente. La app se cerrará para aplicar los cambios.',
                        [{ text: 'OK' }]
                      );
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message || 'No se pudo restaurar el respaldo');
                  } finally {
                    setImporting(false);
                  }
                }}
                style={{
                  flex: 1,
                  backgroundColor: themeColors.surfaceContainer,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}
              >
                {importing ? (
                  <ActivityIndicator size="small" color={themeColors.text} />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={20} color={themeColors.text} />
                    <ThemedText type="small" themeColor="text" style={{ fontSize: 11 }}>
                      Restaurar
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {backupInfo.exists && (
              <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11, textAlign: 'center' }}>
                Último respaldo: {backupInfo.fileSize} • {backupInfo.fileDate}
              </ThemedText>
            )}
          </GlassCard>

          {/* Danger Zone */}
          <GlassCard padding={20}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="warning-outline" size={20} color={themeColors.danger} />
              <ThemedText type="h3" style={{ color: themeColors.danger, fontSize: 18 }}>
                Zona de Peligro
              </ThemedText>
            </View>
            <ThemedText type="body" themeColor="onSurfaceVariant" style={{ fontSize: 13, marginBottom: 16 }}>
              Elimina permanentemente tu cuenta y todos los datos financieros asociados.
            </ThemedText>
            <TouchableOpacity
              style={{
                backgroundColor: themeColors.danger + '10',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: themeColors.danger + '30',
              }}
            >
              <ThemedText style={{ color: themeColors.danger, fontWeight: '600', fontSize: 14 }}>
                Eliminar Cuenta
              </ThemedText>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
