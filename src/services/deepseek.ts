import type { Account, Category } from '../utils/types';

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================
// TRANSACCIONES
// ============================================================

// Crear transacción (gasto/ingreso)
export interface TransactionAction {
  actionType: 'transaction';
  type: 'expense' | 'income';
  amount: number;
  currency: 'USD' | 'BS';
  description: string;
  category: string;
}

// Actualizar una transacción existente
export interface UpdateTransactionAction {
  actionType: 'update_transaction';
  transactionId: number;
  type?: 'expense' | 'income';
  amount?: number;
  currency?: 'USD' | 'BS';
  description?: string;
  category?: string;
}

// Eliminar una transacción
export interface DeleteTransactionAction {
  actionType: 'delete_transaction';
  transactionId: number;
}

// ============================================================
// CUENTAS
// ============================================================

// Crear cuenta
export interface CreateAccountAction {
  actionType: 'create_account';
  name: string;
  type: 'cash' | 'bank' | 'virtual_card' | 'exchange' | 'other';
  currency: 'USD' | 'BS' | 'BOTH';
  initialBalanceUSD: number;
  initialBalanceBS: number;
  icon?: string;
  color?: string;
}

// Actualizar cuenta
export interface UpdateAccountAction {
  actionType: 'update_account';
  accountId: number;
  name?: string;
  icon?: string;
  color?: string;
}

// Eliminar cuenta
export interface DeleteAccountAction {
  actionType: 'delete_account';
  accountId: number;
}

// ============================================================
// TRANSFERENCIAS
// ============================================================

export interface TransferAction {
  actionType: 'transfer';
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  currency: 'USD' | 'BS';
  description?: string;
}

// ============================================================
// METAS (GOALS)
// ============================================================

// Crear meta
export interface CreateGoalAction {
  actionType: 'create_goal';
  name: string;
  targetAmount: number;
  currency: 'USD' | 'BS';
  accountId?: number;
  deadline?: string;
}

// Actualizar progreso de meta
export interface UpdateGoalProgressAction {
  actionType: 'update_goal_progress';
  goalId: number;
  amount: number;
}

// Eliminar meta
export interface DeleteGoalAction {
  actionType: 'delete_goal';
  goalId: number;
}

// ============================================================
// SUSCRIPCIONES
// ============================================================

// Crear suscripción
export interface CreateSubscriptionAction {
  actionType: 'create_subscription';
  name: string;
  amount: number;
  currency: 'USD' | 'BS';
  frequency: 'weekly' | 'monthly' | 'yearly' | 'custom';
  category: string;
  accountId: number;
  billingDay: number;
  description?: string;
}

// Actualizar suscripción
export interface UpdateSubscriptionAction {
  actionType: 'update_subscription';
  subscriptionId: number;
  name?: string;
  amount?: number;
  currency?: 'USD' | 'BS';
  frequency?: 'weekly' | 'monthly' | 'yearly' | 'custom';
  isActive?: boolean;
}

// Eliminar suscripción
export interface DeleteSubscriptionAction {
  actionType: 'delete_subscription';
  subscriptionId: number;
}

// ============================================================
// PRESUPUESTOS (BUDGETS)
// ============================================================

// Asignar presupuesto a una categoría
export interface SetBudgetAction {
  actionType: 'set_budget';
  category: string;
  month: string; // formato YYYY-MM
  amountUSD: number;
  amountBS?: number;
}

// ============================================================
// DEUDAS (DEBTS)
// ============================================================

// Crear deuda
export interface CreateDebtAction {
  actionType: 'create_debt';
  type: 'lent' | 'borrowed';
  personName: string;
  amount: number;
  currency: 'USD' | 'BS';
  description?: string;
  dueDate?: string;
}

// Registrar pago de deuda
export interface PayDebtAction {
  actionType: 'pay_debt';
  debtId: number;
  amount: number;
  currency: 'USD' | 'BS';
}

// Eliminar deuda
export interface DeleteDebtAction {
  actionType: 'delete_debt';
  debtId: number;
}

// ============================================================
// TIPO UNIÓN
// ============================================================

export type DeepSeekAction =
  | TransactionAction
  | UpdateTransactionAction
  | DeleteTransactionAction
  | CreateAccountAction
  | UpdateAccountAction
  | DeleteAccountAction
  | TransferAction
  | CreateGoalAction
  | UpdateGoalProgressAction
  | DeleteGoalAction
  | CreateSubscriptionAction
  | UpdateSubscriptionAction
  | DeleteSubscriptionAction
  | SetBudgetAction
  | CreateDebtAction
  | PayDebtAction
  | DeleteDebtAction;

export interface DeepSeekResponse {
  type: 'action' | 'response';
  content: string;
  action?: DeepSeekAction;
}

/**
 * Construye el system prompt con el contexto financiero del usuario.
 */
