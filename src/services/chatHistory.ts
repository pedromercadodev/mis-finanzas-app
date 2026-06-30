const CHAT_HISTORY_KEY = 'ai-chat-history';

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const HISTORY_MAX_ITEMS = 100;

// localStorage wrapper para web
function getStorage(): Storage {
  return localStorage;
}

/**
 * Guarda un mensaje en el historial de chat.
 */
export async function saveChatMessage(msg: ChatHistoryMessage): Promise<void> {
  try {
    const history = await getChatHistory();
    history.push(msg);

    // Limitar a HISTORY_MAX_ITEMS mensajes
    const trimmed = history.slice(-HISTORY_MAX_ITEMS);

    getStorage().setItem(CHAT_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error saving chat message:', error);
  }
}

/**
 * Obtiene todo el historial de chat.
 */
export async function getChatHistory(): Promise<ChatHistoryMessage[]> {
  try {
    const data = getStorage().getItem(CHAT_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
}

/**
 * Obtiene las últimas N conversaciones (agrupadas por sesión).
 * Una sesión se define como mensajes separados por más de 30 minutos.
 */
export async function getChatSessions(): Promise<{ id: string; preview: string; date: string; count: number }[]> {
  try {
    const history = await getChatHistory();
    const sessions: { id: string; preview: string; date: string; count: number }[] = [];
    let currentSession: ChatHistoryMessage[] = [];

    for (let i = 0; i < history.length; i++) {
      const msg = history[i];

      if (currentSession.length === 0) {
        currentSession.push(msg);
      } else {
        const lastMsg = currentSession[currentSession.length - 1];
        const timeDiff = new Date(msg.timestamp).getTime() - new Date(lastMsg.timestamp).getTime();

        // Si pasaron más de 30 minutos, nueva sesión
        if (timeDiff > 30 * 60 * 1000) {
          sessions.push(sessionToPreview(currentSession));
          currentSession = [msg];
        } else {
          currentSession.push(msg);
        }
      }
    }

    if (currentSession.length > 0) {
      sessions.push(sessionToPreview(currentSession));
    }

    return sessions.reverse(); // Más recientes primero
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    return [];
  }
}

function sessionToPreview(session: ChatHistoryMessage[]): { id: string; preview: string; date: string; count: number } {
  const firstUserMsg = session.find((m) => m.role === 'user');
  const preview = firstUserMsg
    ? firstUserMsg.content.substring(0, 80) + (firstUserMsg.content.length > 80 ? '...' : '')
    : 'Conversación';
  const date = session[0]?.timestamp || new Date().toISOString();
  const formattedDate = new Date(date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    id: session[0]?.id || Date.now().toString(),
    preview,
    date: formattedDate,
    count: session.length,
  };
}

/**
 * Obtiene los mensajes de una sesión específica por ID del primer mensaje.
 */
export async function getSessionMessages(sessionId: string): Promise<ChatHistoryMessage[]> {
  try {
    const history = await getChatHistory();
    const startIndex = history.findIndex((m) => m.id === sessionId);

    if (startIndex === -1) return [];

    const session: ChatHistoryMessage[] = [];

    for (let i = startIndex; i < history.length; i++) {
      const msg = history[i];
      if (session.length > 0) {
        const lastMsg = session[session.length - 1];
        const timeDiff = new Date(msg.timestamp).getTime() - new Date(lastMsg.timestamp).getTime();
        if (timeDiff > 30 * 60 * 1000) break;
      }
      session.push(msg);
    }

    return session;
  } catch (error) {
    console.error('Error getting session messages:', error);
    return [];
  }
}

/**
 * Limpia todo el historial de chat.
 */
export async function clearChatHistory(): Promise<void> {
  try {
    getStorage().removeItem(CHAT_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing chat history:', error);
  }
}
