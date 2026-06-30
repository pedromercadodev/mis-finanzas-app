import type { Account, Category } from '../utils/types';

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Acción para crear una transacción (gasto/ingreso)
export interface TransactionAction {
  actionType: 'transaction';
  type: 'expense' | 'income';
  amount: number;
  currency: 'USD' | 'BS';
  description: string;
  category: string;
}

// Acción para crear una cuenta
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

// Acción para actualizar una cuenta (ej: cambiar nombre)
export interface UpdateAccountAction {
  actionType: 'update_account';
  accountId: number;
  name?: string;
  icon?: string;
  color?: string;
}

export type DeepSeekAction = TransactionAction | CreateAccountAction | UpdateAccountAction;

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

  return `Eres un asistente financiero personal experto en finanzas. Tu objetivo es ayudar al usuario a gestionar TODAS sus finanzas: registrar transacciones, crear cuentas, modificar cuentas, consultar saldos, y responder preguntas.

DATOS DEL USUARIO:

CUENTAS:
${JSON.stringify(accountsSummary, null, 2)}

CATEGORIAS DISPONIBLES:
${JSON.stringify(categoriesList, null, 2)}

INSTRUCCIONES IMPORTANTES:

1. **CREAR TRANSACCIONES (gasto/ingreso):**
   - Cuando el usuario indique un gasto o ingreso, usa:
     ACCION: {"actionType":"transaction","type":"expense|income","amount":NUMERO,"currency":"USD|BS","description":"TEXTO","category":"NOMBRE_CATEGORIA"}
   - La categoria debe ser EXACTAMENTE uno de los nombres listados en CATEGORIAS DISPONIBLES.
   - Siempre confirma con el usuario antes de ejecutar.

2. **CREAR CUENTAS:**
   - Cuando el usuario quiera crear una cuenta (ej: "crea una cuenta de ahorro", "agrega cuenta de banco"), usa:
     ACCION: {"actionType":"create_account","name":"NOMBRE","type":"cash|bank|virtual_card|exchange|other","currency":"USD|BS|BOTH","initialBalanceUSD":0,"initialBalanceBS":0}
   - Tipos de cuenta disponibles: cash (efectivo), bank (banco), virtual_card (tarjeta virtual), exchange (exchange/pago móvil), other (otro).
   - Pregunta al usuario: nombre, tipo, moneda, y saldo inicial si no los especifica.
   - Siempre confirma antes de crear.

3. **ACTUALIZAR CUENTAS:**
   - Cuando el usuario quiera cambiar el nombre de una cuenta (ej: "cambia el nombre de mi cuenta X a Y"), usa:
     ACCION: {"actionType":"update_account","accountId":ID,"name":"NUEVO_NOMBRE"}
   - El accountId debe ser el ID numérico de la cuenta en CUENTAS (ej: 1, 2, 3...).
   - IMPORTANTE: Si el usuario te dice "cambia el nombre de la cuenta X" donde X es el NOMBRE de la cuenta, busca en CUENTAS el ID correspondiente a ese nombre y úsalo como accountId.
   - Pregunta al usuario: qué cuenta quiere modificar y cuál es el nuevo nombre.
   - Siempre confirma antes de actualizar.

4. **CONSULTAS Y PREGUNTAS:**
   - Si el usuario pregunta sobre sus finanzas, responde NATURALMENTE usando los datos disponibles.
   - Ej: "¿Cuánto dinero tengo?" -> "Tienes un total de X USD y Y BS distribuidos en N cuentas."
   - Ej: "¿Cuánto gasté en comida?" -> "Has gastado X USD en Comida este mes."
   - Ej: "¿En qué me he gastado el dinero?" -> Lista las categorías con montos.
   - NO uses ACCION: para respuestas que solo son informativas.

5. **SI FALTAN DATOS:**
   - Pregunta siempre la información faltante. NO asumas valores por defecto.
   - NO uses ACCION: hasta que tengas todos los datos necesarios.

6. **REGLAS GENERALES:**
   - Sé claro, conciso y amable pero profesional.
   - Usa ACCION: solo cuando necesites que la app ejecute algo (crear/actualizar transacción o cuenta).
   - Para respuestas informativas, solo responde naturalmente sin ACCION:.`;
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
        temperature: 0.3,
        max_tokens: 1000,
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
        content: cleanContent || `¿Quieres que registre esta transacción?`,
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
  if (!apiKey) {
    return { success: false, message: 'No hay API Key configurada' };
  }

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
          { role: 'user', content: 'Responde solo "OK" si funciono.' },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      return { success: true, message: '✅ Conexión exitosa con DeepSeek' };
    } else if (response.status === 401) {
      return { success: false, message: '❌ API Key inválida' };
    } else {
      return { success: false, message: `❌ Error ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: `❌ Error de conexión: ${error?.message || 'Desconocido'}` };
  }
}
