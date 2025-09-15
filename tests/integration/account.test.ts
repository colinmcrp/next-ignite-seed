import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { AccountType } from '../../src/models/types';

describe('Account Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let famId: string;
  let assetId: string;
  let accountId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.document.deleteMany();
    await prisma.account.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.data.token;
    userId = registerResponse.body.data.user.id;

    // Create test Fam
    const famResponse = await request(app)
      .post('/api/fams')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Family'
      });

    expect(famResponse.status).toBe(201);
    famId = famResponse.body.data.id;

    // Create test Asset
    const assetResponse = await request(app)
      .post(`/api/fams/${famId}/assets`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'HOME',
        name: 'Family Home',
        description: 'Our main residence'
      });

    expect(assetResponse.status).toBe(201);
    assetId = assetResponse.body.data.id;
  });

  afterEach(async () => {
    // Clean up database
    await prisma.document.deleteMany();
    await prisma.account.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/accounts', () => {
    it('should create a household account successfully', async () => {
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        accountNumber: 'CT123456',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 150.00
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        accountNumber: 'CT123456'
      });
      expect(response.body.data.accountHolder).toMatchObject({
        id: userId,
        name: 'Test User',
        email: 'test@example.com'
      });
      expect(response.body.data.asset).toMatchObject({
        id: assetId,
        name: 'Family Home',
        type: 'HOME'
      });

      accountId = response.body.data.id;
    });

    it('should create a personal account successfully', async () => {
      const accountData = {
        famId,
        accountHolderId: userId,
        userId,
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company',
        amount: 50.00
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        famId,
        accountHolderId: userId,
        userId,
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company'
      });
      expect(response.body.data.assetId).toBeNull();
    });

    it('should return 400 for invalid account data', async () => {
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: '', // Invalid name
        provider: 'Local Council'
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 401 without authentication', async () => {
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council'
      };

      const response = await request(app)
        .post('/api/accounts')
        .send(accountData);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('GET /api/accounts/:accountId', () => {
    beforeEach(async () => {
      // Create a test account
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        accountNumber: 'CT123456',
        amount: 150.00
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      accountId = response.body.data.id;
    });

    it('should get account by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: accountId,
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        accountNumber: 'CT123456'
      });
    });

    it('should return 404 for non-existent account', async () => {
      const response = await request(app)
        .get('/api/accounts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Account not found');
    });
  });

  describe('GET /api/accounts/fam/:famId', () => {
    beforeEach(async () => {
      // Create multiple test accounts
      const householdAccount = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        amount: 150.00
      };

      const personalAccount = {
        famId,
        accountHolderId: userId,
        userId,
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company',
        amount: 50.00
      };

      await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(householdAccount);

      await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(personalAccount);
    });

    it('should get all accounts for Fam', async () => {
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('accountHolder');
      expect(response.body.data[1]).toHaveProperty('accountHolder');
    });

    it('should filter accounts by type', async () => {
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}?accountType=${AccountType.COUNCIL_TAX}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe(AccountType.COUNCIL_TAX);
    });

    it('should exclude personal accounts when requested', async () => {
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}?includePersonal=false`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].userId).toBeNull();
    });
  });

  describe('PUT /api/accounts/:accountId', () => {
    beforeEach(async () => {
      // Create a test account
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        amount: 150.00
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      accountId = response.body.data.id;
    });

    it('should update account successfully', async () => {
      const updateData = {
        name: 'Updated Council Tax',
        amount: 175.00
      };

      const response = await request(app)
        .put(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Council Tax');
      expect(parseFloat(response.body.data.amount)).toBe(175.00);
    });

    it('should return 400 for invalid update data', async () => {
      const updateData = {
        name: '' // Invalid name
      };

      const response = await request(app)
        .put(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Account name must be at least 2 characters long');
    });
  });

  describe('DELETE /api/accounts/:accountId', () => {
    beforeEach(async () => {
      // Create a test account
      const accountData = {
        famId,
        accountHolderId: userId,
        assetId,
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax Account',
        provider: 'Local Council',
        amount: 150.00
      };

      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(accountData);

      accountId = response.body.data.id;
    });

    it('should delete account successfully', async () => {
      const response = await request(app)
        .delete(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify account is deleted
      const getResponse = await request(app)
        .get(`/api/accounts/${accountId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET /api/accounts/uk-types', () => {
    it('should get UK account types', async () => {
      const response = await request(app)
        .get('/api/accounts/uk-types')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty(AccountType.COUNCIL_TAX);
      expect(response.body.data).toHaveProperty(AccountType.HOME_INSURANCE);
      expect(response.body.data).toHaveProperty(AccountType.ENERGY_BILL);
      expect(response.body.data).toHaveProperty(AccountType.LIFE_INSURANCE);
      expect(response.body.data).toHaveProperty(AccountType.MOBILE_CONTRACT);
      expect(response.body.data).toHaveProperty(AccountType.WILL_TESTAMENT);
    });
  });

  describe('GET /api/accounts/uk-types/:accountType', () => {
    it('should get specific account type info', async () => {
      const response = await request(app)
        .get(`/api/accounts/uk-types/${AccountType.COUNCIL_TAX}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        name: 'Council Tax',
        description: 'Local authority council tax payments',
        category: 'household',
        requiredFields: ['provider', 'accountNumber'],
        optionalFields: ['dueDate', 'amount']
      });
    });

    it('should return 400 for invalid account type', async () => {
      const response = await request(app)
        .get('/api/accounts/uk-types/INVALID_TYPE')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid account type');
    });
  });

  describe('GET /api/accounts/uk-types/category/:category', () => {
    it('should get account types by category', async () => {
      const response = await request(app)
        .get('/api/accounts/uk-types/category/household')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toContain(AccountType.COUNCIL_TAX);
      expect(response.body.data).toContain(AccountType.HOME_INSURANCE);
      expect(response.body.data).toContain(AccountType.ENERGY_BILL);
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .get('/api/accounts/uk-types/category/invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid category. Must be household, personal, or custom');
    });
  });

  describe('GET /api/accounts/fam/:famId/search', () => {
    beforeEach(async () => {
      // Create test accounts for search
      const accounts = [
        {
          famId,
          accountHolderId: userId,
          assetId,
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax Account',
          provider: 'Local Council',
          accountNumber: 'CT123456'
        },
        {
          famId,
          accountHolderId: userId,
          assetId,
          type: AccountType.ENERGY_BILL,
          name: 'Energy Bill',
          provider: 'British Gas',
          accountNumber: 'BG789012'
        }
      ];

      for (const account of accounts) {
        await request(app)
          .post('/api/accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(account);
      }
    });

    it('should search accounts successfully', async () => {
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/search?q=council`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Council Tax Account');
    });

    it('should return 400 for missing search query', async () => {
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/search`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Search query is required');
    });
  });

  describe('Personal Account Management', () => {
    let personalAccountId: string;
    let otherUserId: string;
    let otherAuthToken: string;

    beforeEach(async () => {
      // Create another user for testing access controls
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      expect(otherUserResponse.status).toBe(201);
      otherUserId = otherUserResponse.body.data.user.id;
      otherAuthToken = otherUserResponse.body.data.token;

      // Create invitation for other user
      const invitationResponse = await request(app)
        .post(`/api/fams/${famId}/invitations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          inviteeEmail: 'other@example.com'
        });

      expect(invitationResponse.status).toBe(201);
      const invitationToken = invitationResponse.body.data.token;

      // Other user joins the Fam
      await request(app)
        .post('/api/fams/join')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send({
          invitationToken
        });
    });

    describe('POST /api/accounts/personal', () => {
      it('should create personal account successfully', async () => {
        const personalAccountData = {
          famId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company',
          amount: 50.00
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          famId,
          accountHolderId: userId,
          userId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company'
        });
        expect(response.body.data.assetId).toBeNull();

        personalAccountId = response.body.data.id;
      });

      it('should return 400 for invalid personal account type', async () => {
        const personalAccountData = {
          famId,
          type: AccountType.COUNCIL_TAX, // Not a personal account type
          name: 'Council Tax',
          provider: 'Local Council'
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not valid for personal accounts');
      });

      it('should allow custom account type for personal accounts', async () => {
        const personalAccountData = {
          famId,
          type: AccountType.CUSTOM,
          name: 'Custom Personal Account',
          provider: 'Custom Provider'
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.type).toBe(AccountType.CUSTOM);
      });
    });

    describe('PUT /api/accounts/personal/:accountId', () => {
      beforeEach(async () => {
        // Create a personal account for testing
        const personalAccountData = {
          famId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company',
          amount: 50.00
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        personalAccountId = response.body.data.id;
      });

      it('should update personal account successfully', async () => {
        const updateData = {
          name: 'Updated Life Insurance',
          amount: 75.00
        };

        const response = await request(app)
          .put(`/api/accounts/personal/${personalAccountId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Life Insurance');
        expect(parseFloat(response.body.data.amount)).toBe(75.00);
      });

      it('should return 403 when other user tries to update personal account', async () => {
        const updateData = {
          name: 'Unauthorized Update'
        };

        const response = await request(app)
          .put(`/api/accounts/personal/${personalAccountId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`)
          .send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('access denied');
      });

      it('should return 403 when trying to update shared account as personal', async () => {
        // Create a shared account first
        const sharedAccountData = {
          famId,
          accountHolderId: userId,
          assetId,
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax Account',
          provider: 'Local Council'
        };

        const sharedResponse = await request(app)
          .post('/api/accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(sharedAccountData);

        const sharedAccountId = sharedResponse.body.data.id;

        const updateData = {
          name: 'Unauthorized Update'
        };

        const response = await request(app)
          .put(`/api/accounts/personal/${sharedAccountId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('not a personal account');
      });
    });

    describe('DELETE /api/accounts/personal/:accountId', () => {
      beforeEach(async () => {
        // Create a personal account for testing
        const personalAccountData = {
          famId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company'
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        personalAccountId = response.body.data.id;
      });

      it('should delete personal account successfully', async () => {
        const response = await request(app)
          .delete(`/api/accounts/personal/${personalAccountId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Personal account deleted successfully');

        // Verify account is deleted
        const getResponse = await request(app)
          .get(`/api/accounts/${personalAccountId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(getResponse.status).toBe(404);
      });

      it('should return 403 when other user tries to delete personal account', async () => {
        const response = await request(app)
          .delete(`/api/accounts/personal/${personalAccountId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('access denied');
      });
    });

    describe('GET /api/accounts/fam/:famId/personal/:accountType', () => {
      beforeEach(async () => {
        // Create multiple personal accounts of different types
        const personalAccounts = [
          {
            famId,
            type: AccountType.LIFE_INSURANCE,
            name: 'Life Insurance Policy 1',
            provider: 'Insurance Company A'
          },
          {
            famId,
            type: AccountType.LIFE_INSURANCE,
            name: 'Life Insurance Policy 2',
            provider: 'Insurance Company B'
          },
          {
            famId,
            type: AccountType.MOBILE_CONTRACT,
            name: 'Mobile Contract',
            provider: 'Mobile Provider'
          }
        ];

        for (const account of personalAccounts) {
          await request(app)
            .post('/api/accounts/personal')
            .set('Authorization', `Bearer ${authToken}`)
            .send(account);
        }
      });

      it('should get personal accounts by type successfully', async () => {
        const response = await request(app)
          .get(`/api/accounts/fam/${famId}/personal/${AccountType.LIFE_INSURANCE}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].type).toBe(AccountType.LIFE_INSURANCE);
        expect(response.body.data[1].type).toBe(AccountType.LIFE_INSURANCE);
      });

      it('should return 400 for invalid personal account type', async () => {
        const response = await request(app)
          .get(`/api/accounts/fam/${famId}/personal/${AccountType.COUNCIL_TAX}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('not valid for personal accounts');
      });

      it('should return empty array for type with no accounts', async () => {
        const response = await request(app)
          .get(`/api/accounts/fam/${famId}/personal/${AccountType.WILL_TESTAMENT}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(0);
      });
    });

    describe('GET /api/accounts/personal/:accountId/access', () => {
      let personalAccountId: string;
      let sharedAccountId: string;

      beforeEach(async () => {
        // Create a personal account
        const personalAccountData = {
          famId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company'
        };

        const personalResponse = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        personalAccountId = personalResponse.body.data.id;

        // Create a shared account
        const sharedAccountData = {
          famId,
          accountHolderId: userId,
          assetId,
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax Account',
          provider: 'Local Council'
        };

        const sharedResponse = await request(app)
          .post('/api/accounts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(sharedAccountData);

        sharedAccountId = sharedResponse.body.data.id;
      });

      it('should return true for personal account owned by user', async () => {
        const response = await request(app)
          .get(`/api/accounts/personal/${personalAccountId}/access`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.hasAccess).toBe(true);
        expect(response.body.data.accountId).toBe(personalAccountId);
        expect(response.body.data.userId).toBe(userId);
      });

      it('should return false for personal account owned by different user', async () => {
        const response = await request(app)
          .get(`/api/accounts/personal/${personalAccountId}/access`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.hasAccess).toBe(false);
      });

      it('should return true for shared account when user is Fam member', async () => {
        const response = await request(app)
          .get(`/api/accounts/personal/${sharedAccountId}/access`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.hasAccess).toBe(true);
      });
    });

    describe('Personal Account Privacy Controls', () => {
      let personalAccountId: string;

      beforeEach(async () => {
        // Create a personal account for the first user
        const personalAccountData = {
          famId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company'
        };

        const response = await request(app)
          .post('/api/accounts/personal')
          .set('Authorization', `Bearer ${authToken}`)
          .send(personalAccountData);

        personalAccountId = response.body.data.id;
      });

      it('should not show personal accounts of other users in Fam account list', async () => {
        const response = await request(app)
          .get(`/api/accounts/fam/${famId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Should not include the personal account created by the first user
        const personalAccounts = response.body.data.filter((account: any) => account.userId !== null);
        expect(personalAccounts).toHaveLength(0);
      });

      it('should show personal accounts when includePersonal=true and user owns them', async () => {
        const response = await request(app)
          .get(`/api/accounts/fam/${famId}?includePersonal=true`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        // Should include the personal account created by the user
        const personalAccounts = response.body.data.filter((account: any) => account.userId === userId);
        expect(personalAccounts).toHaveLength(1);
        expect(personalAccounts[0].id).toBe(personalAccountId);
      });

      it('should not allow direct access to personal account by other users', async () => {
        const response = await request(app)
          .get(`/api/accounts/${personalAccountId}`)
          .set('Authorization', `Bearer ${otherAuthToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('Access denied to personal account');
      });

      it('should allow access to personal account by owner', async () => {
        const response = await request(app)
          .get(`/api/accounts/${personalAccountId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(personalAccountId);
        expect(response.body.data.userId).toBe(userId);
      });
    });
  });
});