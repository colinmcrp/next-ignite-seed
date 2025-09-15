import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate, authorizeFam, requireFamAdmin, authorizePersonalAccount } from '../../../src/middleware/auth';
import { authService } from '../../../src/services/authService';
import { prisma } from '../../../src/lib/prisma';

// Mock dependencies
vi.mock('../../../src/services/authService');
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    famMembership: {
      findUnique: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      body: {},
      query: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockReq.headers = {
        authorization: 'Bearer valid-token',
      };

      (authService.verifyAccessToken as any).mockResolvedValue(mockUser);

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is malformed', async () => {
      mockReq.headers = {
        authorization: 'InvalidFormat token',
      };

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-token',
      };

      (authService.verifyAccessToken as any).mockRejectedValue(new Error('Invalid token'));

      await authenticate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired access token',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizeFam', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
    });

    it('should authorize user for Fam from params', async () => {
      mockReq.params = { famId: 'fam-123' };
      
      const mockMembership = {
        userId: 'user-123',
        famId: 'fam-123',
        role: 'ADMIN',
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await authorizeFam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famId).toBe('fam-123');
      expect(mockReq.famRole).toBe('ADMIN');
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should authorize user for Fam from body', async () => {
      mockReq.body = { famId: 'fam-123' };
      
      const mockMembership = {
        userId: 'user-123',
        famId: 'fam-123',
        role: 'MEMBER',
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await authorizeFam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.famId).toBe('fam-123');
      expect(mockReq.famRole).toBe('MEMBER');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await authorizeFam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if famId not provided', async () => {
      await authorizeFam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Fam ID required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user not member of Fam', async () => {
      mockReq.params = { famId: 'fam-123' };

      (prisma.famMembership.findUnique as any).mockResolvedValue(null);

      await authorizeFam(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this Fam',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireFamAdmin', () => {
    it('should allow access for admin role', () => {
      mockReq.famRole = 'ADMIN';

      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny access for member role', () => {
      mockReq.famRole = 'MEMBER';

      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin role required for this action',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access if no role set', () => {
      requireFamAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizePersonalAccount', () => {
    beforeEach(() => {
      mockReq.user = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
    });

    it('should authorize access to personal account', async () => {
      mockReq.params = { accountId: 'account-123' };
      
      const mockAccount = {
        id: 'account-123',
        userId: 'user-123',
      };

      (prisma.account.findFirst as any).mockResolvedValue(mockAccount);

      await authorizePersonalAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 if user not authenticated', async () => {
      mockReq.user = undefined;

      await authorizePersonalAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 if accountId not provided', async () => {
      await authorizePersonalAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'BAD_REQUEST',
          message: 'Account ID required',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if account does not belong to user', async () => {
      mockReq.params = { accountId: 'account-123' };

      (prisma.account.findFirst as any).mockResolvedValue(null);

      await authorizePersonalAccount(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this account',
          timestamp: expect.any(String),
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});