import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { authService } from '../../src/services/authService';
import { Role } from '../../src/models/types';

describe('Fam API Integration Tests', () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;
  let famId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    const userResult = await authService.register({
      email: 'user@example.com',
      password: 'password123',
      name: 'Test User'
    });
    userToken = userResult.tokens.accessToken;
    userId = userResult.user.id;

    const adminResult = await authService.register({
      email: 'admin@example.com',
      password: 'password123',
      name: 'Admin User'
    });
    adminToken = adminResult.tokens.accessToken;
    adminUserId = adminResult.user.id;
  });

  afterEach(async () => {
    // Clean up database
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/fams', () => {
    it('should create a new Fam', async () => {
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Family');
      expect(response.body.data.members).toHaveLength(1);
      expect(response.body.data.members[0].role).toBe(Role.ADMIN);
      expect(response.body.data.members[0].userId).toBe(userId);

      famId = response.body.data.id;
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/fams')
        .send({
          name: 'Test Family'
        });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should validate name length', async () => {
      const longName = 'a'.repeat(101);
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: longName
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('100 characters');
    });
  });

  describe('GET /api/fams/user', () => {
    beforeEach(async () => {
      // Create a test Fam
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = response.body.data.id;
    });

    it('should return user\'s Fams', async () => {
      const response = await request(app)
        .get('/api/fams/user')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].fam.name).toBe('Test Family');
      expect(response.body.data[0].membership.role).toBe(Role.ADMIN);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/fams/user');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/fams/:famId', () => {
    beforeEach(async () => {
      // Create a test Fam
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = response.body.data.id;
    });

    it('should return Fam details for member', async () => {
      const response = await request(app)
        .get(`/api/fams/${famId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Family');
      expect(response.body.data.members).toHaveLength(1);
    });

    it('should deny access to non-members', async () => {
      const response = await request(app)
        .get(`/api/fams/${famId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 404 for non-existent Fam', async () => {
      const response = await request(app)
        .get('/api/fams/non-existent-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/fams/:famId', () => {
    beforeEach(async () => {
      // Create a test Fam
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = response.body.data.id;
    });

    it('should update Fam for admin', async () => {
      const response = await request(app)
        .put(`/api/fams/${famId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Updated Family'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Family');
    });

    it('should deny access to non-admins', async () => {
      // First add admin as a member
      const inviteResponse = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'admin@example.com'
        });

      const joinResponse = await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken: inviteResponse.body.data.token
        });

      expect(joinResponse.status).toBe(201);

      // Now try to update as non-admin member
      const response = await request(app)
        .put(`/api/fams/${famId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Family'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin privileges required');
    });
  });

  describe('POST /api/fams/:famId/invitations', () => {
    beforeEach(async () => {
      // Create a test Fam
      const response = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = response.body.data.id;
    });

    it('should create invitation for admin', async () => {
      const response = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'invitee@example.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.inviteeEmail).toBe('invitee@example.com');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'invalid-email'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid email address');
    });

    it('should prevent inviting existing members', async () => {
      const response = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'user@example.com' // Creator's email
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already a member');
    });
  });

  describe('POST /api/fams/join', () => {
    let invitationToken: string;

    beforeEach(async () => {
      // Create a test Fam
      const famResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = famResponse.body.data.id;

      // Create invitation
      const inviteResponse = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'admin@example.com'
        });
      invitationToken = inviteResponse.body.data.token;
    });

    it('should allow user to join Fam with valid invitation', async () => {
      const response = await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe(Role.MEMBER);
      expect(response.body.data.userId).toBe(adminUserId);
      expect(response.body.data.famId).toBe(famId);
    });

    it('should reject invalid invitation token', async () => {
      const response = await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken: 'invalid-token'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid invitation token');
    });

    it('should prevent joining twice', async () => {
      // Join once
      await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken
        });

      // Try to join again with same token
      const response = await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already been used');
    });
  });

  describe('DELETE /api/fams/:famId/members/:memberId', () => {
    let memberUserId: string;

    beforeEach(async () => {
      // Create a test Fam
      const famResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = famResponse.body.data.id;

      // Add admin as member
      const inviteResponse = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'admin@example.com'
        });

      await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken: inviteResponse.body.data.token
        });

      memberUserId = adminUserId;
    });

    it('should allow admin to remove member', async () => {
      const response = await request(app)
        .delete(`/api/fams/${famId}/members/${memberUserId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed successfully');
    });

    it('should deny access to non-admins', async () => {
      const response = await request(app)
        .delete(`/api/fams/${famId}/members/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin privileges required');
    });
  });

  describe('PUT /api/fams/:famId/members/:memberId/role', () => {
    let memberUserId: string;

    beforeEach(async () => {
      // Create a test Fam
      const famResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Family'
        });
      famId = famResponse.body.data.id;

      // Add admin as member
      const inviteResponse = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          inviteeEmail: 'admin@example.com'
        });

      await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invitationToken: inviteResponse.body.data.token
        });

      memberUserId = adminUserId;
    });

    it('should allow admin to update member role', async () => {
      const response = await request(app)
        .put(`/api/fams/${famId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          role: Role.ADMIN
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe(Role.ADMIN);
    });

    it('should validate role values', async () => {
      const response = await request(app)
        .put(`/api/fams/${famId}/members/${memberUserId}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          role: 'INVALID_ROLE'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Valid role is required');
    });

    it('should deny access to non-admins', async () => {
      const response = await request(app)
        .put(`/api/fams/${famId}/members/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: Role.MEMBER
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin privileges required');
    });
  });
});