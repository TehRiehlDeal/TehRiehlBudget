import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/api', () => ({ api: mockApi }));

import { useAdvisorStore } from './advisor';

describe('useAdvisorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdvisorStore.setState({
      messages: [],
      generatedAt: null,
      loading: false,
    });
  });

  it('startConversation posts empty messages and stores the assistant reply', async () => {
    mockApi.post.mockResolvedValue({
      role: 'assistant',
      content: 'Nice month — you trimmed dining by $50.',
    });

    await useAdvisorStore.getState().startConversation();

    expect(mockApi.post).toHaveBeenCalledWith('/advisor/chat', { messages: [] });
    const state = useAdvisorStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].role).toBe('assistant');
    expect(state.loading).toBe(false);
    expect(state.generatedAt).not.toBeNull();
  });

  it('sendMessage appends user turn then assistant reply', async () => {
    useAdvisorStore.setState({
      messages: [{ role: 'assistant', content: 'Opening analysis.' }],
    });
    mockApi.post.mockResolvedValue({
      role: 'assistant',
      content: 'Dining was $450.',
    });

    await useAdvisorStore.getState().sendMessage('What about dining?');

    expect(mockApi.post).toHaveBeenCalledWith('/advisor/chat', {
      messages: [
        { role: 'assistant', content: 'Opening analysis.' },
        { role: 'user', content: 'What about dining?' },
      ],
    });
    const state = useAdvisorStore.getState();
    expect(state.messages).toHaveLength(3);
    expect(state.messages[1]).toEqual({
      role: 'user',
      content: 'What about dining?',
    });
    expect(state.messages[2]).toEqual({
      role: 'assistant',
      content: 'Dining was $450.',
    });
  });

  it('resetConversation clears messages and timestamp', () => {
    useAdvisorStore.setState({
      messages: [{ role: 'assistant', content: 'hi' }],
      generatedAt: '2026-04-12T00:00:00.000Z',
    });

    useAdvisorStore.getState().resetConversation();

    expect(useAdvisorStore.getState().messages).toEqual([]);
    expect(useAdvisorStore.getState().generatedAt).toBeNull();
  });
});
