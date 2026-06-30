import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Markdown from 'react-native-markdown-display';
import { useThemeColors } from '../src/hooks/useThemeColors';
import { useSettings } from '../src/store/useSettings';
import { useAccounts } from '../src/store/useAccounts';
import { useTransactions } from '../src/store/useTransactions';
import { chatWithDeepSeek } from '../src/services/deepseek';
import { createTransaction } from '../src/services/transactions';
import { createAccount, updateAccount } from '../src/services/accounts';
import { getCategories } from '../src/services/categories';
import {
  saveChatMessage,
  getChatHistory,
  getChatSessions,
  clearChatHistory,
  type ChatHistoryMessage,
} from '../src/services/chatHistory';
import type { DeepSeekMessage, DeepSeekAction, TransactionAction, CreateAccountAction, UpdateAccountAction } from '../src/services/deepseek';
import type { Category } from '../src/utils/types';

// Mapeo de nombres de categoría a IDs numéricos
const CATEGORY_MAP: Record<string, number> = {
  'Comida': 1,
  'Transporte': 2,
  'Salud': 3,
  'Educacion': 4,
  'Educación': 4,
  'Entretenimiento': 5,
  'Vivienda': 6,
  'Servicios': 7,
  'Ropa': 8,
  'Salario': 9,
  'Freelance': 10,
  'Inversiones': 11,
  'Otros': 12,
};

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: DeepSeekAction;
  isAction?: boolean;
  isConfirmed?: boolean;
  isCancelled?: boolean;
  isSuccess?: boolean;
}

// Genera estilos para Markdown basados en el tema
function getMarkdownStyles(textColor: string, surfaceColor: string, bgColor: string) {
  return {
    body: { color: textColor, fontSize: 15, lineHeight: 22 },
    strong: { fontWeight: '700' as const },
    em: { fontStyle: 'italic' as const },
    text: { color: textColor },
    link: { color: '#818CF8' },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#6366F1',
      paddingLeft: 10,
      marginVertical: 4,
    },
    code_inline: {
      backgroundColor: surfaceColor,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 13,
    },
    fence: {
      backgroundColor: bgColor,
      borderRadius: 8,
      padding: 10,
      marginVertical: 6,
    },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    list_item: { marginVertical: 1 },
  };
}

