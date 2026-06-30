import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AnimatedTransition from '../../src/components/AnimatedTransition';
import { colors } from '../../src/theme/colors';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { useExchangeRates } from '../../src/hooks/useExchangeRates';
import { useSettings } from '../../src/store/useSettings';
import { formatBS } from '../../src/utils/format';
import type { RateType } from '../../src/utils/types';
import { exportData, shareFile } from '../../src/services/export';

export default function SettingsScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const {
    deepseekKey, setDeepseekKey,
    manualRate, setManualRate,
    useDarkMode, setUseDarkMode,
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
    Alert.alert('Guardado', `Tasa manual: ${formatBS(rate)}`);
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
    <AnimatedTransition>
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: themeColors.text, marginBottom: 24 }}>
          Ajustes
        </Text>

        {/* Sección APIs */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          APIs
        </Text>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
          <TouchableOpacity
            onPress={() => setShowDeepseek(!showDeepseek)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="sparkles" size={18} color={themeColors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                  DeepSeek API Key
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                  {deepseekKey ? '✓ Configurada' : 'No configurada'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          {showDeepseek && (
            <View style={{ padding: 16 }}>
              <TextInput
                value={deepseekKey}
                onChangeText={setDeepseekKey}
                placeholder="sk-..."
                placeholderTextColor={themeColors.textSecondary}
                secureTextEntry
                style={{
                  backgroundColor: themeColors.background,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  color: themeColors.text,
                  borderWidth: 1,
                  borderColor: themeColors.border,
                }}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowRate(!showRate)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: themeColors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="trending-up" size={18} color={themeColors.warning} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                  Tasas de Cambio
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                  {manualRate ? `Manual: ${formatBS(manualRate)}` : 'Automática'}
                </Text>
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
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>🏛️ BCV</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text }}>
                    {bcvRate ? formatBS(bcvRate.rateUSDToBS) : '—'}
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: themeColors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>💱 Paralelo (USDT)</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.text }}>
                    {parallelRate ? formatBS(parallelRate.rateUSDToBS) : '—'}
                  </Text>
                </View>
                {ratesLastUpdated && (
                  <Text style={{
                    fontSize: 10,
                    color: themeColors.textSecondary,
                    textAlign: 'right',
                    marginTop: 4,
                  }}>
                    Última actualización: {ratesLastUpdated.toLocaleString('es-VE', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                onPress={handleUpdateRate}
                disabled={ratesLoading}
                style={{
                  backgroundColor: themeColors.primary,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: 'center',
                  opacity: ratesLoading ? 0.6 : 1,
                }}
              >
                {ratesLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>
                    Actualizar tasas automáticas
                  </Text>
                )}
              </TouchableOpacity>

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
                    borderWidth: 1,
                    borderColor: themeColors.border,
                  }}
                />
                <TouchableOpacity
                  onPress={handleSaveManualRate}
                  style={{
                    backgroundColor: themeColors.success,
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Sección Cálculos */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Cálculos
        </Text>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="calculator" size={18} color={themeColors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                  Tasa para calcular Bs total
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                  Usar tasa {preferredRateType === 'BCV' ? 'BCV (Oficial)' : 'Paralelo (USDT)'}
                </Text>
              </View>
            </View>

            {rateOptions.map((option) => {
              const isSelected = preferredRateType === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
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
                    <Text style={{
                      fontSize: 14,
                      fontWeight: isSelected ? '600' : '400',
                      color: themeColors.text,
                    }}>
                      {option.label}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={themeColors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            <Text style={{
              fontSize: 11,
              color: themeColors.textSecondary,
              marginTop: 8,
              lineHeight: 16,
            }}>
              Esta tasa se usará para convertir tus saldos en USD a Bs en la pantalla principal.
              {manualRate && ` Actualmente hay una tasa manual de ${formatBS(manualRate)} configurada.`}
            </Text>
          </View>
        </View>

        {/* Sección Gestión */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Gestión
        </Text>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
          <TouchableOpacity style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.successLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="wallet" size={18} color={themeColors.success} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                Cuentas
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
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
              <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                Categorías
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/debts')}
            style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: themeColors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="cash" size={18} color="#DC2626" />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                Deudas y Préstamos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección Datos */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Datos
        </Text>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24, overflow: 'hidden' }}>
          <TouchableOpacity
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
              <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                Exportar datos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Sección Apariencia */}
        <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Apariencia
        </Text>
        <View style={{ backgroundColor: themeColors.surface, borderRadius: 16, marginBottom: 24 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="moon" size={18} color={themeColors.primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>
                Modo oscuro
              </Text>
            </View>
            <Switch
              value={useDarkMode}
              onValueChange={setUseDarkMode}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor="#FFF"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </AnimatedTransition>
  );
}
