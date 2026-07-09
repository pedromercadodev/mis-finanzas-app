import type { Account, Category } from '../utils/types';
import { ACTION_SCHEMA_MAP, type ValidatedAction } from './aiSchemas';
import { z } from 'zod';
import { getReportSummary, getCategoryBreakdown } from './reports';
import { getSubscriptions } from './subscriptions';
import { getDatabase } from './database';

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================
// Interfaces de acciones (para compatibilidad con ai-chat.tsx)
// ============================================================

export interface TransactionAction {
  actionType: 'transaction';
  type: 'expense' | 'income';
  amount: number;
  currency: 'USD' | 'BS';
  description: string;
  category: string;
}

export interface UpdateTransactionAction {
  actionType: 'update_transaction';
  transactionId: number;
  type?: 'expense' | 'income';
  amount?: number;
  currency?: 'USD' | 'BS';
  description?: string;
  category?: string;
}

export interface DeleteTransactionAction {
  actionType: 'delete_transaction';
  transactionId: number;
}

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

export interface UpdateAccountAction {
  actionType: 'update_account';
  accountId: number;
  name?: string;
  icon?: string;
  color?: string;
}

export interface DeleteAccountAction {
  actionType: 'delete_account';
  accountId: number;
}

export interface TransferAction {
  actionType: 'transfer';
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  currency: 'USD' | 'BS';
  description?: string;
}

export interface CreateGoalAction {
  actionType: 'create_goal';
  name: string;
  targetAmount: number;
  currency: 'USD' | 'BS';
  accountId?: number;
  deadline?: string;
}

export interface UpdateGoalProgressAction {
  actionType: 'update_goal_progress';
  goalId: number;
  amount: number;
}

export interface DeleteGoalAction {
  actionType: 'delete_goal';
  goalId: number;
}

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

export interface UpdateSubscriptionAction {
  actionType: 'update_subscription';
  subscriptionId: number;
  name?: string;
  amount?: number;
  currency?: 'USD' | 'BS';
  frequency?: 'weekly' | 'monthly' | 'yearly' | 'custom';
  isActive?: boolean;
}

export interface DeleteSubscriptionAction {
  actionType: 'delete_subscription';
  subscriptionId: number;
}

export interface SetBudgetAction {
  actionType: 'set_budget';
  category: string;
  month: string;
  amountUSD: number;
  amountBS?: number;
}

export interface CreateDebtAction {
  actionType: 'create_debt';
  type?: 'lent' | 'borrowed';
  personName?: string;
  amount: number;
  currency: 'USD' | 'BS';
  description?: string;
  dueDate?: string;
}

export interface PayDebtAction {
  actionType: 'pay_debt';
  debtId: number;
  amount: number;
  currency: 'USD' | 'BS';
}

export interface DeleteDebtAction {
  actionType: 'delete_debt';
  debtId: number;
}

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

// ============================================================
// Tool Definitions para Function Calling (Tools API)
// ============================================================
// DeepSeek es compatible con el formato de OpenAI para tools.
// Cada tool define una función que el modelo puede invocar.
// ============================================================