export default function AIChatScreen() {
  const router = useRouter();
  const themeColors = useThemeColors();
  const { deepseekKey, useDarkMode } = useSettings();
  const accounts = useAccounts((s) => s.accounts);
  const loadAccounts = useAccounts((s) => s.loadAccounts);
  const loadTransactions = useTransactions((s) => s.loadTransactions);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState<{ id: string; preview: string; date: string; count: number }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Cargar historial y categorías al montar
  useEffect(() => {
    loadCategories();
    loadChatHistory();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const history = await getChatHistory();
      if (history.length > 0) {
        // Convertir historial a mensajes del chat
        const chatMessages: ChatMessage[] = history.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        setMessages(chatMessages);
      } else {
        // Mensaje de bienvenida si no hay historial
        setMessages([
          {
            id: '0',
            role: 'assistant',
            content: '¡Hola! 👋 Soy tu **asistente financiero**. Puedes pedirme cosas como:\n\n' +
              '💸 *"Gaste 50 dólares en uber"*\n' +
              '💰 *"Recibí 200 dólares de salario"*\n' +
              '🏦 *"Crea una cuenta de ahorro"*\n' +
              '✏️ *"Cambia el nombre de mi cuenta X a Y"*\n' +
              '📊 *"¿Cuánto dinero tengo?"*',
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  // Scroll al último mensaje
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Agregar mensaje al historial y persistirlo
  const addMessage = useCallback(async (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
    scrollToBottom();

    // Persistir en AsyncStorage (solo mensajes de texto, no acciones)
    if (!msg.isAction) {
      await saveChatMessage({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString(),
      });
    }
  }, [scrollToBottom]);

  // Enviar mensaje a DeepSeek
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const trimmedText = text.trim();
    setInputText('');

    // Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedText,
    };
    await addMessage(userMsg);

    // Verificar API Key
    if (!deepseekKey) {
      await addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ No has configurado tu **API Key de DeepSeek**. Ve a **Ajustes > DeepSeek API Key** para configurarla.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Construir historial para DeepSeek
      const history: DeepSeekMessage[] = messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.isAction))
        .map((m) => ({
          role: m.role,
          content: m.isAction && m.action
            ? `ACCION: ${JSON.stringify(m.action)}`
            : m.content,
        }));

      // Agregar el mensaje actual
      history.push({ role: 'user', content: trimmedText });

      const response = await chatWithDeepSeek(history, accounts, categories, deepseekKey);

      if (response.type === 'action' && response.action) {
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content || '¿Quieres que ejecute esta operación?',
          action: response.action,
          isAction: true,
        });
      } else {
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content,
        });
      }
    } catch (error: any) {
      await addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Error:** ${error?.message || 'Algo salió mal'}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, deepseekKey, messages, accounts, categories, addMessage]);

  // Confirmar acción
  const confirmAction = useCallback(async (msg: ChatMessage) => {
    if (!msg.action) return;

    setIsLoading(true);

    try {
      const action = msg.action;

      if (action.actionType === 'transaction') {
        // === CREAR TRANSACCIÓN ===
        const txAction = action as TransactionAction;
        const categoryId = CATEGORY_MAP[txAction.category] || 12;

        const transaction: any = {
          type: txAction.type,
          description: txAction.description,
          amountUSD: txAction.currency === 'USD' ? txAction.amount : null,
          amountBS: txAction.currency === 'BS' ? txAction.amount : null,
          currency: txAction.currency,
          exchangeRate: null,
          accountId: accounts[0]?.id || 1,
          transferToAccountId: null,
          categoryId,
          date: new Date().toISOString().split('T')[0],
          notes: null,
        };

        await createTransaction(transaction);
        await loadAccounts();
        await loadTransactions();

        const currencySymbol = txAction.currency === 'USD' ? '$' : 'Bs.';
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se registró un ${txAction.type === 'expense' ? 'gasto' : 'ingreso'} de **${currencySymbol}${txAction.amount}** en "${txAction.description}" (${txAction.category}).`,
          isSuccess: true,
        });

      } else if (action.actionType === 'create_account') {
        // === CREAR CUENTA ===
        const accAction = action as CreateAccountAction;

        await createAccount({
          name: accAction.name,
          type: accAction.type,
          currency: accAction.currency,
          initialBalanceUSD: accAction.initialBalanceUSD || 0,
          initialBalanceBS: accAction.initialBalanceBS || 0,
          icon: accAction.icon || '👛',
          color: accAction.color || '#6366F1',
          isActive: 1,
          platform: null,
        });

        await loadAccounts();

        const balanceParts: string[] = [];
        if (accAction.initialBalanceUSD > 0) balanceParts.push(`**$${accAction.initialBalanceUSD} USD**`);
        if (accAction.initialBalanceBS > 0) balanceParts.push(`**Bs.${accAction.initialBalanceBS}**`);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se creó la cuenta **"${accAction.name}"** (${accAction.type === 'cash' ? 'Efectivo' : accAction.type === 'bank' ? 'Banco' : accAction.type === 'virtual_card' ? 'Tarjeta Virtual' : accAction.type === 'exchange' ? 'Exchange' : 'Otro'})${balanceParts.length > 0 ? ` con saldo inicial de ${balanceParts.join(' y ')}` : ''}.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'update_account') {
        // === ACTUALIZAR CUENTA ===
        const updAction = action as UpdateAccountAction;

        // Buscar la cuenta: primero por accountId, si no existe buscar por nombre anterior
        let targetAccount = accounts.find((a) => a.id === updAction.accountId);
        
        // Si no se encontró por ID pero hay un nombre en la acción, buscar por nombre
        if (!targetAccount && updAction.name) {
          // DeepSeek a veces envía el nombre en accountId cuando se confunde
          const possibleId = parseInt(String(updAction.accountId), 10);
          if (isNaN(possibleId)) {
            // Buscar por nombre en accountId
            targetAccount = accounts.find(
              (a) => a.name.toLowerCase() === String(updAction.accountId).toLowerCase()
            );
          }
        }

        if (!targetAccount) {
          await addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ No encontré la cuenta que quieres modificar. Las cuentas disponibles son:\n${accounts.map((a) => `- **${a.name}** (ID: ${a.id})`).join('\n')}\n\n¿Podrías decirme exactamente cuál quieres modificar?`,
            isSuccess: false,
          });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m
            )
          );
          setIsLoading(false);
          return;
        }

        const updates: Partial<any> = {};
        if (updAction.name) updates.name = updAction.name;
        if (updAction.icon) updates.icon = updAction.icon;
        if (updAction.color) updates.color = updAction.color;

        await updateAccount(targetAccount.id, updates);
        await loadAccounts();

        const changes: string[] = [];
        if (updAction.name) changes.push(`nombre a **"${updAction.name}"**`);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se actualizó la cuenta **"${targetAccount.name}"**: ${changes.join(', ')}.`,
          isSuccess: true,
        });
      }

      // Marcar mensaje como confirmado
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, isConfirmed: true, isAction: false } : m
        )
      );

    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo completar la operación');
    } finally {
      setIsLoading(false);
    }
  }, [accounts, loadAccounts, loadTransactions, addMessage]);

  // Cancelar acción
  const cancelAction = useCallback((msg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m
      )
    );

    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '❌ **Operación cancelada.** No se realizaron cambios.',
    });
  }, [addMessage]);

  // Iniciar reconocimiento de voz
  const startListening = useCallback(async () => {
    const SpeechRecognition = (global as any).SpeechRecognition ||
      (global as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsListening(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
        setTimeout(() => sendMessage(transcript), 500);
      };

      recognition.onerror = () => {
        setIsListening(false);
        Alert.alert(
          'Reconocimiento de voz',
          'No se pudo reconocer la voz. Asegúrate de haber concedido permisos de micrófono.'
        );
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      Alert.alert(
        'Dictado por voz',
        'Usa el botón de micrófono del teclado de iOS para dictar, o escribe tu mensaje.'
      );
    }
  }, [sendMessage]);

  // Abrir historial
  const openHistory = useCallback(async () => {
    const sessions = await getChatSessions();
    setChatSessions(sessions);
    setShowHistory(true);
  }, []);

  // Cargar una sesión del historial
  const loadSession = useCallback(async (sessionId: string) => {
    setShowHistory(false);
    try {
      const history = await getChatHistory();
      const startIndex = history.findIndex((m) => m.id === sessionId);
      if (startIndex === -1) return;

      const sessionMsgs: ChatMessage[] = [];
      let lastTimestamp: string | null = null;
      for (let i = startIndex; i < history.length; i++) {
        const msg = history[i];
        if (lastTimestamp) {
          const timeDiff = new Date(msg.timestamp).getTime() - new Date(lastTimestamp).getTime();
          if (timeDiff > 30 * 60 * 1000) break;
        }
        lastTimestamp = msg.timestamp;
        sessionMsgs.push({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        });
      }

      if (sessionMsgs.length > 0) {
        setMessages(sessionMsgs);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, []);

  // Limpiar historial
  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Limpiar historial',
      '¿Estás seguro de que quieres eliminar todo el historial de conversaciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            await clearChatHistory();
            setMessages([
              {
                id: Date.now().toString(),
                role: 'assistant',
                content: '🧹 **Historial limpiado.** ¿En qué puedo ayudarte?',
              },
            ]);
            setShowHistory(false);
          },
        },
      ]
    );
  }, []);

  // Renderizar cada mensaje
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    const mdStyle = isUser ? undefined : getMarkdownStyles(themeColors.text, themeColors.surface, themeColors.background);

    return (
      <View
        style={{
          alignItems: isUser ? 'flex-end' : 'flex-start',
          marginBottom: 12,
          paddingHorizontal: 16,
        }}
      >
        {/* Burbuja de mensaje */}
        <View
          style={{
            maxWidth: '88%',
            backgroundColor: isUser
              ? themeColors.primary
              : themeColors.surface,
            borderRadius: 16,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
            padding: 12,
            borderWidth: isUser ? 0 : 1,
            borderColor: themeColors.border,
          }}
        >
          {isUser ? (
            <Text
              style={{
                fontSize: 15,
                color: '#FFF',
                lineHeight: 20,
              }}
            >
              {item.content}
            </Text>
          ) : (
            <Markdown style={mdStyle}>
              {item.content}
            </Markdown>
          )}

          {/* Preview de transacción */}
          {item.action && item.action.actionType === 'transaction' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: item.action.type === 'expense' ? '#EF4444' : '#10B981',
              }}
            >
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                {item.action.type === 'expense' ? '💸 GASTO' : '💰 INGRESO'}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {item.action.currency === 'USD' ? '$' : 'Bs.'}
                {item.action.amount}
              </Text>
              <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                {item.action.description}
              </Text>
              <View
                style={{
                  backgroundColor: themeColors.primaryLight + '40',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  alignSelf: 'flex-start',
                  marginTop: 6,
                }}
              >
                <Text style={{ fontSize: 11, color: themeColors.primary, fontWeight: '600' }}>
                  {item.action.category}
                </Text>
              </View>
            </View>
          )}

          {/* Preview de creación de cuenta */}
          {item.action && item.action.actionType === 'create_account' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: '#6366F1',
              }}
            >
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                🏦 NUEVA CUENTA
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {item.action.name}
              </Text>
              <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                Tipo: {item.action.type === 'cash' ? 'Efectivo' : item.action.type === 'bank' ? 'Banco' : item.action.type === 'virtual_card' ? 'Tarjeta Virtual' : item.action.type === 'exchange' ? 'Exchange/Pago Móvil' : 'Otro'}
              </Text>
              <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                Moneda: {item.action.currency === 'BOTH' ? 'USD y BS' : item.action.currency}
              </Text>
              {(item.action.initialBalanceUSD > 0 || item.action.initialBalanceBS > 0) && (
                <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                  Saldo inicial: {item.action.initialBalanceUSD > 0 ? `$${item.action.initialBalanceUSD} USD` : ''}{item.action.initialBalanceUSD > 0 && item.action.initialBalanceBS > 0 ? ' + ' : ''}{item.action.initialBalanceBS > 0 ? `Bs.${item.action.initialBalanceBS}` : ''}
                </Text>
              )}
            </View>
          )}

          {/* Preview de actualizar cuenta */}
          {item.action && item.action.actionType === 'update_account' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: '#F59E0B',
              }}
            >
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ✏️ ACTUALIZAR CUENTA
              </Text>
              {item.action.name && (
                <Text style={{ fontSize: 14, color: themeColors.text }}>
                  Nuevo nombre: <Text style={{ fontWeight: '700' }}>{item.action.name}</Text>
                </Text>
              )}
              <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 4 }}>
                Account ID: {item.action.accountId}
              </Text>
            </View>
          )}
        </View>

        {/* Botones de Confirmar/Cancelar */}
        {item.isAction && !item.isConfirmed && !item.isCancelled && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              marginTop: 8,
            }}
          >
            <TouchableOpacity
              onPress={() => confirmAction(item)}
              disabled={isLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: themeColors.success,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 8,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>
                Confirmar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => cancelAction(item)}
              disabled={isLoading}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 8,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Indicador de confirmado */}
        {item.isConfirmed && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
            }}
          >
            <Ionicons name="checkmark-circle" size={14} color={themeColors.success} />
            <Text style={{ fontSize: 12, color: themeColors.success }}>
              Operación completada ✅
            </Text>
          </View>
        )}

        {/* Indicador de cancelado */}
        {item.isCancelled && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
            }}
          >
            <Ionicons name="close-circle" size={14} color="#EF4444" />
            <Text style={{ fontSize: 12, color: '#EF4444' }}>
              Cancelado
            </Text>
          </View>
        )}
      </View>
    );
  }, [themeColors, confirmAction, cancelAction, isLoading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles" size={20} color={themeColors.primary} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: themeColors.text }}>
              Asistente IA
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={openHistory}>
              <Ionicons name="time-outline" size={22} color={themeColors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')}>
              <Ionicons name="settings-outline" size={22} color={themeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mensajes */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{
            paddingVertical: 16,
            flexGrow: 1,
          }}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
        />

        {/* Indicador de carga */}
        {isLoading && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 8,
            }}
          >
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
              Pensando...
            </Text>
          </View>
        )}

        {/* Indicador de escucha */}
        {isListening && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 8,
              backgroundColor: themeColors.primaryLight + '40',
            }}
          >
            <ActivityIndicator size="small" color={themeColors.primary} />
            <Text style={{ fontSize: 13, color: themeColors.primary, fontWeight: '600' }}>
              Escuchando...
            </Text>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: themeColors.border,
            backgroundColor: themeColors.background,
          }}
        >
          {/* Botón micrófono */}
          <TouchableOpacity
            onPress={startListening}
            disabled={isListening}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isListening ? '#EF4444' : themeColors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={isListening ? 'mic' : 'mic-outline'}
              size={20}
              color={isListening ? '#FFF' : themeColors.text}
            />
          </TouchableOpacity>

          {/* Input de texto */}
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe o dicta tu mensaje..."
            placeholderTextColor={themeColors.textSecondary}
            multiline
            maxLength={500}
            style={{
              flex: 1,
              backgroundColor: themeColors.surface,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: themeColors.text,
              maxHeight: 100,
              borderWidth: 1,
              borderColor: themeColors.border,
            }}
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit
          />

          {/* Botón enviar */}
          <TouchableOpacity
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: inputText.trim() && !isLoading
                ? themeColors.primary
                : themeColors.surface,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="send"
              size={18}
              color={inputText.trim() && !isLoading ? '#FFF' : themeColors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de Historial */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistory(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: '70%',
              paddingBottom: 30,
            }}
          >
            {/* Header del modal */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: themeColors.text }}>
                📋 Historial
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={handleClearHistory}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <Ionicons name="close" size={22} color={themeColors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista de sesiones */}
            {chatSessions.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="chatbubbles-outline" size={40} color={themeColors.textSecondary} />
                <Text style={{ fontSize: 15, color: themeColors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                  No hay conversaciones guardadas aún.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {chatSessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => loadSession(session.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: themeColors.border + '60',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: themeColors.primary + '20',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color={themeColors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: themeColors.text,
                        }}
                        numberOfLines={1}
                      >
                        {session.preview}
                      </Text>
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                        {session.date} · {session.count} mensajes
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
