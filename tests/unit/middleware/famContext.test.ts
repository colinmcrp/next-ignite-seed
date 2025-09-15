import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { establishFamContext, requireFamAdmin, enforceDataIsolation, getUserFamContexts } from '../../../src/middleware/famContext';
import { Role } from '../../../src/models/types';
import { prisma } from '../../../src/lib/prisma';

// Mock Prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    famMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    asset: {
      findUnique: vi.fn()
    },
    account: {
      findUnique: vi.fn()
    },
    plan: {
      findUnique: vi.fn()
    }
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('FamContext Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonSpy: any;
  let statusSpy: any;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const mockFamId = 'clm123456789abcdef';
  const mockMembership = {
    id: 'membership-123',
    userId: 'user-123',
    famId: mockFamId,
    role: Role.MEMBER,
    joinedAt: new Date()
  };

  beforeEach(() => {
    jsonSpy = vi.fn();
    statusSpy = vi.fn().mockReturnValue({ json: jsonSpy });
    
    mockReq = {
      user: mockUser,
      params: {},
      body: {},
      query: {},
      headers: {}
    };
    
    mockRes = {
      status: statusSpy,
      json: jsonSpy
    };
    
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('establishFamContext', () => {
    it('should establish Fam context from params', async () => {
      mockReq.params = { famId: mockFamId };
      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famContext).toEqual({
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should establish Fam context from body', async () => {
      mockReq.body = { famId: mockFamId };
      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famContext).toEqual({
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should establish Fam context from query', async () => {
      mockReq.query = { famId: mockFamId };
      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famContext).toEqual({
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should establish Fam context from headers', async () => {
      mockReq.headers = { 'x-fam-id': mockFamId };
      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famContext).toEqual({
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if famId not provided', async () => {
      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Fam ID is required. Provide it in URL params, request body, query string, or X-Fam-Id header',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid famId format', async () => {
      mockReq.params = { famId: 'invalid' };

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid Fam ID format',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user not a member', async () => {
      mockReq.params = { famId: mockFamId };
      (prisma.famMembership.findUnique as any).mockResolvedValue(null);

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not a member of this Fam',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockReq.params = { famId: mockFamId };
      (prisma.famMembership.findUnique as any).mockRejectedValue(new Error('Database error'));

      await establishFamContext(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to establish Fam context',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireFamAdmin', () => {
    it('should allow admin users', () => {
      mockReq.famContext = {
        famId: mockFamId,
        role: Role.ADMIN,
        membership: { ...mockMembership, role: Role.ADMIN }
      };

      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should deny non-admin users', () => {
      mockReq.famContext = {
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      };

      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin privileges required for this action',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 if Fam context not established', () => {
      mockReq.famContext = undefined;

      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Fam context not established',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('enforceDataIsolation', () => {
    beforeEach(() => {
      mockReq.famContext = {
        famId: mockFamId,
        role: Role.MEMBER,
        membership: mockMembership
      };
    });

    it('should allow access to asset in same Fam', async () => {
      const middleware = enforceDataIsolation('asset');
      mockReq.params = { id: 'asset-123' };
      (prisma.asset.findUnique as any).mockResolvedValue({ famId: mockFamId });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should deny access to asset in different Fam', async () => {
      const middleware = enforceDataIsolation('asset');
      mockReq.params = { id: 'asset-123' };
      (prisma.asset.findUnique as any).mockResolvedValue({ famId: 'different-fam' });

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: This asset belongs to a different Fam',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent resource', async () => {
      const middleware = enforceDataIsolation('account');
      mockReq.params = { id: 'account-123' };
      (prisma.account.findUnique as any).mockResolvedValue(null);

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Account not found',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should skip validation if no resource ID provided', async () => {
      const middleware = enforceDataIsolation('plan');
      mockReq.params = {};

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should return 500 if Fam context not established', async () => {
      const middleware = enforceDataIsolation('asset');
      mockReq.famContext = undefined;
      mockReq.params = { id: 'asset-123' };

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Fam context not established',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getUserFamContexts', () => {
    it('should return user Fam contexts with stats', async () => {
      const mockMemberships = [
        {
          famId: 'fam-1',
          role: Role.ADMIN,
          joinedAt: new Date('2023-01-01'),
          fam: {
            id: 'fam-1',
            name: 'Family 1',
            createdAt: new Date('2023-01-01'),
            _count: {
              members: 3,
              assets: 2,
              accounts: 5,
              plans: 1
            }
          }
        },
        {
          famId: 'fam-2',
          role: Role.MEMBER,
          joinedAt: new Date('2023-02-01'),
          fam: {
            id: 'fam-2',
            name: 'Family 2',
            createdAt: new Date('2023-02-01'),
            _count: {
              members: 2,
              assets: 1,
              accounts: 3,
              plans: 0
            }
          }
        }
      ];

      (prisma.famMembership.findMany as any).mockResolvedValue(mockMemberships);

      const result = await getUserFamContexts('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        famId: 'fam-1',
        famName: 'Family 1',
        role: Role.ADMIN,
        joinedAt: new Date('2023-01-01'),
        isAdmin: true,
        stats: {
          memberCount: 3,
          assetCount: 2,
          accountCount: 5,
          planCount: 1
        }
      });
      expect(result[1]).toEqual({
        famId: 'fam-2',
        famName: 'Family 2',
        role: Role.MEMBER,
        joinedAt: new Date('2023-02-01'),
        isAdmin: false,
        stats: {
          memberCount: 2,
          assetCount: 1,
          accountCount: 3,
          planCount: 0
        }
      });
    });

    it('should return empty array for user with no Fams', async () => {
      (prisma.famMembership.findMany as any).mockResolvedValue([]);

      const result = await getUserFamContexts('user-123');

      expect(result).toEqual([]);
    });
  });
});