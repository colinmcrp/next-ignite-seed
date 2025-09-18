import { beforeEach, describe, expect, it, vi } from 'vitest';

const getHashMock = () => (globalThis as any).__supabaseHashMock as ReturnType<typeof vi.fn>;

vi.mock('bcryptjs', () => {
  const hashMock = vi.fn();
  (globalThis as any).__supabaseHashMock = hashMock;
  return {
    default: {
      hash: (...args: unknown[]) => hashMock(...(args as [])),
    },
    hash: (...args: unknown[]) => hashMock(...(args as [])),
  };
});

type PrismaMock = {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const getPrismaMock = () => (globalThis as any).__supabasePrismaMock as PrismaMock;

vi.mock('../../../src/lib/prisma', () => {
  const prismaMock: PrismaMock = {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  (globalThis as any).__supabasePrismaMock = prismaMock;

  return {
    prisma: prismaMock,
  };
});

type SupabaseLibMocks = {
  getSupabaseAdminClient: ReturnType<typeof vi.fn>;
  isSupabaseConfigured: ReturnType<typeof vi.fn>;
};

const getSupabaseMocks = () =>
  (globalThis as any).__supabaseLibMocks as SupabaseLibMocks;

vi.mock('../../../src/lib/supabase', () => {
  const mocks: SupabaseLibMocks = {
    getSupabaseAdminClient: vi.fn(),
    isSupabaseConfigured: vi.fn(),
  };

  (globalThis as any).__supabaseLibMocks = mocks;

  return mocks;
});

import { authService } from '../../../src/services/authService';
import {
  supabaseAuthService,
  SupabaseAuthError,
} from '../../../src/services/supabaseAuthService';

const issueTokensSpy = vi.spyOn(authService, 'issueTokensForUser');

let prismaMock: PrismaMock;
let supabaseMocks: SupabaseLibMocks;

const createSupabaseUser = () => ({
  id: 'supabase-user-id',
  email: 'User@Example.com',
  user_metadata: {
    full_name: 'Example User',
  },
});

describe('SupabaseAuthService', () => {
  beforeEach(() => {
    process.env.SUPABASE_AUTH_ENABLED = 'true';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    const hashMock = getHashMock();
    hashMock.mockReset();
    hashMock.mockResolvedValue('hashed-password');
    prismaMock = getPrismaMock();
    Object.values(prismaMock.user).forEach((fn) => (fn as any).mockReset());
    supabaseMocks = getSupabaseMocks();
    supabaseMocks.getSupabaseAdminClient.mockReset();
    supabaseMocks.isSupabaseConfigured.mockReset();
    supabaseMocks.isSupabaseConfigured.mockReturnValue(true);
    issueTokensSpy.mockClear();
    issueTokensSpy.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('reports disabled status when integration is off', () => {
    process.env.SUPABASE_AUTH_ENABLED = 'false';
    const status = supabaseAuthService.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.configured).toBe(false);
    expect(status.projectUrl).toBeNull();
  });

  it('throws when integration is disabled', async () => {
    process.env.SUPABASE_AUTH_ENABLED = 'false';

    await expect(
      supabaseAuthService.exchangeSupabaseToken('token')
    ).rejects.toMatchObject({
      code: 'SUPABASE_DISABLED',
    });
  });

  it('throws when Supabase client is not configured', async () => {
    supabaseMocks.getSupabaseAdminClient.mockReturnValue(null);

    await expect(
      supabaseAuthService.exchangeSupabaseToken('token')
    ).rejects.toMatchObject({
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  });

  it('creates a local user from Supabase token', async () => {
    const supabaseUser = createSupabaseUser();

    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: supabaseUser },
          error: null,
        }),
      },
    });

    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'local-user-id',
      email: 'user@example.com',
      name: 'Example User',
      supabaseId: supabaseUser.id,
    });

    const result = await supabaseAuthService.exchangeSupabaseToken('token');

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'user@example.com',
          supabaseId: supabaseUser.id,
        }),
      })
    );
    expect(result.user.email).toBe('user@example.com');
    expect(result.supabaseUserId).toBe(supabaseUser.id);
    expect(authService.issueTokensForUser).toHaveBeenCalledWith({
      id: 'local-user-id',
      email: 'user@example.com',
      name: 'Example User',
    });
  });

  it('updates existing user metadata when Supabase data changes', async () => {
    const supabaseUser = createSupabaseUser();

    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: supabaseUser },
          error: null,
        }),
      },
    });

    prismaMock.user.findFirst.mockResolvedValue({
      id: 'local-user-id',
      email: 'user@example.com',
      name: 'Old Name',
      supabaseId: null,
    });

    prismaMock.user.update.mockResolvedValue({
      id: 'local-user-id',
      email: 'user@example.com',
      name: 'Example User',
      supabaseId: supabaseUser.id,
    });

    const result = await supabaseAuthService.exchangeSupabaseToken('token');

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'local-user-id' },
      data: {
        name: 'Example User',
        supabaseId: supabaseUser.id,
      },
    });
    expect(result.user.name).toBe('Example User');
  });

  it('wraps synchronisation errors', async () => {
    const supabaseUser = createSupabaseUser();

    supabaseMocks.getSupabaseAdminClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: supabaseUser },
          error: null,
        }),
      },
    });

    prismaMock.user.findFirst.mockRejectedValue(new Error('db unavailable'));

    await expect(
      supabaseAuthService.exchangeSupabaseToken('token')
    ).rejects.toBeInstanceOf(SupabaseAuthError);
  });
});
