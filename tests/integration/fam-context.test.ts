import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { authService } from '../../src/services/authService';
import { Role } from '../../src/models/types';

describe('Fam Context API Integration Tests', () => {
  let userToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;
  let fam1Id: string;
  let fam2Id: string;

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

    // Create test Fams
    const fam1Response = await request(app)
      .post('/api/fams')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Family 1' });
    fam1Id = fam1Response.body.data.id;

    const fam2Response = await request(app)
      .post('/api/fams')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Family 2' });
    fam2Id = fam2Response.body.data.id;

    // Add user to fam2 as member
    const inviteResponse = await request(app)
      .post(`/api/fams/${fam2Id}/invitations`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ inviteeEmail: 'user@example.com' });

    await request(app)
      .post('/api/fams/join')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ invitationToken: inviteResponse.body.data.token });
  });

  afterEach(async () => {
    // Clean up database
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('GET /api/fams/contexts', () => {
    it('should return user\'s Fam contexts with stats', async () => {
      const response = await request(app)
        .get('/api/fams/contexts')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contexts).toHaveLength(2);
      expect(response.body.data.totalFams).toBe(2);
      expect(response.body.data.adminFams).toBe(1);

      // Check that admin Fam comes first
      expect(response.body.data.contexts[0].isAdmin).toBe(true);
      expect(response.body.data.contexts[0].famName).toBe('Family 1');
      expect(response.body.data.contexts[1].isAdmin).toBe(false);
      expect(response.body.data.contexts[1].famName).toBe('Family 2');

      // Check stats structure
      expect(response.body.data.contexts[0].stats).toEqual({
        memberCount: 1,
        assetCount: 0,
        accountCount: 0,
        planCount: 0
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/fams/contexts');

      expect(response.status).toBe(401);
    });

    it('should return empty contexts for user with no Fams', async () => {
      // Create a new user with no Fam memberships
      const newUserResult = await authService.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      });

      const response = await request(app)
        .get('/api/fams/contexts')
        .set('Authorization', `Bearer ${newUserResult.tokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.contexts).toHaveLength(0);
      expect(response.body.data.totalFams).toBe(0);
      expect(response.body.data.adminFams).toBe(0);
    });
  });

  describe('POST /api/fams/switch', () => {
    it('should switch to valid Fam context', async () => {
      const response = await request(app)
        .post('/api/fams/switch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ famId: fam1Id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.famId).toBe(fam1Id);
      expect(response.body.data.famName).toBe('Family 1');
      expect(response.body.data.role).toBe(Role.ADMIN);
      expect(response.body.data.message).toContain('Successfully switched to Fam: Family 1');
    });

    it('should switch to member Fam context', async () => {
      const response = await request(app)
        .post('/api/fams/switch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ famId: fam2Id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.famId).toBe(fam2Id);
      expect(response.body.data.famName).toBe('Family 2');
      expect(response.body.data.role).toBe(Role.MEMBER);
    });

    it('should require famId', async () => {
      const response = await request(app)
        .post('/api/fams/switch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Fam ID is required');
    });

    it('should deny access to non-member Fam', async () => {
      // Create a Fam that user is not a member of
      const otherUserResult = await authService.register({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User'
      });

      const otherFamResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${otherUserResult.tokens.accessToken}`)
        .send({ name: 'Other Family' });

      const response = await request(app)
        .post('/api/fams/switch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ famId: otherFamResponse.body.data.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/fams/switch')
        .send({ famId: fam1Id });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/fams/current', () => {
    it('should return current Fam context from header', async () => {
      const response = await request(app)
        .get('/api/fams/current')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Fam-Id', fam1Id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.famId).toBe(fam1Id);
      expect(response.body.data.famName).toBe('Family 1');
      expect(response.body.data.role).toBe(Role.ADMIN);
      expect(response.body.data.memberCount).toBe(1);
      expect(response.body.data.assetCount).toBe(0);
      expect(response.body.data.accountCount).toBe(0);
      expect(response.body.data.planCount).toBe(0);
    });

    it('should return current Fam context from query parameter', async () => {
      const response = await request(app)
        .get(`/api/fams/current?famId=${fam2Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.famId).toBe(fam2Id);
      expect(response.body.data.famName).toBe('Family 2');
      expect(response.body.data.role).toBe(Role.MEMBER);
    });

    it('should require famId', async () => {
      const response = await request(app)
        .get('/api/fams/current')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Fam ID is required');
    });

    it('should deny access to non-member Fam', async () => {
      // Create a Fam that user is not a member of
      const otherUserResult = await authService.register({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User'
      });

      const otherFamResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${otherUserResult.tokens.accessToken}`)
        .send({ name: 'Other Family' });

      const response = await request(app)
        .get('/api/fams/current')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Fam-Id', otherFamResponse.body.data.id);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/fams/current')
        .set('X-Fam-Id', fam1Id);

      expect(response.status).toBe(401);
    });
  });

  describe('Data Isolation', () => {
    it('should prevent cross-Fam data access', async () => {
      // This test would be more comprehensive with actual assets/accounts/plans
      // For now, we test the basic Fam access control
      
      // User should be able to access fam1 details
      const fam1Response = await request(app)
        .get(`/api/fams/${fam1Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(fam1Response.status).toBe(200);
      expect(fam1Response.body.data.name).toBe('Family 1');

      // User should be able to access fam2 details (as member)
      const fam2Response = await request(app)
        .get(`/api/fams/${fam2Id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(fam2Response.status).toBe(200);
      expect(fam2Response.body.data.name).toBe('Family 2');

      // Admin should not be able to access fam1 (not a member)
      const deniedResponse = await request(app)
        .get(`/api/fams/${fam1Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deniedResponse.status).toBe(403);
      expect(deniedResponse.body.error).toContain('Access denied');
    });
  });
});