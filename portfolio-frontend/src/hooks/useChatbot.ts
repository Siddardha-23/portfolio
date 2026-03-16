import { useState, useCallback } from 'react';
import { apiService } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  isError?: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  content:
    "Hi! I'm Harshith's AI assistant. Ask me about his **skills**, **experience**, **projects**, or **education**.",
};

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Build history from previous messages (exclude welcome and errors)
      const history = messages
        .filter((m) => m.id !== 'welcome' && !m.isError && m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await apiService.sendChatMessage(trimmed, history);

      if (data?.response) {
        setMessages((prev) => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            content: data.response,
          },
        ]);
      } else {
        const errorText =
          error?.includes('429') || error?.includes('Too many')
            ? 'Too many messages - please wait a moment and try again.'
            : 'Sorry, something went wrong. Please try again.';
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'model',
            content: errorText,
            isError: true,
          },
        ]);
      }

      setIsLoading(false);
    },
    [messages, isLoading],
  );

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
  }, []);

  return { messages, isLoading, isOpen, setIsOpen, sendMessage, clearMessages };
}
