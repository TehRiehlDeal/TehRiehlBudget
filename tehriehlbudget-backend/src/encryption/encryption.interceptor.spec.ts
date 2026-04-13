import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { EncryptionInterceptor } from './encryption.interceptor';
import { EncryptionService } from './encryption.service';

describe('EncryptionInterceptor', () => {
  let interceptor: EncryptionInterceptor;
  let encryptionService: EncryptionService;

  const mockEncryptionService = {
    encryptField: jest.fn((val: string | null) =>
      val ? `encrypted_${val}` : null,
    ),
    decryptField: jest.fn((val: string | null) =>
      val ? val.replace('encrypted_', '') : null,
    ),
  };

  beforeEach(() => {
    encryptionService = mockEncryptionService as any;
    interceptor = new EncryptionInterceptor(encryptionService, [
      'accountNumber',
      'notes',
    ]);
    jest.clearAllMocks();
  });

  function createMockContext(body: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ body }),
      }),
    } as ExecutionContext;
  }

  function createMockHandler(response: any): CallHandler {
    return { handle: () => of(response) };
  }

  it('should encrypt specified fields in the request body', (done) => {
    const context = createMockContext({
      name: 'My Account',
      accountNumber: '1234-5678',
      notes: 'secret note',
    });
    const handler = createMockHandler({ id: '1' });

    interceptor.intercept(context, handler).subscribe(() => {
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith('1234-5678');
      expect(mockEncryptionService.encryptField).toHaveBeenCalledWith('secret note');
      done();
    });
  });

  it('should decrypt specified fields in the response', (done) => {
    const context = createMockContext({});
    const handler = createMockHandler({
      id: '1',
      accountNumber: 'encrypted_1234',
      notes: 'encrypted_secret',
    });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.accountNumber).toBe('1234');
      expect(result.notes).toBe('secret');
      done();
    });
  });

  it('should handle null fields gracefully', (done) => {
    const context = createMockContext({ accountNumber: null });
    const handler = createMockHandler({ accountNumber: null, notes: null });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.accountNumber).toBeNull();
      expect(result.notes).toBeNull();
      done();
    });
  });

  it('should decrypt fields in arrays (e.g., findAll responses)', (done) => {
    const context = createMockContext({});
    const handler = createMockHandler([
      { id: '1', accountNumber: 'encrypted_1111' },
      { id: '2', accountNumber: 'encrypted_2222' },
    ]);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result[0].accountNumber).toBe('1111');
      expect(result[1].accountNumber).toBe('2222');
      done();
    });
  });
});
