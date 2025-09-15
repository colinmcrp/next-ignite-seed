import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../../src/services/authService';
import { prisma } from '../../../src/lib/prisma';

// Mock Prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    famMembership: {
      findMany: vi.fn(),
    },
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      // Mock password hashing
      (bcrypt.hash as any).mockResolvedValue('hashedpassword');
      
      // Mock user creation
      (prisma.user.create as any).mockResolvedValue(mockUser);
      
      // Mock JWT generation
      (jwt.sign as any)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(registerData);

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: 'hashedpassword',
          name: 'Test User',
        },
      });
    });

    it('should throw error if user already exists', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      await expect(authService.register(registerData)).rejects.toThrow(
        'User already exists with this email'
      );
    });
  });

  describe('login', () => {
    it('should login user successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      
      // Mock password comparison
      (bcrypt.compare as any).mockResolvedValue(true);
      
      // Mock JWT generation
      (jwt.sign as any)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login(loginData);

      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
    });

    it('should throw error if user not found', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });

    it('should throw error if password is invalid', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      
      // Mock password comparison fails
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully with valid refresh token', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { userId: 'user-123' };

      // Mock JWT verification
      (jwt.verify as any).mockReturnValue(decodedToken);
      
      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      
      // Mock JWT generation
      (jwt.sign as any)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshToken(refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error if refresh token is invalid', async () => {
      const refreshToken = 'invalid-refresh-token';

      // Mock JWT verification fails
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw error if user no longer exists', async () => {
      const refreshToken = 'valid-refresh-token';
      const decodedToken = { userId: 'user-123' };

      // Mock JWT verification
      (jwt.verify as any).mockReturnValue(decodedToken);
      
      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(authService.refreshToken(refreshToken)).rejects.toThrow(
        'Invalid refresh token'
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', async () => {
      const accessToken = 'valid-access-token';
      const decodedToken = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      // Mock JWT verification
      (jwt.verify as any).mockReturnValue(decodedToken);
      
      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const result = await authService.verifyAccessToken(accessToken);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('should throw error if access token is invalid', async () => {
      const accessToken = 'invalid-access-token';

      // Mock JWT verification fails
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.verifyAccessToken(accessToken)).rejects.toThrow(
        'Invalid access token'
      );
    });
  });

  describe('getUserFams', () => {
    it('should return user fams successfully', async () => {
      const userId = 'user-123';
      const mockMemberships = [
        {
          famId: 'fam-1',
          role: 'ADMIN',
          fam: { id: 'fam-1', name: 'Family 1' },
        },
        {
          famId: 'fam-2',
          role: 'MEMBER',
          fam: { id: 'fam-2', name: 'Family 2' },
        },
      ];

      (prisma.famMembership.findMany as any).mockResolvedValue(mockMemberships);

      const result = await authService.getUserFams(userId);

      expect(result).toEqual([
        { famId: 'fam-1', role: 'ADMIN', famName: 'Family 1' },
        { famId: 'fam-2', role: 'MEMBER', famName: 'Family 2' },
      ]);
    });
  });
});