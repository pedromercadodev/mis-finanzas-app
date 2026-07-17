import { useState, useRef, useEffect, useCallback } from 'react';
import { getLocalDateString } from '../src/utils/date';
import {
  View,
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
import { createTransaction, updateTransaction, deleteTransaction } from '../src/services/transactions';
import { createAccount, updateAccount, deleteAccount } from '../src/services/accounts';
import { getCategories } from '../src/services/categories';
import { createGoal, updateGoalProgress, deleteGoal } from '../src/services/goals';
import { createSubscription, updateSubscription, deleteSubscription } from '../src/services/subscriptions';
import { setAllocation } from '../src/services/budgetAllocations';
import { createDebt, recordPayment, deleteDebt } from '../src/services/debts';
import GlassCard from '../src/components/GlassCard';
import {
  saveChatMessage,
  getChatHistory,
  getChatSessions,
  getSessionMessages,
  clearChatHistory,
  type ChatHistoryMessage,
} from '../src/services/chatHistory';
import AnimatedScreen from '../src/components/AnimatedScreen';
import ThemedText from '../src/components/ThemedText';
import type { DeepSeekMessage, DeepSeekAction, TransactionAction, CreateAccountAction, UpdateAccountAction, TransferAction, CreateGoalAction, UpdateGoalProgressAction, DeleteGoalAction, CreateSubscriptionAction, UpdateSubscriptionAction, DeleteSubscriptionAction, SetBudgetAction, CreateDebtAction, PayDebtAction, DeleteDebtAction, UpdateTransactionAction, DeleteTransactionAction, DeleteAccountAction } from '../src/services/deepseek';
import type { Category } from '../src/utils/types';

// ============================================================
// Funciones helper (fuera del componente para ser reutilizables)
// ============================================================

/**
 * Construye un mapa dinámico de nombre de categoría → ID a partir
 * del array de categorías obtenido de la BD.
 */
function buildCategoryMap(categories: Category[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const cat of categories) {
    map[cat.name] = cat.id;
  }
  return map;
}

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

/**
 * Genera un resumen del historial antiguo de forma asíncrona (no bloqueante).
 * Se llama en segundo plano para mantener el sliding window.
 */
async function generarResumenAsync(
  historialAntiguo: DeepSeekMessage[],
  apiKey: string
): Promise<string | null> {
  if (!apiKey || historialAntiguo.length === 0) return null;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Resume la siguiente conversación financiera en 2-3 oraciones. Incluye solo la información relevante: transacciones registradas, cuentas creadas, metas, deudas, y preferencias del usuario. Ignora saludos y mensajes triviales.',
          },
          {
            role: 'user',
            content: historialAntiguo
              .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
              .join('\n'),
          },
        ],
        temperature: 0.0,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch {
    return null; // Si falla el resumen, se ignora silenciosamente
  }
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

  // T15: UI de razonamiento - pasos visibles
  const [thinkingStep, setThinkingStep] = useState<string | null>(null);
  const thinkingSteps = useRef<string[]>([]);
  const thinkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sliding Window: mantener un resumen del historial antiguo
  const ULTIMOS_MSGS = 6;
  const resumenAntiguoRef = useRef<string>('');
  const resumiendoRef = useRef<boolean>(false);

  // Mapa dinámico de categorías (se actualiza cuando cambian las categorías)
  const categoryMapRef = useRef<Record<string, number>>({});

  // Estado para el selector de cuenta cuando hay múltiples cuentas
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<ChatMessage | null>(null);
  const [pendingAccountCallback, setPendingAccountCallback] = useState<((accountId: number) => void) | null>(null);


  /**
   * Sanitiza texto ingresado por el usuario o proveniente del LLM
   * para prevenir HTML/script injection y limitar longitud.
   */
  const sanitizeInput = useCallback((text: string | null | undefined, maxLength: number = 200): string => {
    if (!text) return '';
    // Eliminar etiquetas HTML/XML
    let clean = text.replace(/<[^>]*>/g, '');
    // Eliminar caracteres de control (excepto saltos de línea básicos)
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    // Limitar longitud
    clean = clean.slice(0, maxLength);
    return clean.trim();
  }, []);

  // ============================================================
  // T14: Manejo de errores granular
  // ============================================================

  /**
   * Obtiene un mensaje de error específico según el tipo de error.
   */
  const getErrorMessage = useCallback((error: any, context?: string): string => {
    if (!error) return '⚠️ **Error inesperado.** Intenta de nuevo.';

    const msg = (error?.message || String(error)).toLowerCase();

    // Errores de red / conexión
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('enqueue') ||
        msg.includes('timeout') || msg.includes('abort') || msg.includes('econnrefused')) {
      return '🌐 **Error de conexión.** Verifica tu conexión a internet y vuelve a intentar.';
    }

    // Error de API Key
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key') ||
        msg.includes('authentication') || msg.includes('invalid key')) {
      return '🔑 **API Key inválida.** Ve a Ajustes > DeepSeek API Key para verificar tu clave.';
    }

    // Error de DeepSeek (rate limit, servidor ocupado)
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return '⏳ **Demasiadas solicitudes.** Espera unos segundos y vuelve a intentar.';
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('service')) {
      return '🔧 **El servidor de DeepSeek está temporalmente ocupado.** Intenta de nuevo en un momento.';
    }

    // Error de base de datos
    if (msg.includes('database') || msg.includes('sqlite') || msg.includes('sql') ||
        msg.includes('disk') || msg.includes('storage')) {
      return '💾 **Error de base de datos.** Reinicia la aplicación o contacta al soporte.';
    }

    // Error de validación de datos
    if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required') ||
        msg.includes('not found') || msg.includes('no such')) {
      return `📋 **Error de validación.** ${context ? context + ' ' : ''}Revisa los datos e intenta de nuevo.`;
    }

    // Error de parseo JSON
    if (msg.includes('json') || msg.includes('parse') || msg.includes('syntax')) {
      return '🔍 **Error al procesar la respuesta.** Intenta reformular tu mensaje.';
    }

    // Error genérico con código HTTP
    const httpMatch = error?.message?.match(/\b(\d{3})\b/);
    if (httpMatch) {
      return `🌐 **Error HTTP ${httpMatch[1]}.** Verifica tu conexión e intenta de nuevo.`;
    }

    // Fallback: mensaje genérico pero útil
    return `⚠️ **Error:** ${error?.message || 'Algo salió mal inesperadamente.'} Intenta de nuevo o contacta al soporte.`;
  }, []);

  // ============================================================
  // T15: UI de razonamiento - pasos visibles
  // ============================================================

  /**
   * Inicia la animación de pasos de razonamiento.
   */
  const startThinking = useCallback(() => {
    thinkingSteps.current = [
      '🔍 Analizando tu mensaje...',
      '🤔 Procesando solicitud...',
      '📊 Consultando datos...',
      '✍️ Preparando respuesta...',
    ];
    let stepIndex = 0;
    setThinkingStep(thinkingSteps.current[0]);

    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
    }

    thinkingTimerRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < thinkingSteps.current.length) {
        setThinkingStep(thinkingSteps.current[stepIndex]);
      } else {
        // Mantener el último paso
        setThinkingStep('✍️ Finalizando...');
      }
    }, 2500);
  }, []);

  /**
   * Detiene la animación de razonamiento.
   */
  const stopThinking = useCallback(() => {
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }
    setThinkingStep(null);
  }, []);

  // Cargar historial y categorías al montar
  useEffect(() => {
    loadCategories();
    loadChatHistory();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getCategories();
      setCategories(cats);
      categoryMapRef.current = buildCategoryMap(cats);
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
            content: '¡Hola! 👋 Soy tu **asistente financiero**. Puedo ayudarte con **todo**:\n\n' +
              '💸 *"Gaste 50 dólares en uber"*\n' +
              '💰 *"Recibí 200 dólares de salario"*\n' +
              '🏦 *"Crea una cuenta de ahorro"*\n' +
              '✏️ *"Cambia el nombre de mi cuenta X a Y"*\n' +
              '🗑️ *"Elimina la cuenta X"*\n' +
              '🔄 *"Transfiere $30 de cuenta X a Y"*\n' +
              '🎯 *"Crea una meta de ahorro de $500"*\n' +
              '📅 *"Agrega suscripción de Netflix $15"*\n' +
              ' *"Pon presupuesto de $200 en Comida"*\n' +
              '💳 *"Registra deuda de $100 con Juan"*\n' +
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
    startThinking();

    try {
      // Construir historial para DeepSeek con Sliding Window
      const allHistory: DeepSeekMessage[] = messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.isAction))
        .map((m) => ({
          role: m.role,
          content: m.isAction && m.action
            ? `ACCION: ${JSON.stringify(m.action)}`
            : m.content,
        }));

      // Agregar el mensaje actual
      allHistory.push({ role: 'user', content: trimmedText });

      // Sliding Window: mantener últimos N mensajes + resumen asíncrono de los antiguos
      let history: DeepSeekMessage[] = allHistory;
      if (allHistory.length > ULTIMOS_MSGS) {
        const antiguos = allHistory.slice(0, -ULTIMOS_MSGS);
        const recientes = allHistory.slice(-ULTIMOS_MSGS);

        // Si hay un resumen previo, lo usamos; si no, generamos uno en segundo plano
        if (resumenAntiguoRef.current) {
          history = [
            { role: 'system', content: `[Resumen de la conversación anterior: ${resumenAntiguoRef.current}]` },
            ...recientes,
          ];
        } else {
          history = recientes;
        }

        // Generar resumen asíncrono en segundo plano (no bloquea la respuesta)
        if (!resumiendoRef.current) {
          resumiendoRef.current = true;
          generarResumenAsync(antiguos, deepseekKey)
            .then((resumen) => {
              if (resumen) {
                resumenAntiguoRef.current = resumen;
              }
            })
            .catch(() => {})
            .finally(() => {
              resumiendoRef.current = false;
            });
        }
      }

      const response = await chatWithDeepSeek(history, accounts, categories, deepseekKey);

      if (response.type === 'action' && response.action) {
        const msgId = (Date.now() + 1).toString();
        const newMsg: ChatMessage = {
          id: msgId,
          role: 'assistant',
          content: response.content || '¿Quieres que ejecute esta operación?',
          action: response.action,
          isAction: true,
        };

        // Si skip_confirmation es true, ejecutar directamente sin mostrar botones
        if ((response.action as any).skip_confirmation === true) {
          await addMessage({ ...newMsg, isConfirmed: true });
          // Ejecutar la acción inmediatamente
          setTimeout(() => confirmAction(newMsg), 100);
        } else {
          await addMessage(newMsg);
        }
      } else {
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.content,
        });
      }
    } catch (error: any) {
      // T14: Manejo de errores granular
      const errorMsg = getErrorMessage(error, 'No se pudo procesar tu solicitud.');
      console.error('[AI-CHAT ERROR]', error?.message || error);
      await addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
      });
    } finally {
      setIsLoading(false);
      stopThinking();
    }
  }, [isLoading, deepseekKey, messages, accounts, categories, addMessage, startThinking, stopThinking, getErrorMessage]);

  // Buscar cuenta por nombre o ID
  const findAccount = useCallback((identifier: string | number) => {
    if (typeof identifier === 'number') {
      return accounts.find((a) => a.id === identifier);
    }
    return accounts.find((a) => a.name.toLowerCase() === String(identifier).toLowerCase());
  }, [accounts]);

  // Función helper para ejecutar una transacción (reutilizada por el selector de cuenta)
  const executeTransaction = useCallback(async (
    txAction: TransactionAction,
    categoryId: number,
    accountId: number,
    msg: ChatMessage
  ) => {
    const transaction: any = {
      type: txAction.type,
      description: sanitizeInput(txAction.description, 200),
      amountUSD: txAction.currency === 'USD' ? txAction.amount : null,
      amountBS: txAction.currency === 'BS' ? txAction.amount : null,
      currency: txAction.currency,
      exchangeRate: null,
      accountId,
      transferToAccountId: null,
      categoryId,
      date: getLocalDateString(),
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

    // Marcar mensaje como confirmado
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, isConfirmed: true, isAction: false } : m
      )
    );
  }, [sanitizeInput, loadAccounts, loadTransactions, addMessage]);

  // Confirmar acción
  const confirmAction = useCallback(async (msg: ChatMessage) => {
    if (!msg.action) return;

    setIsLoading(true);

    try {
      const action = msg.action;

      if (action.actionType === 'transaction') {
        // === CREAR TRANSACCIÓN ===
        const txAction = action as TransactionAction;
        const categoryId = categoryMapRef.current[txAction.category] || 12;

        // Si hay múltiples cuentas y no se especificó accountId, preguntar al usuario
        if (accounts.length > 1 && !(txAction as any).accountId) {
          setPendingAction(msg);
          setPendingAccountCallback(() => async (selectedAccountId: number) => {
            await executeTransaction(txAction, categoryId, selectedAccountId, msg);
          });
          setShowAccountPicker(true);
          setIsLoading(false);
          return;
        }

        const accountId = (txAction as any).accountId || accounts[0]?.id || 1;
        await executeTransaction(txAction, categoryId, accountId, msg);

      } else if (action.actionType === 'update_transaction') {
        // === ACTUALIZAR TRANSACCIÓN ===
        const updTx = action as UpdateTransactionAction;
        const updates: any = {};
        if (updTx.type) updates.type = updTx.type;
        if (updTx.amount !== undefined) {
          if (updTx.currency === 'USD') updates.amountUSD = updTx.amount;
          else if (updTx.currency === 'BS') updates.amountBS = updTx.amount;
        }
        if (updTx.description) updates.description = sanitizeInput(updTx.description, 200);
        if (updTx.category) updates.categoryId = categoryMapRef.current[updTx.category] || 12;

        await updateTransaction(updTx.transactionId, updates);
        await loadTransactions();

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se actualizó la transacción.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'delete_transaction') {
        // === ELIMINAR TRANSACCIÓN ===
        const delTx = action as DeleteTransactionAction;
        await deleteTransaction(delTx.transactionId);
        await loadTransactions();

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se eliminó la transacción.`,
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
        let targetAccount = findAccount(updAction.accountId);

        if (!targetAccount) {
          await addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ No encontré la cuenta. Las disponibles son:\n${accounts.map((a) => `- **${a.name}**`).join('\n')}\n\n¿Cuál quieres modificar?`,
            isSuccess: false,
          });
          setMessages((prev) =>
            prev.map((m) => m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m)
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

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se actualizó la cuenta **"${targetAccount.name}"** → **"${updAction.name || targetAccount.name}"**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'delete_account') {
        // === ELIMINAR CUENTA ===
        const delAcc = action as DeleteAccountAction;
        let targetAccount = findAccount(delAcc.accountId);

        if (!targetAccount) {
          await addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ No encontré la cuenta. Las disponibles son:\n${accounts.map((a) => `- **${a.name}**`).join('\n')}`,
            isSuccess: false,
          });
          setMessages((prev) =>
            prev.map((m) => m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m)
          );
          setIsLoading(false);
          return;
        }

        await deleteAccount(targetAccount.id);
        await loadAccounts();

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se eliminó la cuenta **"${targetAccount.name}"**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'transfer') {
        // === TRANSFERENCIA ===
        const trf = action as TransferAction;
        const fromAcc = findAccount(trf.fromAccountId);
        const toAcc = findAccount(trf.toAccountId);

        if (!fromAcc || !toAcc) {
          await addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ No encontré una de las cuentas. Cuentas disponibles:\n${accounts.map((a) => `- **${a.name}**`).join('\n')}`,
            isSuccess: false,
          });
          setMessages((prev) =>
            prev.map((m) => m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m)
          );
          setIsLoading(false);
          return;
        }

        await createTransaction({
          type: 'transfer',
          description: sanitizeInput(trf.description, 200) || `Transferencia a ${sanitizeInput(toAcc.name, 50)}`,
          amountUSD: trf.currency === 'USD' ? trf.amount : null,
          amountBS: trf.currency === 'BS' ? trf.amount : null,
          currency: trf.currency,
          exchangeRate: null,
          accountId: fromAcc.id,
          transferToAccountId: toAcc.id,
          categoryId: 12,
          date: getLocalDateString(),
          notes: null,
        });

        await loadAccounts();
        await loadTransactions();

        const sym = trf.currency === 'USD' ? '$' : 'Bs.';
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se transfirieron **${sym}${trf.amount}** de **"${fromAcc.name}"** a **"${toAcc.name}"**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'create_goal') {
        // === CREAR META ===
        const goal = action as CreateGoalAction;
        await createGoal({
          name: sanitizeInput(goal.name, 100),
          targetAmount: goal.targetAmount,
          currentAmount: 0,
          currency: goal.currency,
          accountId: goal.accountId || null,
          deadline: goal.deadline || null,
          periodType: 'none',
          celebratedAt: null,
          lastProgressAt: null,
        });

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se creó la meta **"${goal.name}"** con objetivo de **${goal.currency === 'USD' ? '$' : 'Bs.'}${goal.targetAmount}**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'update_goal_progress') {
        // === ACTUALIZAR PROGRESO DE META ===
        const gp = action as UpdateGoalProgressAction;
        await updateGoalProgress(gp.goalId, gp.amount);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se agregaron **${gp.amount}** al progreso de la meta.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'delete_goal') {
        // === ELIMINAR META ===
        const dg = action as DeleteGoalAction;
        await deleteGoal(dg.goalId);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se eliminó la meta.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'create_subscription') {
        // === CREAR SUSCRIPCIÓN ===
        const sub = action as CreateSubscriptionAction;
        const catId = categoryMapRef.current[sub.category] || 12;

        await createSubscription({
          name: sanitizeInput(sub.name, 100),
          description: sanitizeInput(sub.description, 200) || null,
          amountUSD: sub.currency === 'USD' ? sub.amount : null,
          amountBS: sub.currency === 'BS' ? sub.amount : null,
          currency: sub.currency,
          categoryId: catId,
          accountId: sub.accountId,
          frequency: sub.frequency,
          intervalDays: null,
          billingDay: sub.billingDay,
          nextBillingDate: getLocalDateString(),
          isActive: 1,
          autoGenerate: 1,
          notes: null,
        });

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se creó la suscripción **"${sub.name}"** de **${sub.currency === 'USD' ? '$' : 'Bs.'}${sub.amount}** (${sub.frequency}).`,
          isSuccess: true,
        });

      } else if (action.actionType === 'update_subscription') {
        // === ACTUALIZAR SUSCRIPCIÓN ===
        const us = action as UpdateSubscriptionAction;
        const subUpdates: any = {};
        if (us.name) subUpdates.name = us.name;
        if (us.amount !== undefined) {
          if (us.currency === 'USD') subUpdates.amountUSD = us.amount;
          else if (us.currency === 'BS') subUpdates.amountBS = us.amount;
        }
        if (us.frequency) subUpdates.frequency = us.frequency;
        if (us.isActive !== undefined) subUpdates.isActive = us.isActive ? 1 : 0;

        await updateSubscription(us.subscriptionId, subUpdates);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se actualizó la suscripción.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'delete_subscription') {
        // === ELIMINAR SUSCRIPCIÓN ===
        const ds = action as DeleteSubscriptionAction;
        await deleteSubscription(ds.subscriptionId);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se eliminó la suscripción.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'set_budget') {
        // === ESTABLECER PRESUPUESTO ===
        const budget = action as SetBudgetAction;
        const catId = categoryMapRef.current[budget.category] || 12;
        const monthStr = budget.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

        await setAllocation(catId, monthStr, budget.amountUSD, budget.amountBS || 0);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se estableció un presupuesto de **$${budget.amountUSD} USD**${budget.amountBS ? ` y **Bs.${budget.amountBS}**` : ''} para "${budget.category}".`,
          isSuccess: true,
        });

      } else if (action.actionType === 'create_debt') {
        // === CREAR DEUDA ===
        const debt = action as CreateDebtAction;
        const debtType = debt.type || 'borrowed';
        await createDebt({
          personName: sanitizeInput(debt.personName, 100),
          description: sanitizeInput(debt.description, 200) || null,
          type: debtType,
          amountUSD: debt.currency === 'USD' ? debt.amount : null,
          amountBS: debt.currency === 'BS' ? debt.amount : null,
          currency: debt.currency,
          interestRate: 0,
          totalAmountUSD: debt.currency === 'USD' ? debt.amount : null,
          totalAmountBS: debt.currency === 'BS' ? debt.amount : null,
          paidAmountUSD: 0,
          paidAmountBS: 0,
          dueDate: debt.dueDate || null,
          status: 'active',
          notes: null,
        });

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se registró la deuda ${debtType === 'lent' ? 'que prestaste a' : 'que debes a'} **${debt.personName}** por **${debt.currency === 'USD' ? '$' : 'Bs.'}${debt.amount}**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'pay_debt') {
        // === PAGAR DEUDA ===
        const pay = action as PayDebtAction;
        await recordPayment(
          pay.debtId,
          pay.currency === 'USD' ? pay.amount : 0,
          pay.currency === 'BS' ? pay.amount : 0,
          getLocalDateString()
        );

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se registró un pago de **${pay.currency === 'USD' ? '$' : 'Bs.'}${pay.amount}** a la deuda.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'delete_debt') {
        // === ELIMINAR DEUDA ===
        const dd = action as DeleteDebtAction;
        await deleteDebt(dd.debtId);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se eliminó la deuda.`,
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
      const errorMsg = getErrorMessage(error, 'No se pudo ejecutar la acción.');
      console.error('[AI-CHAT CONFIRM ERROR]', error?.message || error);
      await addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Error al ejecutar:** ${errorMsg}`,
        isSuccess: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accounts, addMessage, executeTransaction, findAccount, getErrorMessage, loadAccounts, loadTransactions, sanitizeInput]);

  // Cancelar acción
  const cancelAction = useCallback(async (msg: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m
      )
    );

    await addMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '❌ Operación cancelada. ¿Necesitas algo más?',
    });
  }, [addMessage]);

  // ============================================================
  // Reconocimiento de voz (SpeechRecognition API)
  // ============================================================
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      Alert.alert('No soportado', 'El reconocimiento de voz no está disponible en este dispositivo.');
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? prev + ' ' + transcript : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        Alert.alert('Error', 'No se pudo reconocer tu voz. Intenta de nuevo.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      Alert.alert('Error', 'No se pudo iniciar el reconocimiento de voz.');
    }
  }, []);

  // ============================================================
  // Historial de sesiones
  // ============================================================
  const openHistory = useCallback(async () => {
    try {
      const sessions = await getChatSessions();
      setChatSessions(sessions);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const history = await getSessionMessages(sessionId);
      if (history.length > 0) {
        const chatMessages: ChatMessage[] = history.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        setMessages(chatMessages);
      }
      setShowHistory(false);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }, []);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      'Limpiar historial',
      '¿Estás seguro de eliminar todo el historial de conversaciones?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await clearChatHistory();
            setMessages([]);
            setShowHistory(false);
            loadChatHistory();
          },
        },
      ]
    );
  }, []);

  // ============================================================
  // Renderizar mensaje individual
  // ============================================================
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const isAction = item.isAction && !item.isConfirmed && !item.isCancelled;
    const isSuccess = item.isSuccess;
    const isCancelled = item.isCancelled;

    const mdStyles = getMarkdownStyles(
      isUser ? themeColors.onSecondaryContainer : themeColors.text,
      themeColors.surfaceContainer,
      themeColors.surfaceContainerHigh
    );

    if (isUser) {
      return (
        <View style={{
          flexDirection: 'row',
          width: '100%',
          justifyContent: 'flex-end',
          marginBottom: 16,
          paddingHorizontal: 24,
        }}>
          <View style={{
            backgroundColor: themeColors.secondaryContainer,
            borderRadius: 16,
            borderTopRightRadius: 4,
            padding: 16,
            maxWidth: '85%',
            shadowColor: '#0A1E3D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
            elevation: 4,
          }}>
            <Markdown style={mdStyles}>
              {item.content}
            </Markdown>
          </View>
        </View>
      );
    }

    if (isAction && item.action) {
      const action = item.action;
      let actionLabel = '';
      let actionIcon: keyof typeof Ionicons.glyphMap = 'flash-outline';
      let actionColor = themeColors.secondary;
      let previewItems: { label: string; value: string; color?: string }[] = [];

      switch (action.actionType) {
        case 'transaction': {
          const tx = action as TransactionAction;
          actionLabel = tx.type === 'expense' ? 'Registrar Gasto' : 'Registrar Ingreso';
          actionIcon = tx.type === 'expense' ? 'trending-down-outline' : 'trending-up-outline';
          actionColor = tx.type === 'expense' ? themeColors.danger : themeColors.secondary;
          previewItems = [
            { label: 'Descripción', value: tx.description || '' },
            { label: 'Monto', value: `${tx.currency === 'USD' ? '$' : 'Bs.'}${tx.amount}`, color: tx.type === 'expense' ? themeColors.danger : themeColors.secondary },
            { label: 'Categoría', value: tx.category || '' },
          ];
          break;
        }
        case 'update_transaction': {
          const utx = action as UpdateTransactionAction;
          actionLabel = 'Actualizar Transacción';
          actionIcon = 'create-outline';
          previewItems = [{ label: 'ID Transacción', value: `#${utx.transactionId}` }];
          if (utx.description) previewItems.push({ label: 'Nueva descripción', value: utx.description });
          if (utx.amount !== undefined) previewItems.push({ label: 'Nuevo monto', value: `${utx.currency === 'USD' ? '$' : 'Bs.'}${utx.amount}` });
          break;
        }
        case 'delete_transaction': {
          const dtx = action as DeleteTransactionAction;
          actionLabel = 'Eliminar Transacción';
          actionIcon = 'trash-outline';
          actionColor = themeColors.danger;
          previewItems = [{ label: 'ID Transacción', value: `#${dtx.transactionId}` }];
          break;
        }
        case 'create_account': {
          const acc = action as CreateAccountAction;
          actionLabel = 'Crear Cuenta';
          actionIcon = 'add-circle-outline';
          previewItems = [
            { label: 'Nombre', value: acc.name || '' },
            { label: 'Tipo', value: acc.type === 'cash' ? 'Efectivo' : acc.type === 'bank' ? 'Banco' : acc.type === 'virtual_card' ? 'Tarjeta Virtual' : acc.type === 'exchange' ? 'Exchange' : 'Otro' },
          ];
          if (acc.initialBalanceUSD) previewItems.push({ label: 'Saldo USD', value: `$${acc.initialBalanceUSD}`, color: themeColors.secondary });
          if (acc.initialBalanceBS) previewItems.push({ label: 'Saldo BS', value: `Bs.${acc.initialBalanceBS}`, color: themeColors.tertiary });
          break;
        }
        case 'update_account': {
          const ua = action as UpdateAccountAction;
          actionLabel = 'Actualizar Cuenta';
          actionIcon = 'create-outline';
          previewItems = [{ label: 'Cuenta', value: `#${ua.accountId}` }];
          if (ua.name) previewItems.push({ label: 'Nuevo nombre', value: ua.name });
          break;
        }
        case 'delete_account': {
          const da = action as DeleteAccountAction;
          actionLabel = 'Eliminar Cuenta';
          actionIcon = 'trash-outline';
          actionColor = themeColors.danger;
          previewItems = [{ label: 'Cuenta', value: `#${da.accountId}` }];
          break;
        }
        case 'transfer': {
          const tr = action as TransferAction;
          actionLabel = 'Transferencia';
          actionIcon = 'swap-horizontal-outline';
          actionColor = themeColors.tertiary;
          previewItems = [
            { label: 'Desde', value: `#${tr.fromAccountId}` },
            { label: 'Hacia', value: `#${tr.toAccountId}` },
            { label: 'Monto', value: `${tr.currency === 'USD' ? '$' : 'Bs.'}${tr.amount}`, color: themeColors.tertiary },
          ];
          break;
        }
        case 'create_goal': {
          const g = action as CreateGoalAction;
          actionLabel = 'Crear Meta';
          actionIcon = 'flag-outline';
          previewItems = [
            { label: 'Nombre', value: g.name || '' },
            { label: 'Objetivo', value: `${g.currency === 'USD' ? '$' : 'Bs.'}${g.targetAmount}`, color: themeColors.secondary },
          ];
          break;
        }
        case 'update_goal_progress': {
          const gp = action as UpdateGoalProgressAction;
          actionLabel = 'Actualizar Progreso';
          actionIcon = 'trending-up-outline';
          previewItems = [
            { label: 'Meta', value: `#${gp.goalId}` },
            { label: 'Agregar', value: `${gp.amount}`, color: themeColors.secondary },
          ];
          break;
        }
        case 'delete_goal': {
          const dg = action as DeleteGoalAction;
          actionLabel = 'Eliminar Meta';
          actionIcon = 'trash-outline';
          actionColor = themeColors.danger;
          previewItems = [{ label: 'Meta', value: `#${dg.goalId}` }];
          break;
        }
        case 'create_subscription': {
          const sub = action as CreateSubscriptionAction;
          actionLabel = 'Crear Suscripción';
          actionIcon = 'calendar-outline';
          previewItems = [
            { label: 'Nombre', value: sub.name || '' },
            { label: 'Monto', value: `${sub.currency === 'USD' ? '$' : 'Bs.'}${sub.amount}`, color: themeColors.secondary },
            { label: 'Frecuencia', value: sub.frequency || '' },
          ];
          break;
        }
        case 'update_subscription': {
          const us = action as UpdateSubscriptionAction;
          actionLabel = 'Actualizar Suscripción';
          actionIcon = 'create-outline';
          previewItems = [{ label: 'Suscripción', value: `#${us.subscriptionId}` }];
          if (us.name) previewItems.push({ label: 'Nuevo nombre', value: us.name });
          break;
        }
        case 'delete_subscription': {
          const ds = action as DeleteSubscriptionAction;
          actionLabel = 'Eliminar Suscripción';
          actionIcon = 'trash-outline';
          actionColor = themeColors.danger;
          previewItems = [{ label: 'Suscripción', value: `#${ds.subscriptionId}` }];
          break;
        }
        case 'set_budget': {
          const b = action as SetBudgetAction;
          actionLabel = 'Establecer Presupuesto';
          actionIcon = 'wallet-outline';
          previewItems = [
            { label: 'Categoría', value: b.category || '' },
            { label: 'Monto USD', value: `$${b.amountUSD}`, color: themeColors.secondary },
          ];
          if (b.amountBS) previewItems.push({ label: 'Monto BS', value: `Bs.${b.amountBS}`, color: themeColors.tertiary });
          break;
        }
        case 'create_debt': {
          const d = action as CreateDebtAction;
          actionLabel = d.type === 'lent' ? 'Registrar Préstamo' : 'Registrar Deuda';
          actionIcon = d.type === 'lent' ? 'arrow-forward-outline' : 'arrow-back-outline';
          actionColor = d.type === 'lent' ? themeColors.secondary : themeColors.danger;
          previewItems = [
            { label: 'Persona', value: d.personName || '' },
            { label: 'Monto', value: `${d.currency === 'USD' ? '$' : 'Bs.'}${d.amount}`, color: actionColor },
          ];
          break;
        }
        case 'pay_debt': {
          const p = action as PayDebtAction;
          actionLabel = 'Pagar Deuda';
          actionIcon = 'cash-outline';
          previewItems = [
            { label: 'Deuda', value: `#${p.debtId}` },
            { label: 'Pago', value: `${p.currency === 'USD' ? '$' : 'Bs.'}${p.amount}`, color: themeColors.secondary },
          ];
          break;
        }
        case 'delete_debt': {
          const dd = action as DeleteDebtAction;
          actionLabel = 'Eliminar Deuda';
          actionIcon = 'trash-outline';
          actionColor = themeColors.danger;
          previewItems = [{ label: 'Deuda', value: `#${dd.debtId}` }];
          break;
        }
        default:
          actionLabel = 'Acción';
          actionIcon = 'flash-outline';
      }

      return (
        <View style={{
          flexDirection: 'row',
          width: '100%',
          justifyContent: 'flex-start',
          marginBottom: 16,
          paddingHorizontal: 24,
        }}>
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: themeColors.surfaceVariant,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 8,
            marginTop: 4,
          }}>
            <Ionicons name="sparkles" size={14} color={themeColors.secondary} />
          </View>
          <View style={{ flex: 1, maxWidth: '85%' }}>
            <View style={{
              backgroundColor: themeColors.surfaceVariant,
              borderRadius: 16,
              borderTopLeftRadius: 4,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
              shadowColor: '#0A1E3D',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.6,
              shadowRadius: 12,
              elevation: 4,
            }}>
              <Markdown style={mdStyles}>
                {item.content}
              </Markdown>
              {previewItems.length > 0 && (
                <View style={{
                  backgroundColor: themeColors.surfaceContainer,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: themeColors.outlineVariant + '30',
                }}>
                  {previewItems.map((pItem, idx) => (
                    <View key={idx} style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 4,
                    }}>
                      <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 13 }}>
                        {pItem.label}
                      </ThemedText>
                      <ThemedText type="body" style={{ fontSize: 13, fontWeight: '600', color: pItem.color || themeColors.text }}>
                        {pItem.value}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => confirmAction(item)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: themeColors.secondary,
                  }}
                >
                  <ThemedText type="caption" style={{ color: themeColors.secondary, fontSize: 11, letterSpacing: 0.5, fontWeight: '600' }}>
                    CONFIRMAR
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => cancelAction(item)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant,
                  }}
                >
                  <ThemedText type="caption" themeColor="onSurfaceVariant" style={{ fontSize: 11, letterSpacing: 0.5, fontWeight: '600' }}>
                    CANCELAR
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={{
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'flex-start',
        marginBottom: 16,
        paddingHorizontal: 24,
      }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: themeColors.surfaceVariant,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 8,
          marginTop: 4,
        }}>
          <Ionicons name="sparkles" size={14} color={themeColors.secondary} />
        </View>
        <View style={{
          backgroundColor: themeColors.surfaceVariant,
          borderRadius: 16,
          borderTopLeftRadius: 4,
          padding: 16,
          maxWidth: '85%',
          borderWidth: 1,
          borderColor: isSuccess ? themeColors.secondary + '30' : 'rgba(255,255,255,0.05)',
          shadowColor: '#0A1E3D',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 4,
        }}>
          <Markdown style={mdStyles}>
            {item.content}
          </Markdown>
        </View>
      </View>
    );
  }, [themeColors, confirmAction, cancelAction]);

  // ============================================================
  // JSX: UI Principal
  // ============================================================

  const hasMessages = messages.length > 0;
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
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: themeColors.surface + '80',
          borderBottomWidth: 1,
          borderBottomColor: themeColors.outlineVariant + '20',
        }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: themeColors.primaryContainer,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={22} color={themeColors.onPrimaryContainer} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: themeColors.surfaceVariant,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: themeColors.outlineVariant + '50',
            }}>
              <Ionicons name="sparkles" size={18} color={themeColors.secondary} />
            </View>
            <ThemedText type="h3" themeColor="secondary" style={{ fontWeight: '700' }}>
              Asistente Kinetic
            </ThemedText>
          </View>

          <TouchableOpacity
            onPress={openHistory}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: themeColors.surfaceVariant + '60',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="time-outline" size={22} color={themeColors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Contenido principal */}
        {!hasMessages ? (
          /* Welcome State */
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            paddingBottom: 80,
          }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: themeColors.surfaceVariant,
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="sparkles" size={32} color={themeColors.secondary} />
            </View>
            <ThemedText type="h2" themeColor="text" style={{ fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
              ¡Hola! Soy tu asistente financiero
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={{ textAlign: 'center', lineHeight: 22 }}>
              Puedo ayudarte a registrar gastos, crear cuentas, establecer metas y mucho más. ¡Pruébame!
            </ThemedText>
          </View>
        ) : (
          /* Lista de mensajes */
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 120,
            }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              isLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  {/* Thinking indicator: 3 animated dots */}
                  <View style={{
                    flexDirection: 'row',
                    gap: 6,
                    alignSelf: 'flex-start',
                    backgroundColor: themeColors.surfaceVariant,
                    borderRadius: 16,
                    borderTopLeftRadius: 4,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '20',
                  }}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: themeColors.onSurfaceVariant,
                          opacity: 0.6,
                        }}
                      />
                    ))}
                  </View>
                  {thinkingStep && (
                    <ThemedText
                      type="caption"
                      themeColor="textTertiary"
                      style={{ marginTop: 8, fontStyle: 'italic' }}
                    >
                      {thinkingStep}
                    </ThemedText>
                  )}
                </View>
              ) : null
            }
          />
        )}

        {/* Bottom Input Bar */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
          paddingBottom: Platform.OS === 'ios' ? 28 : 16,
          paddingTop: 8,
          backgroundColor: themeColors.surface + '99',
          borderTopWidth: 1,
          borderTopColor: themeColors.outlineVariant + '20',
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            backgroundColor: themeColors.surfaceContainerHigh,
            borderRadius: 16,
            padding: 8,
            borderWidth: 1,
            borderColor: themeColors.outlineVariant + '30',
          }}>
            {/* Mic button */}
            <TouchableOpacity
              onPress={startListening}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: isListening ? themeColors.danger + '20' : themeColors.surfaceVariant + '60',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name={isListening ? "mic" : "mic-outline"}
                size={20}
                color={isListening ? themeColors.danger : themeColors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              style={[inputStyle, { flex: 1, borderRadius: 12, maxHeight: 100 }]}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={themeColors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              editable={!isLoading}
            />

            {/* Send button */}
            <TouchableOpacity
              onPress={() => {
                if (inputText.trim() && !isLoading) {
                  sendMessage(inputText.trim());
                  setInputText('');
                }
              }}
              disabled={!inputText.trim() || isLoading}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: inputText.trim() && !isLoading ? themeColors.secondary : themeColors.surfaceVariant,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: inputText.trim() && !isLoading ? themeColors.secondary : 'transparent',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: inputText.trim() && !isLoading ? 6 : 0,
              }}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() && !isLoading ? themeColors.text : themeColors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* History Modal */}
        <Modal visible={showHistory} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 24,
              paddingVertical: 16,
              backgroundColor: themeColors.surface + '80',
              borderBottomWidth: 1,
              borderBottomColor: themeColors.outlineVariant + '20',
            }}>
              <ThemedText type="h3" themeColor="text" style={{ fontWeight: '700' }}>
                Historial
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleClearHistory}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: themeColors.danger + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={themeColors.danger} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowHistory(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: themeColors.surfaceVariant + '60',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color={themeColors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={chatSessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 20, gap: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => loadSession(item.id)}
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: themeColors.outlineVariant + '30',
                  }}
                >
                  <ThemedText type="bodyMedium" themeColor="text" numberOfLines={2} style={{ marginBottom: 4 }}>
                    {item.preview}
                  </ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText type="caption" themeColor="textTertiary">
                      {item.date}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textTertiary">
                      {item.count} mensajes
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                  <Ionicons name="chatbubble-ellipses-outline" size={48} color={themeColors.onSurfaceVariant} style={{ opacity: 0.4, marginBottom: 12 }} />
                  <ThemedText type="body" themeColor="textSecondary">
                    No hay conversaciones guardadas
                  </ThemedText>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>

        {/* Account Picker Modal */}
        <Modal visible={showAccountPicker} transparent animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: themeColors.overlay, justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => {
              setShowAccountPicker(false);
              setPendingAction(null);
              setPendingAccountCallback(null);
            }}
          >
            <GlassCard padding={24} style={{ width: '85%', maxWidth: 360 }}>
              <ThemedText type="h3" themeColor="text" style={{ fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
                Seleccionar cuenta
              </ThemedText>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => {
                    pendingAccountCallback?.(account.id);
                    setShowAccountPicker(false);
                    setPendingAction(null);
                    setPendingAccountCallback(null);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 4,
                    backgroundColor: themeColors.surfaceVariant + '30',
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: themeColors.surfaceVariant,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons name="wallet-outline" size={20} color={themeColors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="bodyMedium" themeColor="text" style={{ fontWeight: '600' }}>
                      {account.name}
                    </ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {account.type}
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={themeColors.onSurfaceVariant} />
                </TouchableOpacity>
              ))}
            </GlassCard>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </AnimatedScreen>
  );
}