function buildSystemPrompt(accounts: Account[], categories: Category[]): string {
  const accountsSummary = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balanceUSD: a.initialBalanceUSD,
    balanceBS: a.initialBalanceBS,
  }));

  const categoriesList = categories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
  }));

  return `Eres un asistente financiero personal experto en finanzas. Tu objetivo es ayudar al usuario a gestionar TODO sobre sus finanzas.

## REGLA #1 ABSOLUTA - SIEMPRE USA ACCION:
Cuando el usuario pida crear, modificar, eliminar o transferir ALGO (transacciones, cuentas, metas, suscripciones, presupuestos, deudas), DEBES responder SIEMPRE con una ACCION: en formato JSON. NUNCA respondas solo con texto cuando se trata de una operación. Si no usas ACCION:, la operación NO se ejecutará.

## REGLA #2 - SIEMPRE PIDE CONFIRMACIÓN:
Antes de cada ACCION:, SIEMPRE pregunta al usuario si confirma. Ejemplo: "Voy a registrar un gasto de $50 en Uber. ¿Confirmas?" seguido de ACCION:.

## REGLA #3 - SIEMPRE PREGUNTA SI FALTAN DATOS:
Si el usuario no proporciona todos los datos necesarios para una operación, PREGUNTA qué valores usar. NUNCA asumas valores por defecto.

DATOS DEL USUARIO:

CUENTAS:
${JSON.stringify(accountsSummary, null, 2)}

CATEGORIAS DISPONIBLES:
${JSON.stringify(categoriesList, null, 2)}

## ACCIONES DISPONIBLES (usa SOLO estos formatos):

### TRANSACCIONES
1. **CREAR TRANSACCIÓN (gasto/ingreso):**
   ACCION: {"actionType":"transaction","type":"expense|income","amount":NUMERO,"currency":"USD|BS","description":"TEXTO","category":"NOMBRE_CATEGORIA"}
   - La categoría DEBE ser EXACTAMENTE uno de los nombres listados en CATEGORIAS DISPONIBLES.

2. **ACTUALIZAR TRANSACCIÓN:**
   ACCION: {"actionType":"update_transaction","transactionId":ID,"amount":NUMERO,"description":"TEXTO","category":"NOMBRE_CATEGORIA"}

3. **ELIMINAR TRANSACCIÓN:**
   ACCION: {"actionType":"delete_transaction","transactionId":ID}

### CUENTAS
4. **CREAR CUENTA:**
   ACCION: {"actionType":"create_account","name":"NOMBRE","type":"cash|bank|virtual_card|exchange|other","currency":"USD|BS|BOTH","initialBalanceUSD":NUMERO,"initialBalanceBS":NUMERO}
   - Tipos válidos: cash (efectivo), bank (banco), virtual_card (tarjeta virtual), exchange (exchange/pago móvil), other (otro)

5. **ACTUALIZAR CUENTA:**
   ACCION: {"actionType":"update_account","accountId":ID,"name":"NUEVO_NOMBRE","type":"cash|bank|virtual_card|exchange|other","currency":"USD|BS|BOTH"}

6. **ELIMINAR CUENTA:**
   ACCION: {"actionType":"delete_account","accountId":ID}

### TRANSFERENCIAS
7. **TRANSFERENCIA entre cuentas:**
   ACCION: {"actionType":"transfer","fromAccountId":ID,"toAccountId":ID,"amount":NUMERO,"currency":"USD|BS","description":"TEXTO"}

### METAS
8. **CREAR META (ahorro/objetivo):**
   ACCION: {"actionType":"create_goal","name":"NOMBRE","targetAmount":NUMERO,"currency":"USD|BS","accountId":ID_o_null,"deadline":"YYYY-MM-DD_o_null"}

9. **ACTUALIZAR PROGRESO DE META:**
   ACCION: {"actionType":"update_goal_progress","goalId":ID,"amount":NUMERO}

10. **ELIMINAR META:**
    ACCION: {"actionType":"delete_goal","goalId":ID}

### SUSCRIPCIONES
11. **CREAR SUSCRIPCIÓN:**
    ACCION: {"actionType":"create_subscription","name":"NOMBRE","amount":NUMERO,"currency":"USD|BS","frequency":"weekly|monthly|yearly|custom","category":"NOMBRE_CATEGORIA","accountId":ID,"billingDay":NUMERO_DIA}

12. **ACTUALIZAR SUSCRIPCIÓN:**
    ACCION: {"actionType":"update_subscription","subscriptionId":ID,"name":"NUEVO_NOMBRE","amount":NUMERO,"isActive":true|false}

13. **ELIMINAR SUSCRIPCIÓN:**
    ACCION: {"actionType":"delete_subscription","subscriptionId":ID}

### PRESUPUESTOS
14. **ASIGNAR PRESUPUESTO:**
    ACCION: {"actionType":"set_budget","category":"NOMBRE_CATEGORIA","month":"YYYY-MM","amountUSD":NUMERO,"amountBS":NUMERO}

### DEUDAS
15. **CREAR DEUDA (préstamo):**
    ACCION: {"actionType":"create_debt","type":"lent|borrowed","personName":"NOMBRE","amount":NUMERO,"currency":"USD|BS","description":"TEXTO","dueDate":"YYYY-MM-DD"}

16. **REGISTRAR PAGO DE DEUDA:**
    ACCION: {"actionType":"pay_debt","debtId":ID,"amount":NUMERO,"currency":"USD|BS"}

17. **ELIMINAR DEUDA:**
    ACCION: {"actionType":"delete_debt","debtId":ID}

## FORMATO DE RESPUESTA:
Sigue SIEMPRE esta estructura:
1. Explica brevemente lo que vas a hacer (con emojis y markdown)
2. Pregunta SIEMPRE "¿Confirmas?" o "¿Quieres que lo ejecute?"
3. Agrega ACCION: con el JSON correspondiente

EJEMPLO CORRECTO:
"Voy a registrar un gasto de **$50 en Uber** 🚗. ¿Confirmas?
ACCION: {\"actionType\":\"transaction\",\"type\":\"expense\",\"amount\":50,\"currency\":\"USD\",\"description\":\"Uber\",\"category\":\"Transporte\"}"

## EXCEPCIÓN - Consultas informativas:
SOLO para consultas informativas (preguntar saldos, gastos, reportes, etc.), responde NATURALMENTE sin ACCION:. Usa emojis y markdown para hacer las respuestas más amigables.

## IMPORTANTE:
- NUNCA ejecutes una operación sin preguntar primero
- NUNCA respondas solo con texto cuando el usuario pide hacer una operación
- Siempre usa ACCION: para crear, modificar o eliminar cualquier cosa
- Si no estás seguro de algún dato, PREGUNTA al usuario`;
}