const TOOLS: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    strict: boolean;
    parameters: Record<string, unknown>;
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'registrar_transaccion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario indica explícitamente que gastó dinero, pagó algo, recibió un ingreso, o registró un movimiento financiero (ej: "Gaste 50 en comida", "Recibí 200 de sueldo"). NO uses esta herramienta si el usuario solo está preguntando por su saldo o haciendo una consulta. Debes extraer obligatoriamente el monto, la categoría y la cuenta.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['expense', 'income'], description: 'Tipo de transacción: expense (gasto) o income (ingreso)' },
          amount: { type: 'number', description: 'Monto de la transacción. Siempre positivo. Ej: 50 para "gaste 50"' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda: USD (dólares) o BS (bolívares). Inferir del contexto si el usuario no lo dice.' },
          description: { type: 'string', description: 'Descripción breve de la transacción (ej: "Cena con amigos", "Compra del supermercado")' },
          category: { type: 'string', description: 'Nombre EXACTO de la categoría según la lista del sistema. Inferir automáticamente si el usuario no la especifica (ej: "café" → "Comida", "uber" → "Transporte")' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar (ej: "regístralo directo", "sin preguntar", "hazlo"). Por defecto es false.' },
        },
        required: ['type', 'amount', 'currency', 'description', 'category'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_transaccion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere modificar una transacción existente (ej: "cambia el monto del gasto de comida a 30", "corrige la categoría del uber"). Requiere el ID de la transacción.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'number', description: 'ID numérico de la transacción a actualizar' },
          type: { type: 'string', enum: ['expense', 'income'], description: 'Nuevo tipo (opcional)' },
          amount: { type: 'number', description: 'Nuevo monto (opcional)' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Nueva moneda (opcional)' },
          description: { type: 'string', description: 'Nueva descripción (opcional)' },
          category: { type: 'string', description: 'Nueva categoría (opcional)' },
        },
        required: ['transactionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_transaccion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere eliminar una transacción existente (ej: "borra el gasto de ayer", "elimina la transacción de comida"). Requiere el ID de la transacción.',
      parameters: {
        type: 'object',
        properties: {
          transactionId: { type: 'number', description: 'ID numérico de la transacción a eliminar' },
        },
        required: ['transactionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_cuenta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere crear una nueva cuenta financiera (ej: "crea una cuenta de banco", "añade cuenta de efectivo", "registra una cuenta de ahorro"). NO uses esta herramienta para crear transacciones o gastos.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la cuenta (ej: "Banco Provincial", "Efectivo", "Mercantil")' },
          type: { type: 'string', enum: ['cash', 'bank', 'virtual_card', 'exchange', 'other'], description: 'Tipo de cuenta: cash (efectivo), bank (banco), virtual_card (tarjeta virtual), exchange (exchange/casa de cambio), other (otro)' },
          currency: { type: 'string', enum: ['USD', 'BS', 'BOTH'], description: 'Moneda de la cuenta: USD, BS, o BOTH (ambas)' },
          initialBalanceUSD: { type: 'number', description: 'Saldo inicial en USD (0 si no aplica)' },
          initialBalanceBS: { type: 'number', description: 'Saldo inicial en BS (0 si no aplica)' },
          icon: { type: 'string', description: 'Icono opcional (nombre del icono)' },
          color: { type: 'string', description: 'Color opcional (hex, ej: #FF5733)' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['name', 'type', 'currency', 'initialBalanceUSD', 'initialBalanceBS'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_cuenta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere modificar el nombre, icono o color de una cuenta existente (ej: "cambia el nombre de la cuenta", "actualiza el icono"). Requiere el ID de la cuenta.',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'number', description: 'ID numérico de la cuenta a actualizar' },
          name: { type: 'string', description: 'Nuevo nombre (opcional)' },
          icon: { type: 'string', description: 'Nuevo icono (opcional)' },
          color: { type: 'string', description: 'Nuevo color en hex (opcional, ej: #FF5733)' },
        },
        required: ['accountId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_cuenta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere eliminar una cuenta existente (ej: "borra la cuenta de banco", "elimina la cuenta de efectivo"). Requiere el ID de la cuenta.',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'number', description: 'ID numérico de la cuenta a eliminar' },
        },
        required: ['accountId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transferir',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere transferir dinero entre dos cuentas (ej: "transfiere 50 de efectivo a banco", "pasa 100 de una cuenta a otra"). Requiere cuenta origen, destino, monto y moneda.',
      parameters: {
        type: 'object',
        properties: {
          fromAccountId: { type: 'number', description: 'ID numérico de la cuenta de origen (de dónde sale el dinero)' },
          toAccountId: { type: 'number', description: 'ID numérico de la cuenta de destino (a dónde llega el dinero)' },
          amount: { type: 'number', description: 'Monto a transferir. Siempre positivo.' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda de la transferencia' },
          description: { type: 'string', description: 'Descripción opcional de la transferencia' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['fromAccountId', 'toAccountId', 'amount', 'currency'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_meta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere crear una meta de ahorro u objetivo financiero (ej: "crea una meta para un viaje", "quiero ahorrar 500 para un celular"). Requiere nombre, monto objetivo y moneda.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la meta (ej: "Viaje a la playa", "Celular nuevo")' },
          targetAmount: { type: 'number', description: 'Monto objetivo a ahorrar' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda de la meta' },
          accountId: { type: 'number', description: 'ID de la cuenta asociada (opcional)' },
          deadline: { type: 'string', description: 'Fecha límite en formato YYYY-MM-DD (opcional)' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['name', 'targetAmount', 'currency'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_progreso_meta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere abonar dinero al progreso de una meta existente (ej: "abona 20 a la meta del viaje", "añade 10 al ahorro del celular"). Requiere ID de la meta y monto.',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'number', description: 'ID numérico de la meta a actualizar' },
          amount: { type: 'number', description: 'Monto a añadir al progreso actual de la meta' },
        },
        required: ['goalId', 'amount'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_meta',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere eliminar una meta existente (ej: "borra la meta del viaje", "elimina el objetivo de ahorro"). Requiere el ID de la meta.',
      parameters: {
        type: 'object',
        properties: {
          goalId: { type: 'number', description: 'ID numérico de la meta a eliminar' },
        },
        required: ['goalId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_suscripcion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere registrar una suscripción o pago recurrente (ej: "registra Netflix 10$ mensual", "crea suscripción de Spotify"). Requiere nombre, monto, moneda, frecuencia, categoría, cuenta y día de facturación.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la suscripción (ej: "Netflix", "Spotify", "Gym")' },
          amount: { type: 'number', description: 'Monto del pago recurrente' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda del pago' },
          frequency: { type: 'string', enum: ['weekly', 'monthly', 'yearly', 'custom'], description: 'Frecuencia: weekly (semanal), monthly (mensual), yearly (anual), custom (personalizado)' },
          category: { type: 'string', description: 'Nombre de la categoría (ej: "Entretenimiento", "Salud")' },
          accountId: { type: 'number', description: 'ID numérico de la cuenta desde donde se paga' },
          billingDay: { type: 'number', description: 'Día de facturación del mes (1-31)' },
          description: { type: 'string', description: 'Descripción opcional' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['name', 'amount', 'currency', 'frequency', 'category', 'accountId', 'billingDay'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'actualizar_suscripcion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere modificar una suscripción existente (ej: "cambia el monto de Netflix", "desactiva la suscripción de Spotify"). Requiere el ID de la suscripción.',
      parameters: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'number', description: 'ID numérico de la suscripción a actualizar' },
          name: { type: 'string', description: 'Nuevo nombre (opcional)' },
          amount: { type: 'number', description: 'Nuevo monto (opcional)' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Nueva moneda (opcional)' },
          frequency: { type: 'string', enum: ['weekly', 'monthly', 'yearly', 'custom'], description: 'Nueva frecuencia (opcional)' },
          isActive: { type: 'boolean', description: 'true = activar, false = desactivar (opcional)' },
        },
        required: ['subscriptionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_suscripcion',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere eliminar una suscripción existente (ej: "borra la suscripción de Netflix", "elimina Spotify"). Requiere el ID de la suscripción.',
      parameters: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'number', description: 'ID numérico de la suscripción a eliminar' },
        },
        required: ['subscriptionId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'asignar_presupuesto',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere asignar un presupuesto a una categoría para un mes específico (ej: "asigna 200 de presupuesto a Comida para julio", "pon 100 de límite en Transporte"). Requiere categoría, mes y monto.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Nombre EXACTO de la categoría según la lista del sistema' },
          month: { type: 'string', description: 'Mes en formato YYYY-MM (ej: "2026-07" para julio 2026)' },
          amountUSD: { type: 'number', description: 'Monto del presupuesto en USD' },
          amountBS: { type: 'number', description: 'Monto del presupuesto en BS (opcional, 0 si no aplica)' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['category', 'month', 'amountUSD'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_deuda',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere registrar una deuda (ej: "crea una deuda de 20$", "registra que le presté 50 a Juan"). type y personName son OPCIONALES: si el usuario no especificó si prestó o pidió prestado, o no dijo el nombre, omite esos campos. NUNCA inventes valores para type o personName.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['lent', 'borrowed'], description: 'lent = yo presté (me deben), borrowed = pedí prestado (yo debo). OPCIONAL - omite si el usuario no lo especificó.' },
          personName: { type: 'string', description: 'Nombre de la persona involucrada. OPCIONAL - omite si el usuario no lo especificó.' },
          amount: { type: 'number', description: 'Monto de la deuda. Siempre positivo.' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda de la deuda' },
          description: { type: 'string', description: 'Descripción opcional (ej: "Préstamo para el celular")' },
          dueDate: { type: 'string', description: 'Fecha de vencimiento en formato YYYY-MM-DD (opcional)' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['amount', 'currency'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pagar_deuda',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere registrar un pago parcial o total de una deuda existente (ej: "abona 10 a la deuda de Juan", "paga 20 de la deuda"). Requiere ID de la deuda, monto y moneda.',
      parameters: {
        type: 'object',
        properties: {
          debtId: { type: 'number', description: 'ID numérico de la deuda a pagar' },
          amount: { type: 'number', description: 'Monto a pagar. Siempre positivo.' },
          currency: { type: 'string', enum: ['USD', 'BS'], description: 'Moneda del pago' },
          skip_confirmation: { type: 'boolean', description: 'Debe ser true SOLO si el usuario indicó explícitamente que no desea confirmar. Por defecto es false.' },
        },
        required: ['debtId', 'amount', 'currency'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'eliminar_deuda',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere eliminar una deuda existente (ej: "borra la deuda de Juan", "elimina la deuda de 20$"). Requiere el ID de la deuda.',
      parameters: {
        type: 'object',
        properties: {
          debtId: { type: 'number', description: 'ID numérico de la deuda a eliminar' },
        },
        required: ['debtId'],
        additionalProperties: false,
      },
    },
  },
  // ---- Tools de CONSULTA (se ejecutan en backend, devuelven datos al modelo) ----
  {
    type: 'function',
    function: {
      name: 'consultar_saldo',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario pregunta por su saldo, cuánto dinero tiene, o el balance de una cuenta específica (ej: "cuánto tengo?", "cuál es mi saldo?", "cuánto hay en mi cuenta?"). Devuelve el saldo actual de todas las cuentas o de una cuenta específica.',
      parameters: {
        type: 'object',
        properties: {
          accountId: { type: 'number', description: 'ID de la cuenta específica a consultar (opcional). Si no se especifica, devuelve todas las cuentas.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_presupuesto',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario pregunta por su presupuesto, límites de gasto, o cuánto le queda de presupuesto en una categoría (ej: "cuánto presupuesto me queda?", "cuál es mi presupuesto de Comida?", "cómo voy en el presupuesto?"). Devuelve el presupuesto asignado y gastado por categoría para un mes.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Mes en formato YYYY-MM (opcional, por defecto el mes actual)' },
          categoryName: { type: 'string', description: 'Nombre de la categoría específica (opcional). Si no se especifica, devuelve todas.' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'obtener_resumen_financiero',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario pide un resumen de sus finanzas, un informe, o quiere saber cómo va en un período (ej: "dame un resumen del mes", "cómo voy esta semana?", "cuánto gasté e ingresé este mes?"). Devuelve total de ingresos, gastos, neto y desglose por categoría.',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['hoy', 'semana', 'mes', 'año'], description: 'Período del resumen (por defecto "mes")' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_gastos',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario pregunta en qué se le fue el dinero, cuáles son sus mayores gastos, o qué categorías gastó más (ej: "en qué gasté más?", "top gastos del mes", "dónde se fue mi dinero?"). Devuelve las categorías con mayor gasto ordenadas de mayor a menor.',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['semana', 'mes', 'año'], description: 'Período a analizar (por defecto "mes")' },
          limite: { type: 'number', description: 'Número máximo de categorías a mostrar (opcional, por defecto 5)' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comparar_gastos',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario quiere comparar sus gastos entre dos períodos (ej: "gasté más o menos que el mes pasado?", "compara este mes con el anterior", "cómo voy vs el mes pasado?"). Compara el período actual con el anterior y muestra cambios porcentuales.',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['semana', 'mes', 'año'], description: 'Período a comparar con su equivalente anterior (por defecto "mes")' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detectar_recurrencia',
      strict: true,
      description: 'ÚNICAMENTE cuando el usuario acaba de registrar un gasto y quieres verificar si es un gasto recurrente (suscripción, membresía, pago mensual) que podría registrarse como suscripción (ej: después de que el usuario registre Netflix, Spotify, Gym, etc.). Busca transacciones similares en meses anteriores.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Descripción de la transacción actual para buscar coincidencias' },
          amount: { type: 'number', description: 'Monto de la transacción actual' },
          categoryName: { type: 'string', description: 'Nombre de la categoría de la transacción actual' },
        },
        required: ['description', 'amount', 'categoryName'],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================
// Mapa de nombres de tools a actionType
// ============================================================

const TOOL_TO_ACTION_TYPE: Record<string, string> = {
  registrar_transaccion: 'transaction',
  actualizar_transaccion: 'update_transaction',
  eliminar_transaccion: 'delete_transaction',
  crear_cuenta: 'create_account',
  actualizar_cuenta: 'update_account',
  eliminar_cuenta: 'delete_account',
  transferir: 'transfer',
  crear_meta: 'create_goal',
  actualizar_progreso_meta: 'update_goal_progress',
  eliminar_meta: 'delete_goal',
  crear_suscripcion: 'create_subscription',
  actualizar_suscripcion: 'update_subscription',
  eliminar_suscripcion: 'delete_subscription',
  asignar_presupuesto: 'set_budget',
  crear_deuda: 'create_debt',
  pagar_deuda: 'pay_debt',
  eliminar_deuda: 'delete_debt',
  // Tools de consulta (se ejecutan en backend)
  consultar_saldo: 'query_balance',
  consultar_presupuesto: 'query_budget',
  obtener_resumen_financiero: 'query_summary',
  top_gastos: 'query_top_expenses',
  comparar_gastos: 'query_compare',
  detectar_recurrencia: 'query_recurrence',
};

// Tools que son de consulta (no requieren confirmación, se ejecutan en backend)
const QUERY_TOOLS = new Set([
  'consultar_saldo',
  'consultar_presupuesto',
  'obtener_resumen_financiero',
  'top_gastos',
  'comparar_gastos',
  'detectar_recurrencia',
]);

// ============================================================
// Funciones ejecutoras de tools de consulta
// ============================================================

/**
 * Ejecuta una tool de consulta contra la BD y devuelve los resultados
 * como string para ser enviados de vuelta al modelo.
 */
async function executeQueryTool(
  toolName: string,
  args: Record<string, unknown>,
  accounts: Account[]
): Promise<string> {
  const db = await getDatabase();

  switch (toolName) {
    case 'consultar_saldo': {
      const accountId = args.accountId as number | undefined;
      if (accountId) {
        const account = accounts.find(a => a.id === accountId);
        if (!account) return `No se encontró la cuenta con ID ${accountId}.`;
        return JSON.stringify({
          name: account.name,
          type: account.type,
          balanceUSD: account.initialBalanceUSD,
          balanceBS: account.initialBalanceBS,
        });
      }
      return JSON.stringify(accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        balanceUSD: a.initialBalanceUSD,
        balanceBS: a.initialBalanceBS,
      })));
    }

    case 'consultar_presupuesto': {
      const month = (args.month as string) || new Date().toISOString().slice(0, 7);
      const categoryName = args.categoryName as string | undefined;

      let query = `
        SELECT ba.id, ba.categoryId, c.name as categoryName, ba.amountUSD, ba.amountBS,
          COALESCE((
            SELECT SUM(COALESCE(t.amountUSD, 0))
            FROM transactions t
            WHERE t.categoryId = ba.categoryId
              AND t.type = 'expense'
              AND strftime('%Y-%m', t.date) = ?
          ), 0) as spentUSD,
          COALESCE((
            SELECT SUM(COALESCE(t.amountBS, 0))
            FROM transactions t
            WHERE t.categoryId = ba.categoryId
              AND t.type = 'expense'
              AND strftime('%Y-%m', t.date) = ?
          ), 0) as spentBS
        FROM budget_allocations ba
        JOIN categories c ON ba.categoryId = c.id
        WHERE ba.month = ?`;
      const params: any[] = [month, month, month];

      if (categoryName) {
        query += ' AND c.name = ?';
        params.push(categoryName);
      }

      const rows = await db.getAllAsync<any>(query, params);
      if (rows.length === 0) {
        return categoryName
          ? `No hay presupuesto asignado para "${categoryName}" en ${month}.`
          : `No hay presupuestos asignados para ${month}.`;
      }
      return JSON.stringify(rows.map((r: any) => ({
        category: r.categoryName,
        budgetUSD: r.amountUSD,
        budgetBS: r.amountBS,
        spentUSD: r.spentUSD,
        spentBS: r.spentBS,
        remainingUSD: (r.amountUSD || 0) - (r.spentUSD || 0),
        remainingBS: (r.amountBS || 0) - (r.spentBS || 0),
      })));
    }

    case 'obtener_resumen_financiero': {
      const periodo = (args.periodo as string) || 'mes';
      const now = new Date();
      let startDate: string, endDate: string;

      switch (periodo) {
        case 'hoy':
          startDate = now.toISOString().slice(0, 10);
          endDate = startDate;
          break;
        case 'semana': {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          startDate = weekStart.toISOString().slice(0, 10);
          endDate = now.toISOString().slice(0, 10);
          break;
        }
        case 'año':
          startDate = `${now.getFullYear()}-01-01`;
          endDate = `${now.getFullYear()}-12-31`;
          break;
        case 'mes':
        default:
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = now.toISOString().slice(0, 10);
          break;
      }

      const summary = await getReportSummary(startDate, endDate);
      const breakdown = await getCategoryBreakdown('expense', startDate, endDate);

      return JSON.stringify({
        periodo,
        startDate,
        endDate,
        summary,
        topCategories: breakdown.slice(0, 5),
      });
    }

    case 'top_gastos': {
      const p = (args.periodo as string) || 'mes';
      const limite = (args.limite as number) || 5;
      const now = new Date();
      let startDate: string, endDate: string;

      switch (p) {
        case 'semana': {
          const ws = new Date(now);
          ws.setDate(now.getDate() - now.getDay());
          startDate = ws.toISOString().slice(0, 10);
          endDate = now.toISOString().slice(0, 10);
          break;
        }
        case 'año':
          startDate = `${now.getFullYear()}-01-01`;
          endDate = `${now.getFullYear()}-12-31`;
          break;
        case 'mes':
        default:
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = now.toISOString().slice(0, 10);
          break;
      }

      const breakdown = await getCategoryBreakdown('expense', startDate, endDate);
      const top = breakdown.slice(0, limite);
      const totalUSD = top.reduce((s, c) => s + c.totalUSD, 0);
      const totalBS = top.reduce((s, c) => s + c.totalBS, 0);

      return JSON.stringify({
        periodo: p,
        startDate,
        endDate,
        categories: top,
        totalUSD,
        totalBS,
      });
    }

    case 'comparar_gastos': {
      const per = (args.periodo as string) || 'mes';
      const now = new Date();
      let currentStart: string, currentEnd: string;
      let previousStart: string, previousEnd: string;

      switch (per) {
        case 'semana': {
          const ws = new Date(now);
          ws.setDate(now.getDate() - now.getDay());
          currentStart = ws.toISOString().slice(0, 10);
          currentEnd = now.toISOString().slice(0, 10);
          const prevWs = new Date(ws);
          prevWs.setDate(ws.getDate() - 7);
          previousStart = prevWs.toISOString().slice(0, 10);
          previousEnd = ws.toISOString().slice(0, 10);
          break;
        }
        case 'año': {
          currentStart = `${now.getFullYear()}-01-01`;
          currentEnd = `${now.getFullYear()}-12-31`;
          previousStart = `${now.getFullYear() - 1}-01-01`;
          previousEnd = `${now.getFullYear() - 1}-12-31`;
          break;
        }
        case 'mes':
        default: {
          currentStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          currentEnd = now.toISOString().slice(0, 10);
          const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          previousStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
          previousEnd = prevMonth.toISOString().slice(0, 10);
          break;
        }
      }

      const current = await getReportSummary(currentStart, currentEnd);
      const previous = await getReportSummary(previousStart, previousEnd);

      const calcChange = (curr: number, prev: number): number | null => {
        if (prev === 0) return curr > 0 ? 100 : null;
        return Math.round(((curr - prev) / prev) * 100);
      };

      return JSON.stringify({
        periodo: per,
        current: { start: currentStart, end: currentEnd, ...current },
        previous: { start: previousStart, end: previousEnd, ...previous },
        changes: {
          incomeChange: calcChange(current.totalIncomeUSD, previous.totalIncomeUSD),
          expenseChange: calcChange(current.totalExpenseUSD, previous.totalExpenseUSD),
          netChange: calcChange(current.netUSD, previous.netUSD),
        },
      });
    }

    case 'detectar_recurrencia': {
      const desc = (args.description as string || '').toLowerCase();
      const amount = args.amount as number;
      const catName = args.categoryName as string;

      // Buscar transacciones similares en los últimos 3 meses
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const startDate = threeMonthsAgo.toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const rows = await db.getAllAsync<any>(
        `SELECT t.*, c.name as categoryName
         FROM transactions t
         LEFT JOIN categories c ON t.categoryId = c.id
         WHERE t.date >= ?
           AND t.date <= ?
           AND t.type = 'expense'
           AND (LOWER(t.description) LIKE ? OR LOWER(t.description) LIKE ?)
         ORDER BY t.date DESC`,
        [startDate, endDate, `%${desc}%`, `%${desc.split(' ').slice(0, 2).join('%')}%`]
      );

      // Agrupar por mes para detectar recurrencia
      const months = new Set<string>();
      for (const row of rows) {
        months.add(row.date.slice(0, 7));
      }

      return JSON.stringify({
        description: desc,
        amount,
        categoryName: catName,
        occurrencesLast3Months: rows.length,
        monthsWithActivity: Array.from(months).sort(),
        isRecurring: months.size >= 2,
        recentTransactions: rows.slice(0, 5).map((r: any) => ({
          date: r.date,
          description: r.description,
          amountUSD: r.amountUSD,
          amountBS: r.amountBS,
          category: r.categoryName,
        })),
      });
    }

    default:
      return `Error: Tool de consulta desconocida: ${toolName}`;
  }
}

// ============================================================
// System Prompt - FinBot
// ============================================================
// ============================================================

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

  let accountsInstruction = '';
  if (accounts.length === 0) {
    accountsInstruction = `
## ⚠️ IMPORTANTE: NO HAY CUENTAS CREADAS
El usuario NO tiene ninguna cuenta bancaria o de efectivo registrada en la aplicación.
- NO puedes crear transacciones, transferencias, ingresos, gastos ni ninguna operación que requiera una cuenta.
- Si el usuario intenta gastar, ingresar, transferir dinero, crear una suscripción, etc., debes INFORMARLE que primero necesita crear una cuenta.
- Dile algo como: "No tienes cuentas creadas. Primero necesitas crear una cuenta para poder registrar transacciones. ¿Quieres que te ayude a crear una?"
- Si el usuario acepta o también pide crear una cuenta, USA el tool crear_cuenta para ayudarlo.
- IMPORTANTE: Si el usuario pide VARIAS cosas (ej: "crea una cuenta y crea un gasto"), enfócate en la PRIMERA acción (crear cuenta) y menciona que después de crear la cuenta podrá hacer lo otro. NO intentes hacer todo en un solo paso.
`;
  } else {
    accountsInstruction = `
## INFERENCIA DE CUENTA:
Si el usuario no especifica una cuenta, INFIÉRELA automáticamente de la lista de cuentas disponible. Si hay varias, elige la más obvia (efectivo, débito, etc.) o pregunta si no está clara.
`;
  }

  return `Eres FinBot 🤖, un asistente financiero inteligente y conversacional. Tu personalidad es profesional pero amigable, como un asesor financiero de confianza. Hablas de forma clara y directa, usando emojis con moderación para hacer la conversación más amena.

## 🧠 TUS CAPACIDADES
Tienes dos tipos de herramientas a tu disposición:

### 1. Herramientas de CONSULTA (ejecución inmediata)
Puedes consultar saldos, presupuestos, resúmenes financieros, comparativas y detectar recurrencias. Cuando el usuario pregunte "¿cuánto tengo?", "¿cómo voy?", "dame un resumen", "¿en qué gasto más?", DEBES usar estas herramientas para obtener datos reales de la base de datos y luego presentarlos de forma clara y amigable.

### 2. Herramientas de ACCIÓN (requieren confirmación)
Para crear, modificar o eliminar datos financieros. El sistema mostrará una tarjeta de confirmación al usuario antes de ejecutar.

## ⚠️ REGLA ABSOLUTA: SEPARACIÓN DE ROLES
Tú SOLO puedes PROPONER acciones mediante las herramientas (tools). NO tienes el poder de hacer cambios reales. El sistema se encarga de ejecutar la acción después de que el usuario confirme.
- NUNCA respondas con frases como "Listo, ya lo registré", "He creado", "Se ha completado" en texto plano sin haber ejecutado primero la herramienta (tool).
- NUNCA escribas el nombre de una función o un JSON en texto plano. Si necesitas ejecutar una acción, DEBES usar el formato interno de llamada a herramienta (tool_calls).
- Si usas la herramienta correctamente, el sistema te confirmará el resultado.

## ⚠️ REGLA ABSOLUTA: NUNCA INVENTES DATOS
NUNCA inventes nombres de personas, tipos de deuda, categorías, cuentas o cualquier información que el usuario no haya proporcionado explícitamente. Si el usuario no dice "a Juan" o "presté", NO asumas "Juan" ni "lent". PREGUNTA siempre.

## REGLA DE ORO:
SIEMPRE que el usuario mencione crear, registrar, gastar, ingresar, transferir, modificar, eliminar, pagar, o cualquier acción financiera, DEBES usar la herramienta (tool) correspondiente. No preguntes "¿Qué herramienta uso?" — solo úsala.

## 📊 CONSEJOS FINANCIEROS PROACTIVOS
Cuando tengas datos financieros del usuario, puedes ofrecer consejos útiles:
- **Regla 50/30/20**: Sugiere que el 50% de ingresos vaya a necesidades, 30% a deseos y 20% a ahorro/inversión.
- **Fondo de emergencia**: Recomienda tener 3-6 meses de gastos en un fondo de emergencia.
- **Método de bola de nieve**: Para deudas, sugiere pagar primero la deuda más pequeña para ganar impulso.
- **Presupuesto**: Si los gastos superan los ingresos, alerta amablemente y sugiere revisar el presupuesto.

## FLUJO DE TRABAJO:
1. **Escucha** lo que el usuario quiere hacer
2. **Si faltan datos obligatorios** (como a quién se la debe, tipo de deuda, categoría, cuenta destino, etc.), PREGUNTA primero de forma conversacional. NUNCA inventes valores.
3. **Una vez que tengas todos los datos**, llama DIRECTAMENTE a la herramienta (tool) correspondiente. NO preguntes "¿Confirmas?" ni expliques en texto lo que vas a hacer — el sistema ya mostrará una tarjeta de confirmación al usuario.
4. **Excepción**: Si el usuario pide VARIAS acciones iguales (ej: "crea 2 gastos de 10$"), puedes crear UNA y luego preguntar si desea crear la siguiente.

## EJEMPLO PARA DEUDAS:
Usuario: "crear una deuda de 20$"
Tú: "Entendido. ¿Esta deuda es porque prestaste 20$ (te deben) o porque pediste prestado 20$ (tú debes)?"
Usuario: "presté"
Tú: "¿A quién le prestaste?"
Usuario: "a Juan"
Tú: [LLAMAS AL TOOL crear_deuda con amount:20, currency:"USD", type:"lent", personName:"Juan"]
Sistema: "Deuda registrada correctamente"
Tú: "Listo, quedó registrada la deuda de 20$ que le prestaste a Juan."

## INFERENCIA DE CATEGORÍAS:
Si el usuario no especifica categoría, INFIÉRELA automáticamente:
- "café", "comida", "supermercado", "restaurante" → "Comida"
- "uber", "taxi", "gasolina", "metro" → "Transporte"
- "sueldo", "salario", "pago" → "Ingreso" (si existe)
- Usa SIEMPRE los nombres EXACTOS de categorías listados abajo${accountsInstruction}
## EXCEPCIÓN:
Solo responde NATURALMENTE (sin tools) cuando el usuario haga preguntas informativas como "¿cuánto tengo?", "¿cómo voy?", "dame un resumen". En esos casos, USA las herramientas de consulta (consultar_saldo, consultar_presupuesto, obtener_resumen_financiero, top_gastos, comparar_gastos, detectar_recurrencia) para obtener datos reales y luego presentarlos.

## CONTEXTO DEL USUARIO:
Cuentas: ${JSON.stringify(accountsSummary)}
Categorías: ${JSON.stringify(categoriesList)}`;
}

// ============================================================
// Validación con Zod + Self-Healing
// ============================================================

const MAX_SELF_HEALING_ATTEMPTS = 2;

/**
 * Valida los argumentos de una tool call usando Zod.
 * Si falla, devuelve el error formateado para self-healing.
 */
function validateToolArgs(
  toolName: string,
  args: Record<string, unknown>
): { success: true; data: ValidatedAction } | { success: false; error: string } {
  const actionType = TOOL_TO_ACTION_TYPE[toolName];
  if (!actionType) {
    return { success: false, error: `Tool desconocida: ${toolName}` };
  }

  const schema = ACTION_SCHEMA_MAP[actionType];
  if (!schema) {
    return { success: false, error: `No hay esquema Zod para: ${actionType}` };
  }

  // Añadir actionType a los args para que Zod lo valide
  const argsWithType = { ...args, actionType };

  const result = schema.safeParse(argsWithType);
  if (result.success) {
    return { success: true, data: result.data as ValidatedAction };
  }

  // Formatear errores de Zod para feedback al LLM
  const errorDetails = result.error.issues
    .map((issue) => {
      const field = issue.path.join('.');
      return `- Campo '${field}': ${issue.message} (recibido: ${JSON.stringify(issue.input)})`;
    })
    .join('\n');

  return {
    success: false,
    error: `Error de validación en los argumentos:\n${errorDetails}\n\nCorrige los argumentos y vuelve a llamar la herramienta.`,
  };
}

/**
 * Hace un segundo intento forzando tool_choice para que el modelo
 * use una tool cuando no lo hizo en el primer intento.
 */
async function callWithForcedTool(
  apiMessages: { role: string; content: string }[],
  apiKey: string,
  accounts: Account[]
): Promise<DeepSeekResponse | null> {
  console.log('[DEEPSEEK DEBUG] === 2do INTENTO (tool_choice: required) ===');
  try {
    console.log('[DEEPSEEK DEBUG] Enviando request con tool_choice: required...');
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: 'required',
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.log('[DEEPSEEK DEBUG] 2do intento - error HTTP:', response.status);
      return null;
    }

    const data = await response.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      console.log('[DEEPSEEK DEBUG] 2do intento - NO tool_calls en respuesta');
      return null;
    }

    const toolCall = toolCalls[0];
    const toolName = toolCall.function.name;
    let args: Record<string, unknown>;

    console.log('[DEEPSEEK DEBUG] 2do intento - tool elegida:', toolName);
    console.log('[DEEPSEEK DEBUG] 2do intento - argumentos:', toolCall.function.arguments);

    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      console.log('[DEEPSEEK DEBUG] 2do intento - error parseando JSON');
      return null;
    }

    const actionType = TOOL_TO_ACTION_TYPE[toolName];
    if (!actionType) {
      console.log('[DEEPSEEK DEBUG] 2do intento - tool no mapeada:', toolName);
      return null;
    }

    const schema = ACTION_SCHEMA_MAP[actionType];
    if (!schema) {
      console.log('[DEEPSEEK DEBUG] 2do intento - sin schema para:', actionType);
      return null;
    }

    const result = schema.safeParse({ ...args, actionType });
    if (!result.success) {
      console.log('[DEEPSEEK DEBUG] 2do intento - Zod falló:', result.error.issues);
      return null;
    }

    console.log('[DEEPSEEK DEBUG] 2do intento - Zod OK');

    // Validación: si no hay cuentas, no permitir tools que requieran cuenta
    // NOTA: crear_cuenta NO está en la lista porque es justamente lo que se necesita
    // cuando no hay cuentas. Las tools de deuda (crear_deuda, pagar_deuda, eliminar_deuda)
    // tampoco requieren cuenta porque son independientes.
    const toolsQueRequierenCuenta = [
      'crear_transaccion', 'actualizar_transaccion', 'eliminar_transaccion',
      'actualizar_cuenta', 'eliminar_cuenta',
      'crear_transferencia',
      'crear_suscripcion', 'actualizar_suscripcion', 'eliminar_suscripcion',
      'crear_meta', 'actualizar_progreso_meta', 'eliminar_meta',
      'crear_presupuesto',
      // Las query tools NO requieren cuenta porque consultan la BD directamente
    ];
    if (accounts.length === 0 && toolsQueRequierenCuenta.includes(toolName)) {
      console.log('[DEEPSEEK DEBUG] 2do intento - BLOQUEADO: no hay cuentas, tool:', toolName);
      return {
        type: 'response',
        content: '❌ No tienes cuentas creadas. Primero necesitas crear una cuenta en la sección de Cuentas para poder realizar esta operación. ¿Quieres que te ayude a crear una?',
      };
    }

    const action = { ...(result.data as Record<string, unknown>), actionType } as DeepSeekAction;
    const textContent = data.choices?.[0]?.message?.content || '';

    console.log('[DEEPSEEK DEBUG] 2do intento - ACCIÓN generada:', actionType, JSON.stringify(action));
    console.log('[DEEPSEEK DEBUG] === FIN 2do INTENTO ===');

    return {
      type: 'action',
      content: textContent || '¿Quieres que ejecute esta operación?',
      action,
    };
  } catch (e) {
    console.log('[DEEPSEEK DEBUG] 2do intento - excepción:', e);
    return null;
  }
}

// ============================================================
// Función principal: chatWithDeepSeek
// ============================================================

/**
 * Envía un mensaje a DeepSeek API usando Function Calling (Tools API).
 * Procesa tool_calls y valida con Zod + Self-Healing.
 */
export async function chatWithDeepSeek(
  messages: DeepSeekMessage[],
  accounts: Account[],
  categories: Category[],
  apiKey: string
): Promise<DeepSeekResponse> {
  if (!apiKey) {
    console.log('[DEEPSEEK DEBUG] No hay API Key configurada');
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

  console.log('[DEEPSEEK DEBUG] ========================================');
  console.log('[DEEPSEEK DEBUG] INICIO chatWithDeepSeek');
  console.log('[DEEPSEEK DEBUG] Cuentas disponibles:', accounts.length);
  console.log('[DEEPSEEK DEBUG] Categorías disponibles:', categories.length);
  console.log('[DEEPSEEK DEBUG] Mensajes en historial:', messages.length);
  const lastMsg = messages.filter(m => m.role === 'user').pop();
  console.log('[DEEPSEEK DEBUG] Último mensaje usuario:', lastMsg?.content?.substring(0, 100));

  try {
    console.log('[DEEPSEEK DEBUG] Enviando request a DeepSeek API (1er intento)...');
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        tools: TOOLS,
        temperature: 0.0,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.log('[DEEPSEEK DEBUG] Error HTTP:', response.status, errorBody.substring(0, 200));
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
    const choice = data.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      console.log('[DEEPSEEK DEBUG] No se recibió assistantMessage en la respuesta');
      return {
        type: 'response',
        content: '⚠️ No se recibió respuesta de DeepSeek. Intenta de nuevo.',
      };
    }

    // Si el modelo respondió con texto normal (sin tool_calls)
    const textContent = assistantMessage.content || '';

    // Detectar si el mensaje del usuario parece requerir una acción
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';
    const pareceAccion = /gast[eióo]|registr[aeo]|ingres[ao]|cre[aeo]|transferir|pag[au]|modific[aeo]|elimin[aeo]|nuev[ao]|agreg[aeo]|met[aeo]|suscripci|presupuest|deud[aeo]|prest[aeo]|movimi/.test(lastUserMsg);

    console.log('[DEEPSEEK DEBUG] 1er intento - ¿tiene tool_calls?:', !!assistantMessage.tool_calls);
    console.log('[DEEPSEEK DEBUG] 1er intento - textContent:', textContent?.substring(0, 150));
    console.log('[DEEPSEEK DEBUG] 1er intento - pareceAccion:', pareceAccion);

    // Si hay tool_calls, procesar la primera (por ahora solo manejamos una por vez)
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const toolName = toolCall.function.name;
      let args: Record<string, unknown>;

      console.log('[DEEPSEEK DEBUG] Tool detectada:', toolName);
      console.log('[DEEPSEEK DEBUG] Argumentos crudos:', toolCall.function.arguments);

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        console.log('[DEEPSEEK DEBUG] Error parseando JSON de argumentos');
        return {
          type: 'response',
          content: textContent || '⚠️ Error al procesar la respuesta. Intenta de nuevo.',
        };
      }

      // ============================================================
      // QUERY TOOLS: Ejecutar consulta y realimentar al modelo
      // ============================================================
      if (QUERY_TOOLS.has(toolName)) {
        console.log('[DEEPSEEK DEBUG] QUERY TOOL detectada:', toolName);

        // 1. Ejecutar la consulta contra la BD
        const queryResult = await executeQueryTool(toolName, args, accounts);
        console.log('[DEEPSEEK DEBUG] Resultado de consulta (primeros 200 chars):', queryResult.substring(0, 200));

        // 2. Construir mensajes para la segunda llamada: incluimos la tool call y su resultado
        const followUpMessages: any[] = [
          ...apiMessages,
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: toolCall.id,
                type: 'function',
                function: {
                  name: toolName,
                  arguments: toolCall.function.arguments,
                },
              },
            ],
          },
          {
            role: 'tool',
            content: queryResult,
            tool_call_id: toolCall.id,
          },
        ];

        // 3. Hacer segunda llamada para que el modelo genere respuesta natural
        console.log('[DEEPSEEK DEBUG] Enviando follow-up request con resultados de consulta...');
        const followUpResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: followUpMessages,
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (!followUpResponse.ok) {
          console.log('[DEEPSEEK DEBUG] Follow-up request falló:', followUpResponse.status);
          // Fallback: devolver los datos crudos si la segunda llamada falla
          return {
            type: 'response',
            content: `Aquí tienes los datos consultados:\n\n${queryResult}`,
          };
        }

        const followUpData = await followUpResponse.json();
        const followUpContent = followUpData.choices?.[0]?.message?.content || '';

        console.log('[DEEPSEEK DEBUG] Respuesta final del modelo tras consulta:', followUpContent.substring(0, 200));
        console.log('[DEEPSEEK DEBUG] ========================================');

        return {
          type: 'response',
          content: followUpContent,
        };
      }

      // ============================================================
      // ACTION TOOLS: Validar con Zod + Self-Healing
      // ============================================================

      // Validar con Zod (con self-healing)
      console.log('[DEEPSEEK DEBUG] Iniciando validación Zod + Self-Healing...');
      const validation = await validateWithSelfHealing(
        toolName,
        args,
        apiMessages,
        apiKey,
        0,
        systemPrompt
      );

      if (!validation.success) {
        console.log('[DEEPSEEK DEBUG] Validación falló después de self-healing');
        return {
          type: 'response',
          content: textContent || '⚠️ No se pudieron validar los datos después de varios intentos. Por favor, intenta con otros valores.',
        };
      }

      console.log('[DEEPSEEK DEBUG] Validación exitosa, datos:', JSON.stringify(validation.data));

      // Mapear el nombre de la tool al actionType correspondiente
      const actionType = TOOL_TO_ACTION_TYPE[toolName];

      // Validación específica para crear_deuda: el usuario debe haber mencionado
      // el tipo (lent/borrowed) y el nombre de la persona en su mensaje.
      // El modelo TIENDE a inventar estos datos, así que verificamos el mensaje real del usuario.
      if (toolName === 'crear_deuda') {
        const debtArgs = validation.data as Record<string, unknown>;
        // El mensaje del usuario en minúsculas para buscar palabras clave
        const userMsg = lastUserMsg.toLowerCase();

        // Detectar si el usuario mencionó el tipo de deuda
        const mencionoType = /\b(prest[éeo]|ped[ií].*prestado|debo|debe|deb[eo]|me deben|me presta|prestamos)\b/i.test(userMsg);
        // Detectar si el usuario mencionó un nombre de persona (palabra después de "a " o "de ")
        const mencionoPersona = /(^|\s)(a|de|con|para)\s+[a-záéíóúñ]+(\s|$)/i.test(userMsg) ||
                                /[a-záéíóúñ]+\s+(me debe|le prest[ée]|me prest[óo])/i.test(userMsg);

        const necesitaType = !mencionoType;
        const necesitaPersonName = !mencionoPersona;

        console.log('[DEEPSEEK DEBUG] Validación deuda - mencionoType:', mencionoType, 'mencionoPersona:', mencionoPersona);

        if (necesitaType || necesitaPersonName) {
          let preguntas: string[] = [];
          if (necesitaType) {
            preguntas.push('¿Esta deuda es porque **prestaste** dinero (te deben) o porque **pediste prestado** (tú debes)?');
          }
          if (necesitaPersonName) {
            preguntas.push('¿Cuál es el **nombre de la persona** involucrada?');
          }
          console.log('[DEEPSEEK DEBUG] Deuda: faltan datos, preguntando al usuario');
          return {
            type: 'response',
            content: `Para registrar la deuda necesito algunos datos:\n\n${preguntas.join('\n')}`,
          };
        }
      }

      // Validación: si no hay cuentas, NO permitir tools que requieran cuenta
      // NOTA: crear_cuenta NO está en la lista porque es justamente lo que se necesita
      // cuando no hay cuentas. Las tools de deuda (crear_deuda, pagar_deuda, eliminar_deuda)
      // tampoco requieren cuenta porque son independientes.
      const toolsQueRequierenCuenta = [
        'crear_transaccion', 'actualizar_transaccion', 'eliminar_transaccion',
        'actualizar_cuenta', 'eliminar_cuenta',
        'crear_transferencia',
        'crear_suscripcion', 'actualizar_suscripcion', 'eliminar_suscripcion',
        'crear_meta', 'actualizar_progreso_meta', 'eliminar_meta',
        'crear_presupuesto',
        // Las query tools NO requieren cuenta porque consultan la BD directamente
      ];
      if (accounts.length === 0 && toolsQueRequierenCuenta.includes(toolName)) {
        console.log('[DEEPSEEK DEBUG] BLOQUEADO: no hay cuentas y se intentó usar:', toolName);
        return {
          type: 'response',
          content: '❌ No tienes cuentas creadas. Primero necesitas crear una cuenta en la sección de Cuentas para poder realizar esta operación. ¿Quieres que te ayude a crear una?',
        };
      }

      const action = { ...validation.data, actionType } as DeepSeekAction;

      console.log('[DEEPSEEK DEBUG] ACCIÓN generada:', actionType, JSON.stringify(action));
      console.log('[DEEPSEEK DEBUG] ========================================');

      return {
        type: 'action',
        content: textContent || '¿Quieres que ejecute esta operación?',
        action,
      };
    }

    // Respuesta normal sin tool_calls
    // Si el mensaje del usuario parece requerir una acción, forzamos un segundo intento
    if (pareceAccion) {
      console.log('[DEEPSEEK DEBUG] 1er intento respondió sin tool, pareceAccion=true');

      // Verificar si el modelo YA respondió adecuadamente sobre la falta de cuentas
      const textLower = (textContent || '').toLowerCase();
      const yaRespondioSinCuentas = accounts.length === 0 && (
        textLower.includes('no tienes cuentas') ||
        textLower.includes('no hay cuentas') ||
        textLower.includes('primero necesitas crear una cuenta') ||
        textLower.includes('crear una cuenta primero') ||
        textLower.includes('necesitas crear una cuenta')
      );
      if (yaRespondioSinCuentas) {
        console.log('[DEEPSEEK DEBUG] El modelo ya respondió sobre falta de cuentas, NO forzamos 2do intento');
        console.log('[DEEPSEEK DEBUG] Respuesta final de texto:', textContent?.substring(0, 150));
        console.log('[DEEPSEEK DEBUG] ========================================');
        return {
          type: 'response',
          content: textContent,
        };
      }

      // Antes de forzar tool_choice, verificamos si faltan datos para CREAR una deuda
      // (no para pagar/abonar a una deuda existente)
      const esCrearDeuda = /(cre[aeo]|nuev[ao]|registr[aeo])\s.*(deud|prest)|(deud|prest).*(cre[aeo]|nuev[ao]|registr[aeo])/i.test(lastUserMsg);
      if (esCrearDeuda) {
        console.log('[DEEPSEEK DEBUG] parece crear deuda, validando datos en mensaje original');
        const mencionoType = /\b(prest[éeo]|ped[ií].*prestado|debo|debe|deb[eo]|me deben|me presta|prestamos)\b/i.test(lastUserMsg);
        const mencionoPersona = /(^|\s)(a|de|con|para)\s+[a-záéíóúñ]+(\s|$)/i.test(lastUserMsg) ||
                                /[a-záéíóúñ]+\s+(me debe|le prest[ée]|me prest[óo])/i.test(lastUserMsg);
        console.log('[DEEPSEEK DEBUG] Deuda - mencionoType:', mencionoType, 'mencionoPersona:', mencionoPersona);
        if (!mencionoType || !mencionoPersona) {
          let preguntas: string[] = [];
          if (!mencionoType) {
            preguntas.push('¿Esta deuda es porque **prestaste** dinero (te deben) o porque **pediste prestado** (tú debes)?');
          }
          if (!mencionoPersona) {
            preguntas.push('¿Cuál es el **nombre de la persona** involucrada?');
          }
          console.log('[DEEPSEEK DEBUG] Deuda: preguntando datos faltantes');
          return {
            type: 'response',
            content: `Para registrar la deuda necesito algunos datos:\n\n${preguntas.join('\n')}`,
          };
        }
      }

      // Si el modelo YA está preguntando algo al usuario (contiene "?"), NO forzar
      // porque está haciendo bien su trabajo de pedir información faltante
      if ((textContent || '').includes('?')) {
        console.log('[DEEPSEEK DEBUG] El modelo está preguntando algo al usuario, NO forzamos 2do intento');
        console.log('[DEEPSEEK DEBUG] Respuesta final de texto:', textContent?.substring(0, 150));
        console.log('[DEEPSEEK DEBUG] ========================================');
        return {
          type: 'response',
          content: textContent,
        };
      }

      console.log('[DEEPSEEK DEBUG] Forzando 2do intento con tool_choice: required...');
      const forcedResponse = await callWithForcedTool(apiMessages, apiKey, accounts);
      if (forcedResponse) {
        console.log('[DEEPSEEK DEBUG] 2do intento exitoso, tipo:', forcedResponse.type);
        if (forcedResponse.type === 'action') {
          console.log('[DEEPSEEK DEBUG] Acción forzada:', JSON.stringify(forcedResponse.action));
        }
        console.log('[DEEPSEEK DEBUG] ========================================');
        return forcedResponse;
      }
      console.log('[DEEPSEEK DEBUG] 2do intento falló (returned null)');
    }

    console.log('[DEEPSEEK DEBUG] Respuesta final de texto:', textContent?.substring(0, 150));
    console.log('[DEEPSEEK DEBUG] ========================================');

    return {
      type: 'response',
      content: textContent,
    };
  } catch (error: any) {
    console.error('[DEEPSEEK DEBUG] Error en chatWithDeepSeek:', error);
    return {
      type: 'response',
      content: `⚠️ Error de conexión: ${error?.message || 'No se pudo conectar con DeepSeek'}. Verifica tu conexión a internet.`,
    };
  }
}

/**
 * Valida argumentos con self-healing: si falla Zod, reenvía el error al LLM
 * para que se corrija (máximo MAX_SELF_HEALING_ATTEMPTS intentos).
 */
async function validateWithSelfHealing(
  toolName: string,
  args: Record<string, unknown>,
  apiMessages: { role: string; content: string }[],
  apiKey: string,
  attempt: number,
  systemPrompt?: string
): Promise<{ success: true; data: ValidatedAction } | { success: false }> {
  console.log('[DEEPSEEK DEBUG] Self-Healing - tool:', toolName, 'intento:', attempt);
  console.log('[DEEPSEEK DEBUG] Self-Healing - args:', JSON.stringify(args));

  const validation = validateToolArgs(toolName, args);

  if (validation.success) {
    console.log('[DEEPSEEK DEBUG] Self-Healing - validación directa OK');
    return validation;
  }

  console.log('[DEEPSEEK DEBUG] Self-Healing - validación falló:', validation.error?.substring(0, 200));

  if (attempt >= MAX_SELF_HEALING_ATTEMPTS) {
    console.warn(`[DEEPSEEK DEBUG] Self-healing AGOTADO para ${toolName} después de ${attempt} intentos`);
    return { success: false };
  }

  console.log(`[DEEPSEEK DEBUG] Self-healing - enviando corrección (intento ${attempt + 1})...`);

  // Construir mensajes para el healing: incluimos el system prompt si existe
  // para que el modelo no pierda contexto
  const healingMessages: { role: string; content: string; tool_call_id?: string }[] = [];

  if (systemPrompt) {
    healingMessages.push({ role: 'system', content: systemPrompt });
  }

  // Agregar los mensajes de la conversación (excluyendo el system original si ya lo pusimos)
  const msgsSinSystem = systemPrompt
    ? apiMessages.filter(m => m.role !== 'system')
    : apiMessages;
  healingMessages.push(...msgsSinSystem);

  // Mensaje del assistant con el tool_call que falló
  healingMessages.push({
    role: 'assistant',
    content: null as any,
    tool_call_id: undefined,
  });
  // Necesitamos agregar el tool_call real al último mensaje del assistant
  // Como la API espera tool_calls en el mensaje del assistant, reemplazamos:
  const assistantIndex = healingMessages.length - 1;
  healingMessages[assistantIndex] = {
    role: 'assistant',
    content: null as any,
    tool_call_id: undefined,
  };

  // Mensaje tool con el error de validación
  healingMessages.push({
    role: 'tool',
    content: validation.error,
    tool_call_id: 'self-healing',
  });

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
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          ...msgsSinSystem,
          {
            role: 'assistant' as const,
            content: null,
            tool_calls: [{
              id: 'self-healing-call',
              type: 'function',
              function: { name: toolName, arguments: JSON.stringify(args) },
            }],
          },
          {
            role: 'tool' as const,
            content: validation.error,
            tool_call_id: 'self-healing-call',
          },
        ],
        tools: TOOLS,
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.warn(`Self-healing HTTP ${response.status} para ${toolName}`);
      return { success: false };
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      try {
        const correctedArgs = JSON.parse(toolCalls[0].function.arguments);
        return validateWithSelfHealing(toolName, correctedArgs, apiMessages, apiKey, attempt + 1, systemPrompt);
      } catch {
        return { success: false };
      }
    }

    // Si el modelo respondió con texto en lugar de tool_calls, fallamos
    console.warn(`Self-healing: modelo respondió con texto en lugar de tool_calls para ${toolName}`);
    return { success: false };
  } catch (err) {
    console.warn(`Self-healing error para ${toolName}:`, err);
    return { success: false };
  }
}

// ============================================================
// testDeepSeekConnection (sin cambios)
// ============================================================

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

// ============================================================
// suggestCategory (sin cambios)
// ============================================================

export async function suggestCategory(
  description: string,
  categories: Category[],
  apiKey: string
): Promise<{ categoryId: number | null; categoryName: string | null }> {
  if (!description.trim() || !apiKey || categories.length === 0) {
    return { categoryId: null, categoryName: null };
  }

  const categoriesList = categories.map((c) => `- ${c.name} (${c.icon}): ${c.type}`).join('\n');

  const systemPrompt = `Eres un asistente que categoriza transacciones financieras.
Dada una descripción, responde SOLO con el nombre exacto de la categoría que mejor corresponda.
Categorías disponibles:
${categoriesList}

Responde únicamente con el nombre de la categoría, nada más.`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Descripción: "${description}"\n¿Qué categoría le asignas?` },
        ],
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      return { categoryId: null, categoryName: null };
    }

    const data = await response.json();
    const suggestedName: string = data.choices?.[0]?.message?.content?.trim() || '';

    // Buscar la categoría que coincida con el nombre sugerido
    const match = categories.find(
      (c) => c.name.toLowerCase() === suggestedName.toLowerCase()
    );

    if (match) {
      return { categoryId: match.id, categoryName: match.name };
    }

    // Si no hay match exacto, buscar coincidencia parcial
    const partialMatch = categories.find(
      (c) => suggestedName.toLowerCase().includes(c.name.toLowerCase()) ||
             c.name.toLowerCase().includes(suggestedName.toLowerCase())
    );

    if (partialMatch) {
      return { categoryId: partialMatch.id, categoryName: partialMatch.name };
    }

    return { categoryId: null, categoryName: null };
  } catch {
    return { categoryId: null, categoryName: null };
  }
}
