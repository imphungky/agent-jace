import { useCallback, useState } from 'react';
import { backend } from './api/client';
import type { ChatMessage } from './types';

let idCounter = 0;
const nextId = () => `m${idCounter++}`;

/** Owns the conversation state and the request lifecycle for one chat. */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text };
      const placeholder: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: '',
        pending: true,
      };

      // Snapshot history *before* the new turn for the stateless backend.
      const history = messages.map(({ role, content }) => ({ role, content }));
      setMessages((prev) => [...prev, userMsg, placeholder]);
      setBusy(true);

      try {
        const res = await backend.sendMessage({ message: text, history });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  content: res.reply,
                  followup: res.followup,
                  recommendations: res.recommendations,
                  toolCalls: res.tool_calls,
                  cards: res.cards,
                  pending: false,
                }
              : m,
          ),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  content: `⚠️ ${err instanceof Error ? err.message : 'Request failed'}`,
                  pending: false,
                }
              : m,
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [messages],
  );

  return { messages, busy, send };
}