/**
 * Parsea la respuesta de DeepSeek para extraer una acción si existe.
 */
function parseAction(content: string): { cleanContent: string; action?: DeepSeekAction } {
  const actionRegex = /ACCION:\s*(\{.*?\})/s;
  const match = content.match(actionRegex);

  if (match) {
    try {
      const action = JSON.parse(match[1]) as DeepSeekAction;
      const cleanContent = content.replace(match[0], '').trim();
      return { cleanContent, action };
    } catch {
      return { cleanContent: content };
    }
  }

  return { cleanContent: content };
}

/**
 * Envía un mensaje a DeepSeek API y devuelve la respuesta procesada.
 */
export async function chatWithDeepSeek(
  messages: DeepSeekMessage[],
  accounts: Account[],
  categories: Category[],
  apiKey: string
): Promise<DeepSeekResponse> {
  if (!apiKey) {
    return {
      type: 'response',
      content: '⚠️ No has configurado tu API Key de DeepSeek. Ve a Ajustes > DeepSeek API Key para configurarla.',
    };
  }

  const systemPrompt = buildSystemPrompt(accounts, categories);

  const apiMessages: { role: string; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401) {
        return {
          type: 'response',
          content: '⚠️ Tu API Key de DeepSeek no es válida. Ve a Ajustes para actualizarla.',
        };
      }
      return {
        type: 'response',
        content: `⚠️ Error al conectar con DeepSeek: ${response.status}. Verifica tu API Key en Ajustes.`,
      };
    }

    const data = await response.json();
    const assistantContent: string = data.choices?.[0]?.message?.content || '';

    const { cleanContent, action } = parseAction(assistantContent);

    if (action) {
      return {
        type: 'action',
        content: cleanContent || '¿Quieres que ejecute esta operación?',
        action,
      };
    }

    return {
      type: 'response',
      content: cleanContent || assistantContent,
    };
  } catch (error: any) {
    console.error('DeepSeek API error:', error);
    return {
      type: 'response',
      content: `⚠️ Error de conexión: ${error?.message || 'No se pudo conectar con DeepSeek'}. Verifica tu conexión a internet.`,
    };
  }
}

/**
 * Prueba la conexión con DeepSeek usando un mensaje simple.
 */
export async function testDeepSeekConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
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
          { role: 'system', content: 'Responde solo "OK" si recibes este mensaje.' },
          { role: 'user', content: 'Dime OK' },
        ],
        temperature: 0.1,
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401) {
        return { success: false, message: 'API Key inválida' };
      }
      return { success: false, message: `Error HTTP ${response.status}` };
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content || '';
    return { success: true, message: content.trim() };
  } catch (error: any) {
    return { success: false, message: error?.message || 'Error de conexión' };
  }
}
