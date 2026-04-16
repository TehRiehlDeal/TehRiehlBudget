// Test stub for virtual:pwa-register/react
import { vi } from 'vitest';

export const useRegisterSW = () => ({
  needRefresh: [false, vi.fn()] as [boolean, (v: boolean) => void],
  offlineReady: [false, vi.fn()] as [boolean, (v: boolean) => void],
  updateServiceWorker: vi.fn(),
});
