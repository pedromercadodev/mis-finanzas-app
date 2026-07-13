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
import {
  saveChatMessage,
  getChatHistory,
  getChatSessions,
  clearChatHistory,
  type ChatHistoryMessage,
} from '../src/services/chatHistory';
import AnimatedScreen from '../src/components/AnimatedScreen';
import ThemedText from '../src/components/ThemedText';
import { shadows } from '../src/theme/shadows';
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
        // === ASIGNAR PRESUPUESTO ===
        const bg = action as SetBudgetAction;
        const bgCatId = categoryMapRef.current[bg.category];
        if (!bgCatId) {
          const catsList = categories.map(c => c.name).join(', ');
          await addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ La categoría "${bg.category}" no es válida. Categorías disponibles: ${catsList}.`,
            isSuccess: false,
          });
          setMessages((prev) =>
            prev.map((m) => m.id === msg.id ? { ...m, isCancelled: true, isAction: false } : m)
          );
          setIsLoading(false);
          return;
        }

        await setAllocation(bgCatId, bg.month, bg.amountUSD, bg.amountBS || 0);

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se asignó presupuesto de **$${bg.amountUSD} USD**${bg.amountBS ? ` y **Bs.${bg.amountBS}**` : ''} a **${bg.category}** para **${bg.month}**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'create_debt') {
        // === CREAR DEUDA ===
        const debt = action as CreateDebtAction;
        // type y personName son requeridos en este punto (validados en deepseek.ts)
        await createDebt({
          type: debt.type!,
          personName: sanitizeInput(debt.personName!, 100),
          description: sanitizeInput(debt.description, 200) || null,
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

        const debtTypeLabel = debt.type === 'lent' ? 'préstamo' : 'deuda';
        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se registró ${debtTypeLabel} de **${debt.currency === 'USD' ? '$' : 'Bs.'}${debt.amount}** con **${debt.personName}**.`,
          isSuccess: true,
        });

      } else if (action.actionType === 'pay_debt') {
        // === PAGAR DEUDA ===
        const pd = action as PayDebtAction;
        await recordPayment(
          pd.debtId,
          pd.currency === 'USD' ? pd.amount : 0,
          pd.currency === 'BS' ? pd.amount : 0,
          getLocalDateString()
        );

        await addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **¡Listo!** Se registró el pago de **${pd.currency === 'USD' ? '$' : 'Bs.'}${pd.amount}** a la deuda.`,
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
      // T14: Manejo de errores granular en confirmAction
      const errorMsg = getErrorMessage(error, 'No se pudo completar la operación.');
      console.error('[AI-CHAT CONFIRM ERROR]', error?.message || error);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Error al ejecutar:** ${errorMsg}`,
        isSuccess: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accounts, loadAccounts, loadTransactions, addMessage, findAccount, sanitizeInput, getErrorMessage]);

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
        // Al cargar una sesión, reiniciamos el resumen para que se recalcule
        resumenAntiguoRef.current = '';
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
            resumenAntiguoRef.current = '';
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
            <ThemedText
              style={{
                fontSize: 15,
                color: '#FFF',
                lineHeight: 20,
              }}
            >
              {item.content}
            </ThemedText>
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
                borderLeftColor: item.action.type === 'expense' ? themeColors.danger : themeColors.success,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                {item.action.type === 'expense' ? '💸 GASTO' : '💰 INGRESO'}
              </ThemedText>
              <ThemedText type="h3" themeColor="text">
                {item.action.currency === 'USD' ? '$' : 'Bs.'}
                {item.action.amount}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 2 }}>
                {item.action.description}
              </ThemedText>
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
                <ThemedText type="badge" themeColor="primary">
                  {item.action.category}
                </ThemedText>
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
                borderLeftColor: themeColors.primary,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                🏦 NUEVA CUENTA
              </ThemedText>
              <ThemedText type="h3" themeColor="text">
                {item.action.name}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 2 }}>
                Tipo: {item.action.type === 'cash' ? 'Efectivo' : item.action.type === 'bank' ? 'Banco' : item.action.type === 'virtual_card' ? 'Tarjeta Virtual' : item.action.type === 'exchange' ? 'Exchange/Pago Móvil' : 'Otro'}
              </ThemedText>
              <ThemedText type="body" themeColor="textSecondary">
                Moneda: {item.action.currency === 'BOTH' ? 'USD y BS' : item.action.currency}
              </ThemedText>
              {(item.action.initialBalanceUSD > 0 || item.action.initialBalanceBS > 0) && (
                <ThemedText type="body" themeColor="textSecondary">
                  Saldo inicial: {item.action.initialBalanceUSD > 0 ? `$${item.action.initialBalanceUSD} USD` : ''}{item.action.initialBalanceUSD > 0 && item.action.initialBalanceBS > 0 ? ' + ' : ''}{item.action.initialBalanceBS > 0 ? `Bs.${item.action.initialBalanceBS}` : ''}
                </ThemedText>
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
                borderLeftColor: themeColors.warning,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                ✏️ ACTUALIZAR CUENTA
              </ThemedText>
              {item.action.name && (
                <ThemedText type="body" themeColor="text">
                  Nuevo nombre: <ThemedText style={{ fontWeight: '700' }}>{item.action.name}</ThemedText>
                </ThemedText>
              )}
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: 4 }}>
                Account ID: {item.action.accountId}
              </ThemedText>
            </View>
          )}

          {/* Preview de actualizar transacción */}
          {item.action && item.action.actionType === 'update_transaction' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.warning,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                ✏️ ACTUALIZAR TRANSACCIÓN
              </ThemedText>
              <ThemedText type="body" themeColor="text">
                ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).transactionId}</ThemedText>
              </ThemedText>
              {(item.action as any).description && (
                <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 2 }}>
                  Nueva descripción: {(item.action as any).description}
                </ThemedText>
              )}
              {(item.action as any).amount !== undefined && (
                <ThemedText type="body" themeColor="textSecondary" style={{ marginTop: 2 }}>
                  Nuevo monto: {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview de eliminar transacción */}
          {item.action && item.action.actionType === 'delete_transaction' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                🗑️ ELIMINAR TRANSACCIÓN
              </ThemedText>
              <ThemedText type="body" themeColor="text">
                ID de transacción: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).transactionId}</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Preview de eliminar cuenta */}
          {item.action && item.action.actionType === 'delete_account' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginBottom: 4 }}>
                🗑️ ELIMINAR CUENTA
              </ThemedText>
              <ThemedText type="body" themeColor="text">
                Cuenta: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).accountId}</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Preview de transferencia */}
          {item.action && item.action.actionType === 'transfer' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: '#8B5CF6',
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                TRANSFERENCIA
              </ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                De: <ThemedText style={{ fontWeight: '600' }}>{(item.action as any).fromAccountId}</ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary }}>
                A: <ThemedText style={{ fontWeight: '600' }}>{(item.action as any).toAccountId}</ThemedText>
              </ThemedText>
              {(item.action as any).description && (
                <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                  {(item.action as any).description}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview de crear meta */}
          {item.action && item.action.actionType === 'create_goal' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.success,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                NUEVA META
              </ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {(item.action as any).name}
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                Objetivo: {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).targetAmount}
              </ThemedText>
              {(item.action as any).deadline && (
                <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                  Fecha límite: {(item.action as any).deadline}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview de actualizar progreso de meta */}
          {item.action && item.action.actionType === 'update_goal_progress' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.success,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                PROGRESO DE META
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                Meta ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).goalId}</ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                Agregar: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).amount}</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Preview de eliminar meta */}
          {item.action && item.action.actionType === 'delete_goal' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ELIMINAR META
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                Meta ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).goalId}</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Preview de crear suscripción */}
          {item.action && item.action.actionType === 'create_subscription' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.warning,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                NUEVA SUSCRIPCIÓN
              </ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {(item.action as any).name}
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                Frecuencia: {(item.action as any).frequency} · Categoría: {(item.action as any).category}
              </ThemedText>
            </View>
          )}

          {/* Preview de actualizar suscripción */}
          {item.action && item.action.actionType === 'update_subscription' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.warning,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ACTUALIZAR SUSCRIPCIÓN
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).subscriptionId}</ThemedText>
              </ThemedText>
              {(item.action as any).name && (
                <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                  Nuevo nombre: {(item.action as any).name}
                </ThemedText>
              )}
              {(item.action as any).amount !== undefined && (
                <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                  Nuevo monto: {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview de eliminar suscripción */}
          {item.action && item.action.actionType === 'delete_subscription' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ELIMINAR SUSCRIPCIÓN
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                Suscripción ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).subscriptionId}</ThemedText>
              </ThemedText>
            </View>
          )}

          {/* Preview de asignar presupuesto */}
          {item.action && item.action.actionType === 'set_budget' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: '#3B82F6',
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ASIGNAR PRESUPUESTO
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text }}>
                Categoría: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).category}</ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                ${(item.action as any).amountUSD} USD
              </ThemedText>
              {(item.action as any).amountBS > 0 && (
                <ThemedText style={{ fontSize: 14, color: themeColors.text }}>
                  Bs.{(item.action as any).amountBS}
                </ThemedText>
              )}
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                Mes: {(item.action as any).month}
              </ThemedText>
            </View>
          )}

          {/* Preview de crear deuda */}
          {item.action && item.action.actionType === 'create_debt' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                {(item.action as any).type === 'lent' ? 'PRÉSTAMO (TÚ PRESTASTE)' : 'DEUDA (TÚ DEBES)'}
              </ThemedText>
              <ThemedText style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                Con: <ThemedText style={{ fontWeight: '600' }}>{(item.action as any).personName}</ThemedText>
              </ThemedText>
              {(item.action as any).description && (
                <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                  {(item.action as any).description}
                </ThemedText>
              )}
              {(item.action as any).dueDate && (
                <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                  Vence: {(item.action as any).dueDate}
                </ThemedText>
              )}
            </View>
          )}

          {/* Preview de pagar deuda */}
          {item.action && item.action.actionType === 'pay_debt' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.success,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                PAGAR DEUDA
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                Deuda ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).debtId}</ThemedText>
              </ThemedText>
              <ThemedText style={{ fontSize: 14, color: themeColors.text, marginTop: 2 }}>
                Monto: {(item.action as any).currency === 'USD' ? '$' : 'Bs.'}{(item.action as any).amount}
              </ThemedText>
            </View>
          )}

          {/* Preview de eliminar deuda */}
          {item.action && item.action.actionType === 'delete_debt' && (
            <View
              style={{
                marginTop: 12,
                backgroundColor: themeColors.background,
                borderRadius: 10,
                padding: 12,
                borderLeftWidth: 3,
                borderLeftColor: themeColors.danger,
              }}
            >
              <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 4 }}>
                ELIMINAR DEUDA
              </ThemedText>
              <ThemedText style={{ fontSize: 13, color: themeColors.text }}>
                Deuda ID: <ThemedText style={{ fontWeight: '700' }}>{(item.action as any).debtId}</ThemedText>
              </ThemedText>
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
              accessibilityLabel="Confirmar acción"
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
              <ThemedText style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>
                Confirmar
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => cancelAction(item)}
              disabled={isLoading}
              accessibilityLabel="Cancelar acción"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: themeColors.danger,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 8,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <ThemedText style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>
                Cancelar
              </ThemedText>
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
            <ThemedText style={{ fontSize: 12, color: themeColors.success }}>
              Operación completada
            </ThemedText>
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
            <Ionicons name="close-circle" size={14} color={themeColors.danger} />
            <ThemedText style={{ fontSize: 12, color: themeColors.danger }}>
              Cancelado
            </ThemedText>
          </View>
        )}
      </View>
    );
  }, [themeColors, confirmAction, cancelAction, isLoading]);

  return (
    <AnimatedScreen>
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
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Cerrar asistente">
            <Ionicons name="close" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="sparkles" size={20} color={themeColors.primary} />
            <ThemedText style={{ fontSize: 17, fontWeight: '600', color: themeColors.text }}>
              Asistente IA
            </ThemedText>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={openHistory} accessibilityLabel="Ver historial">
              <Ionicons name="time-outline" size={22} color={themeColors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} accessibilityLabel="Ir a ajustes">
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

        {/* Indicador de carga con UI de razonamiento (T15) */}
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
            <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary }}>
              {thinkingStep || 'Pensando...'}
            </ThemedText>
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
            <ThemedText style={{ fontSize: 13, color: themeColors.primary, fontWeight: '600' }}>
              Escuchando...
            </ThemedText>
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
            accessibilityLabel={isListening ? 'Detener grabación' : 'Iniciar grabación de voz'}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isListening ? themeColors.danger : themeColors.surface,
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
            accessibilityLabel="Enviar mensaje"
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
              <ThemedText style={{ fontSize: 17, fontWeight: '600', color: themeColors.text }}>
                Historial
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={handleClearHistory} accessibilityLabel="Limpiar historial">
                  <Ionicons name="trash-outline" size={20} color={themeColors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowHistory(false)} accessibilityLabel="Cerrar historial">
                  <Ionicons name="close" size={22} color={themeColors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista de sesiones */}
            {chatSessions.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="chatbubbles-outline" size={40} color={themeColors.textSecondary} />
                <ThemedText style={{ fontSize: 15, color: themeColors.textSecondary, marginTop: 12, textAlign: 'center' }}>
                  No hay conversaciones guardadas aún.
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {chatSessions.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => loadSession(session.id)}
                    accessibilityLabel={`Cargar conversación: ${session.preview}`}
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
                      <ThemedText
                        style={{
                          fontSize: 14,
                          fontWeight: '500',
                          color: themeColors.text,
                        }}
                        numberOfLines={1}
                      >
                        {session.preview}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                        {session.date} · {session.count} mensajes
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal para seleccionar cuenta cuando hay múltiples cuentas */}
      <Modal visible={showAccountPicker} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: themeColors.surface,
              borderRadius: 20,
              width: '100%',
              maxWidth: 380,
              padding: 24,
              ...shadows.lg,
            }}
          >
            <ThemedText
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: themeColors.text,
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              Seleccionar cuenta
            </ThemedText>
            <ThemedText
              style={{
                fontSize: 14,
                color: themeColors.textSecondary,
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              ¿En qué cuenta deseas registrar esta transacción?
            </ThemedText>

            <ScrollView style={{ maxHeight: 300 }}>
              {accounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  onPress={() => {
                    pendingAccountCallback?.(account.id);
                    setShowAccountPicker(false);
                    setPendingAction(null);
                    setPendingAccountCallback(null);
                  }}
                  accessibilityLabel={`Seleccionar cuenta: ${account.name}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 8,
                    backgroundColor: themeColors.background,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: account.type === 'cash' ? '#D1FAE5' : account.type === 'bank' ? '#DBEAFE' : '#FEF3C7',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={account.type === 'cash' ? 'cash-outline' : account.type === 'bank' ? 'business-outline' : 'card-outline'}
                      size={20}
                      color={themeColors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: themeColors.text,
                      }}
                    >
                      {account.name}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>
                      {account.type === 'cash' ? 'Efectivo' : account.type === 'bank' ? 'Banco' : 'Crédito'}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {account.initialBalanceUSD != null && (
                      <ThemedText style={{ fontSize: 14, fontWeight: '600', color: themeColors.text }}>
                        ${account.initialBalanceUSD.toFixed(2)}
                      </ThemedText>
                    )}
                    {account.initialBalanceBS != null && (
                      <ThemedText style={{ fontSize: 12, color: themeColors.textSecondary }}>
                        Bs. {account.initialBalanceBS.toFixed(2)}
                      </ThemedText>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => {
                if (pendingAction) {
                  cancelAction(pendingAction);
                }
                setShowAccountPicker(false);
                setPendingAction(null);
                setPendingAccountCallback(null);
              }}
              accessibilityLabel="Cancelar selección de cuenta"
              style={{
                marginTop: 12,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: themeColors.background,
                alignItems: 'center',
              }}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: '500', color: themeColors.danger }}>
                Cancelar
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </AnimatedScreen>
  );
}
