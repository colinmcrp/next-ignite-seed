import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock Prisma for integration tests
vi.mock('../../src/lib/prisma', () => ({
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

describe('Authentication API Integration Tests', () => {
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      // Mock user creation
      (prisma.user.create as any).mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        message: 'User registered successfully',
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          // missing password and name
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Email, password, and name are required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid email format');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Password must be at least 8 characters long');
    });

    it('should return 409 if user already exists', async () => {
      // Mock user exists
      (prisma.user.findUnique as any).mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully with valid credentials', async () => {
      // Mock user exists with hashed password
      const hashedPassword = await bcrypt.hash('password123', 12);
      const userWithHashedPassword = { ...testUser, password: hashedPassword };
      
      (prisma.user.findUnique as any).mockResolvedValue(userWithHashedPassword);
      (prisma.famMembership.findMany as any).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Login successful',
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
        fams: expect.any(Array),
      });
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Email and password are required');
    });

    it('should return 401 for non-existent user', async () => {
      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    it('should return 401 for wrong password', async () => {
      // Mock user exists with different password
      const hashedPassword = await bcrypt.hash('differentpassword', 12);
      const userWithHashedPassword = { ...testUser, password: hashedPassword };
      
      (prisma.user.findUnique as any).mockResolvedValue(userWithHashedPassword);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Refresh token is required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
      expect(response.body.error.message).toBe('Invalid or expired refresh token');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return 401 for missing authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Access token required');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Invalid or expired access token');
    });
  });

  describe('API Routes Discovery', () => {
    it('should return available auth routes', async () => {
      const response = await request(app)
        .get('/api');

      expect(response.status).toBe(200);
      expect(response.body.availableRoutes).toContain('POST /api/auth/register - User registration');
      expect(response.body.availableRoutes).toContain('POST /api/auth/login - User login');
      expect(response.body.availableRoutes).toContain('POST /api/auth/refresh - Refresh access token');
      expect(response.body.availableRoutes).toContain('GET /api/auth/profile - Get user profile (protected)');
    });
  });
});