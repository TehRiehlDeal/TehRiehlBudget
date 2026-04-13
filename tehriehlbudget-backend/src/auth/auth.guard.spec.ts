import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { SupabaseService } from './supabase.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: class MockPrismaClient {
      $connect = jest.fn();
      $disconnect = jest.fn();
    },
  };
});

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let supabaseService: SupabaseService;
  let prismaService: PrismaService;

  const mockSupabaseService = {
    validateToken: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(() => {
    supabaseService = mockSupabaseService as any;
    prismaService = mockPrismaService as any;
    guard = new AuthGuard(supabaseService, prismaService);
    jest.clearAllMocks();
  });

  function createMockContext(authHeader?: string): ExecutionContext {
    const mockRequest = {
      headers: authHeader ? { authorization: authHeader } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  }

  it('should throw UnauthorizedException when no authorization header', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when authorization header has no Bearer prefix', async () => {
    const context = createMockContext('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    mockSupabaseService.validateToken.mockResolvedValue(null);
    const context = createMockContext('Bearer invalid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should return true and attach user to request for valid token', async () => {
    const supabaseUser = { id: 'supabase-123', email: 'test@example.com' };
    const dbUser = { id: 'db-uuid', supabaseId: 'supabase-123', email: 'test@example.com' };

    mockSupabaseService.validateToken.mockResolvedValue(supabaseUser);
    mockPrismaService.user.upsert.mockResolvedValue(dbUser);

    const context = createMockContext('Bearer valid-token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest();
    expect((request as any).user).toEqual(dbUser);
  });
});
