import { create } from 'zustand';
import { api } from '@/lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AdvisorState {
  messages: ChatMessage[];
  generatedAt: string | null;
  loading: boolean;
  startConversation: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  resetConversation: () => void;
}

async function callChat(messages: ChatMessage[]): Promise<ChatMessage> {
  return api.post<ChatMessage>('/advisor/chat', { messages });
}

export const useAdvisorStore = create<AdvisorState>((set, get) => ({
  messages: [],
  generatedAt: null,
  loading: false,

  startConversation: async () => {
    set({ loading: true });
    try {
      const reply = await callChat([]);
      set({
        messages: [reply],
        generatedAt: new Date().toISOString(),
        loading: false,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  sendMessage: async (content) => {
    const userMessage: ChatMessage = { role: 'user', content };
    const next = [...get().messages, userMessage];
    set({ messages: next, loading: true });
    try {
      const reply = await callChat(next);
      set({ messages: [...next, reply], loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  resetConversation: () => set({ messages: [], generatedAt: null }),
}));
