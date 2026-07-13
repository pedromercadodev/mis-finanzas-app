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
import { colors } from '../../src/theme/colors';
import { shadows } from '../../src/theme/shadows';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import ThemedText from '../../src/components/ThemedText';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { formatBS } from '../../src/utils/format';
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

  // Refrescar tasas al recibir foco (navegar a la pestaña)
  useFocusEffect(
    useCallback(() => {
      refreshRates();
    }, [refreshRates])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <ThemedText type="h1" themeColor="text" style={{ marginBottom: 24 }}>
          Ajustes
        </ThemedText>

        {/* Sección APIs */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          APIs
        </ThemedText>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...shadows.md }}>
          <TouchableOpacity
            accessibilityLabel={showDeepseek ? 'Ocultar configuración de DeepSeek' : 'Configurar DeepSeek API Key'}
            onPress={() => setShowDeepseek(!showDeepseek)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={18} color={themeColors.primary} />
              </View>
              <View>
                <ThemedText type="body" themeColor="text">
                  DeepSeek API Key
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {deepseekKey ? '✓ Configurada' : 'No configurada'}
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          {showDeepseek && (
            <View style={{ padding: 16, gap: 10 }}>
              <TextInput
                value={deepseekKey}
                onChangeText={(text) => { setDeepseekKey(text); }}
                placeholder="sk-..."
                placeholderTextColor={themeColors.textSecondary}
                secureTextEntry
                style={{
                  backgroundColor: themeColors.background,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  color: themeColors.text,
                  ...shadows.sm,
                }}
              />
              <TouchableOpacity
                accessibilityLabel="Probar conexión con DeepSeek"
                onPress={async () => {
                  const result = await testDeepSeekConnection(deepseekKey);
                  Alert.alert('DeepSeek', result.message);
                }}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: 'center',
                  ...shadows.primary,
                }}
              >
                <ThemedText style={{ color: '#FFF' }} type="button">
                  Probar conexión
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            accessibilityLabel={showRate ? 'Ocultar tasas de cambio' : 'Configurar tasas de cambio'}
            onPress={() => setShowRate(!showRate)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="trending-up" size={18} color={themeColors.warning} />
              </View>
              <View>
                <ThemedText type="body" themeColor="text">
                  Tasas de Cambio
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {manualRate ? `Manual ${manualRateType === 'BCV' ? 'BCV' : 'Paralelo'}: ${formatBS(manualRate)}` : 'Automática'}
                </ThemedText>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          {showRate && (
            <View style={{ padding: 16, gap: 12 }}>
              {/* Tasas actuales desde la BD */}
              <View style={{
                backgroundColor: themeColors.background,
                borderRadius: 12,
                padding: 12,
                gap: 8,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText type="caption" themeColor="textSecondary">BCV</ThemedText>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '700' }}>
                    {bcvRate ? formatBS(bcvRate.rateUSDToBS) : '—'}
                  </ThemedText>
                </View>
                <View style={{ height: 1, backgroundColor: themeColors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ThemedText type="caption" themeColor="textSecondary">Paralelo (USDT)</ThemedText>
                  <ThemedText type="body" themeColor="text" style={{ fontWeight: '700' }}>
                    {parallelRate ? formatBS(parallelRate.rateUSDToBS) : '—'}
                  </ThemedText>
                </View>
                {ratesLastUpdated && (
                  <ThemedText type="badge" themeColor="textSecondary" style={{ textAlign: 'right', marginTop: 4 }}>
                    Última actualización: {ratesLastUpdated.toLocaleString('es-VE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </ThemedText>
                )}
              </View>

              <TouchableOpacity
                accessibilityLabel="Actualizar tasas automáticas"
                onPress={handleUpdateRate}
                disabled={ratesLoading}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: 'center',
                  opacity: ratesLoading ? 0.6 : 1,
                  ...shadows.primary,
                }}
              >
                {ratesLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={{ color: '#FFF' }} type="button">
                    Actualizar tasas automáticas
                  </ThemedText>
                )}
              </TouchableOpacity>

              {/* Selector de tipo para tasa manual */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([{ label: 'BCV', value: 'BCV' as RateType, icon: 'business-outline' as const }, { label: 'Paralelo', value: 'PARALLEL' as RateType, icon: 'trending-up-outline' as const }]).map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    accessibilityLabel={`Seleccionar tipo de tasa ${opt.label}`}
                    onPress={() => setManualRateType(opt.value)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: manualRateType === opt.value ? themeColors.primary : themeColors.background,
                      alignItems: 'center',
                      minHeight: 44,
                      justifyContent: 'center',
                      ...(manualRateType === opt.value ? shadows.primary : shadows.sm),
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name={opt.icon} size={16} color={manualRateType === opt.value ? '#FFF' : themeColors.textSecondary} />
                      <ThemedText
                        type="buttonSmall"
                        color={manualRateType === opt.value ? '#FFF' : themeColors.textSecondary}
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
                  placeholderTextColor={themeColors.textSecondary}
                  keyboardType="decimal-pad"
                  style={{
                    flex: 1,
                    backgroundColor: themeColors.background,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: themeColors.text,
                    ...shadows.sm,
                  }}
                />
                <TouchableOpacity
                  accessibilityLabel="Guardar tasa manual"
                  onPress={handleSaveManualRate}
                  style={{
                    backgroundColor: themeColors.success,
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                    ...shadows.sm,
                  }}
                >
                  <ThemedText style={{ color: '#FFF' }} type="button">Guardar</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Botón para volver a tasas automáticas */}
              {manualRate !== null && (
                <TouchableOpacity
                  accessibilityLabel="Quitar tasa manual y volver a automática"
                  onPress={() => {
                    setManualRate(null);
                    setRateInput('');
                    Alert.alert('Tasa automática', 'Se ha eliminado la tasa manual. Ahora se usarán las tasas automáticas de la BD.');
                  }}
                  style={{
                    backgroundColor: themeColors.danger,
                    borderRadius: 10,
                    padding: 12,
                    alignItems: 'center',
                    ...shadows.sm,
                  }}
                >
                  <ThemedText style={{ color: '#FFF' }} type="button">
                    Quitar tasa manual (volver a automática)
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Sección Cálculos */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Cálculos
        </ThemedText>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...shadows.md }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="calculator" size={18} color={themeColors.primary} />
              </View>
              <View>
                <ThemedText type="body" themeColor="text">
                  Tasa para calcular Bs total
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  Usar tasa {preferredRateType === 'BCV' ? 'BCV (Oficial)' : 'Paralelo (USDT)'}
                </ThemedText>
              </View>
            </View>

            {rateOptions.map((option) => {
              const isSelected = preferredRateType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityLabel={`Seleccionar tasa ${option.label} para cálculos`}
                  onPress={() => setPreferredRateType(option.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: isSelected ? themeColors.primaryLight + '30' : 'transparent',
                    borderRadius: 10,
                    marginBottom: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 18 }}>{option.icon}</Text>
                    <ThemedText
                      type="body"
                      themeColor="text"
                      style={{ fontWeight: isSelected ? '600' : '400' }}
                    >
                      {option.label}
                    </ThemedText>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={themeColors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 8, lineHeight: 16 }}>
              Esta tasa se usará para convertir tus saldos en USD a Bs en la pantalla principal.
              {manualRate && ` Actualmente hay una tasa manual de ${formatBS(manualRate)} configurada.`}
            </ThemedText>
          </View>
        </View>

        {/* Sección Gestión */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Gestión
        </ThemedText>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...shadows.md }}>
          <TouchableOpacity
            accessibilityLabel="Ir a Cuentas"
            onPress={() => router.push('/(tabs)/accounts')}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.successLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="wallet" size={18} color={themeColors.success} />
              </View>
              <ThemedText type="body" themeColor="text">
                Cuentas
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Ir a Categorías"
            onPress={() => router.push('/categories')}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="folder" size={18} color={themeColors.primary} />
              </View>
              <ThemedText type="body" themeColor="text">
                Categorías
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Ir a Deudas y Préstamos"
            onPress={() => router.push('/(tabs)/debts')}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="cash" size={18} color="#DC2626" />
              </View>
              <ThemedText type="body" themeColor="text">
                Deudas y Préstamos
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección Datos */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Datos
        </ThemedText>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...shadows.md }}>
          <TouchableOpacity
            accessibilityLabel="Exportar datos"
            onPress={showExportOptions}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="download" size={18} color={themeColors.warning} />
              </View>
              <ThemedText type="body" themeColor="text">
                Exportar datos
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="cloud-upload" size={18} color="#2563EB" />
              </View>
              <View>
                <ThemedText type="body" themeColor="text">
                  Respaldar base de datos
                </ThemedText>
                {backupInfo.exists && (
                  <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 2 }}>
                    Último: {backupInfo.fileSize} • {backupInfo.fileDate}
                  </ThemedText>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Restaurar respaldo de base de datos"
            onPress={async () => {
              if (importing) return;
              setImporting(true);
              try {
                const success = await importBackup();
                if (success) {
                  Alert.alert(
                    'Restaurado',
                    'Base de datos restaurada correctamente. La app se cerrará para aplicar los cambios.',
                    [{ text: 'OK', onPress: () => { /* El usuario debe reiniciar la app */ } }]
                  );
                }
              } catch (error: any) {
                Alert.alert('Error', error.message || 'No se pudo restaurar el respaldo');
              } finally {
                setImporting(false);
              }
            }}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.dangerLight, justifyContent: 'center', alignItems: 'center' }}>
                {importing ? (
                  <ActivityIndicator size="small" color={themeColors.danger} />
                ) : (
                  <Ionicons name="cloud-download" size={18} color={themeColors.danger} />
                )}
              </View>
              <ThemedText type="body" themeColor="text">
                Restaurar respaldo
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección Apariencia */}
        <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Apariencia
        </ThemedText>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden', ...shadows.md }}>
          {([
            { key: 'light' as ThemeMode, icon: 'sunny', label: 'Claro' },
            { key: 'dark' as ThemeMode, icon: 'moon', label: 'Oscuro' },
            { key: 'system' as ThemeMode, icon: 'phone-portrait', label: 'Sistema' },
          ]).map((option, index) => {
            const isActive = themeMode === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                accessibilityLabel={`Tema ${option.label}`}
                onPress={() => {
                  setThemeMode(option.key);
                  // Sincronizar useDarkMode para compatibilidad con código legacy
                  if (option.key === 'dark') setUseDarkMode(true);
                  else if (option.key === 'light') setUseDarkMode(false);
                  else setUseDarkMode(systemColorScheme === 'dark');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 16,
                  backgroundColor: isActive ? themeColors.primaryLight : 'transparent',
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: isActive ? themeColors.primary : themeColors.primaryLight,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons
                      name={option.icon as any}
                      size={18}
                      color={isActive ? '#FFF' : themeColors.primary}
                    />
                  </View>
                  <ThemedText type="body" themeColor="text">
                    {option.label}
                  </ThemedText>
                </View>
                {isActive && (
                  <Ionicons name="checkmark-circle" size={22} color={themeColors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
