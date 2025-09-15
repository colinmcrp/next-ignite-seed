import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { authService } from '../../src/services/authService';
import { prisma } from '../../src/lib/prisma';
import bcrypt from 'bcryptjs';

// Mock Prisma for security tests
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    famMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('Authentication Security Tests', () => {
  const testUser = {
    id: 'user-123',
    email: 'security@example.com',
    name: 'Security Test User',
    password: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('JWT Token Security', () => {
    it('should generate valid JWT tokens that can be verified', async () => {
      // Hash a test password
      const hashedPassword = await bcrypt.hash('securepassword123', 12);
      const userWithHashedPassword = { ...testUser, password: hashedPassword };
      
      // Mock user creation for registration
      (prisma.user.findUnique as any).mockResolvedValueOnce(null); // User doesn't exist
      (prisma.user.create as any).mockResolvedValue(userWithHashedPassword);

      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password: 'securepassword123',
          name: 'Security Test User',
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.tokens.accessToken).toBeDefined();
      expect(registerResponse.body.tokens.refreshToken).toBeDefined();

      const { accessToken } = registerResponse.body.tokens;

      // Mock user lookup for profile endpoint
      (prisma.user.findUnique as any).mockResolvedValue(userWithHashedPassword);
      (prisma.famMembership.findMany as any).mockResolvedValue([]);

      // Use the access token to access protected endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.user.email).toBe('security@example.com');
    });

    it('should reject tampered JWT tokens', async () => {
      // Create a valid token first
      const hashedPassword = await bcrypt.hash('securepassword123', 12);
      const userWithHashedPassword = { ...testUser, password: hashedPassword };
      
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);
      (prisma.user.create as any).mockResolvedValue(userWithHashedPassword);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password: 'securepassword123',
          name: 'Security Test User',
        });

      let { accessToken } = registerResponse.body.tokens;
      
      // Tamper with the token by changing the last character
      accessToken = accessToken.slice(0, -1) + 'X';

      // Try to use tampered token
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(401);
      expect(profileResponse.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle token refresh correctly', async () => {
      const hashedPassword = await bcrypt.hash('securepassword123', 12);
      const userWithHashedPassword = { ...testUser, password: hashedPassword };
      
      (prisma.user.findUnique as any).mockResolvedValueOnce(null);
      (prisma.user.create as any).mockResolvedValue(userWithHashedPassword);

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password: 'securepassword123',
          name: 'Security Test User',
        });

      const { refreshToken } = registerResponse.body.tokens;

      // Mock user lookup for refresh
      (prisma.user.findUnique as any).mockResolvedValue(userWithHashedPassword);

      // Use refresh token to get new tokens
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.tokens.accessToken).toBeDefined();
      expect(refreshResponse.body.tokens.refreshToken).toBeDefined();
      
      // New tokens should be different from original
      expect(refreshResponse.body.tokens.accessToken).not.toBe(registerResponse.body.tokens.accessToken);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'testpassword123';
      
      // Mock user doesn't exist
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      // Capture the hashed password when user is created
      let capturedHashedPassword = '';
      (prisma.user.create as any).mockImplementation((data) => {
        capturedHashedPassword = data.data.password;
        return Promise.resolve({ ...testUser, password: capturedHashedPassword });
      });

      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password,
          name: 'Security Test User',
        });

      // Password should be hashed (not plain text)
      expect(capturedHashedPassword).not.toBe(password);
      expect(capturedHashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are long
      expect(capturedHashedPassword.startsWith('$2b$')).toBe(true); // bcrypt format
    });

    it('should enforce minimum password length', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'security@example.com',
          password: '123', // Too short
          name: 'Security Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Password must be at least 8 characters long');
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securepassword123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Invalid email format');
    });

    it('should sanitize email input', async () => {
      const hashedPassword = await bcrypt.hash('securepassword123', 12);
      
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      let capturedEmail = '';
      (prisma.user.create as any).mockImplementation((data) => {
        capturedEmail = data.data.email;
        return Promise.resolve({ ...testUser, email: capturedEmail, password: hashedPassword });
      });

      await request(app)
        .post('/api/auth/register')
        .send({
          email: '  TEST@EXAMPLE.COM  ', // With spaces and uppercase
          password: 'securepassword123',
          name: 'Test User',
        });

      // Email should be trimmed and lowercased
      expect(capturedEmail).toBe('test@example.com');
    });

    it('should sanitize name input', async () => {
      const hashedPassword = await bcrypt.hash('securepassword123', 12);
      
      (prisma.user.findUnique as any).mockResolvedValue(null);
      
      let capturedName = '';
      (prisma.user.create as any).mockImplementation((data) => {
        capturedName = data.data.name;
        return Promise.resolve({ ...testUser, name: capturedName, password: hashedPassword });
      });

      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'securepassword123',
          name: '  Test User  ', // With spaces
        });

      // Name should be trimmed
      expect(capturedName).toBe('Test User');
    });
  });

  describe('Rate Limiting and Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health');

      // Check for security headers (added by helmet middleware)
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});