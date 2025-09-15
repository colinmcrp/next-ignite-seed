import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { AccountType } from '../../src/models/types';
import { Decimal } from '@prisma/client/runtime/library';

describe('Notification API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let famId: string;
  let assetId: string;

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
    // Clean up test data
    await prisma.document.deleteMany();
    await prisma.account.deleteMany();
    await prisma.asset.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('GET /api/accounts/fam/:famId/obligations', () => {
    it('should return upcoming obligations for a fam', async () => {
      // Create test accounts with due dates
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Council Tax',
            provider: 'Glasgow City Council',
            dueDate: futureDate,
            amount: new Decimal('150.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'Energy Bill',
            provider: 'British Gas',
            dueDate: pastDate,
            amount: new Decimal('120.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.HOME_INSURANCE,
            name: 'Home Insurance',
            provider: 'Direct Line',
            expiryDate: futureDate,
            amount: new Decimal('300.00')
          }
        ]
      });

      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(3);

      // Check that obligations are sorted by urgency (overdue first)
      const obligations = response.body.data;
      expect(obligations[0].urgencyLevel).toBe('overdue');
      expect(obligations[0].accountName).toBe('Energy Bill');
      expect(obligations[0].obligationType).toBe('payment');
      expect(obligations[0].daysUntilDue).toBe(-2);

      // Check payment obligation
      const paymentObligation = obligations.find((o: any) => o.accountName === 'Council Tax');
      expect(paymentObligation).toBeDefined();
      expect(paymentObligation.obligationType).toBe('payment');
      expect(paymentObligation.amount).toBe(150);
      expect(paymentObligation.daysUntilDue).toBe(5);
      expect(paymentObligation.urgencyLevel).toBe('low');

      // Check renewal obligation
      const renewalObligation = obligations.find((o: any) => o.accountName === 'Home Insurance');
      expect(renewalObligation).toBeDefined();
      expect(renewalObligation.obligationType).toBe('renewal');
      expect(renewalObligation.amount).toBe(300);
      expect(renewalObligation.daysUntilDue).toBe(5);
      expect(renewalObligation.urgencyLevel).toBe('high');
    });

    it('should respect daysAhead parameter', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 45); // 45 days in future

      await prisma.account.create({
        data: {
          famId,
          accountHolderId: userId,
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax',
          provider: 'Glasgow City Council',
          dueDate: futureDate,
          amount: new Decimal('150.00')
        }
      });

      // Request with 30 days ahead - should not include the account
      const response30 = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations?daysAhead=30`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response30.body.data).toHaveLength(0);

      // Request with 60 days ahead - should include the account
      const response60 = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations?daysAhead=60`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response60.body.data).toHaveLength(1);
    });

    it('should validate daysAhead parameter', async () => {
      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations?daysAhead=invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations?daysAhead=-1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations?daysAhead=400`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations`)
        .expect(401);
    });

    it('should verify fam membership', async () => {
      // Create another user and fam
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      const otherUserId = otherUserResponse.body.data.user.id;
      const otherAuthToken = otherUserResponse.body.data.token;

      const otherFamResponse = await request(app)
        .post('/api/fams')
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .send({
          name: 'Other Family'
        });

      const otherFamId = otherFamResponse.body.data.id;

      await request(app)
        .get(`/api/accounts/fam/${otherFamId}/obligations`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /api/accounts/fam/:famId/obligations/summary', () => {
    it('should return notification summary', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      const nearFutureDate = new Date();
      nearFutureDate.setDate(nearFutureDate.getDate() + 1);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Council Tax',
            provider: 'Glasgow City Council',
            dueDate: futureDate,
            amount: new Decimal('150.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'Energy Bill',
            provider: 'British Gas',
            dueDate: pastDate,
            amount: new Decimal('120.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.MOBILE_CONTRACT,
            name: 'Mobile Contract',
            provider: 'EE',
            dueDate: nearFutureDate,
            amount: new Decimal('45.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.HOME_INSURANCE,
            name: 'Home Insurance',
            provider: 'Direct Line',
            expiryDate: futureDate,
            amount: new Decimal('300.00')
          }
        ]
      });

      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/summary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalObligations: 4,
        overdueCount: 1,
        highUrgencyCount: 2, // Mobile contract (1 day) + Home insurance renewal (5 days)
        mediumUrgencyCount: 0,
        lowUrgencyCount: 1 // Council tax (5 days)
      });

      expect(response.body.data.upcomingPayments).toHaveLength(3);
      expect(response.body.data.upcomingRenewals).toHaveLength(1);
    });
  });

  describe('GET /api/accounts/fam/:famId/obligations/overdue', () => {
    it('should return only overdue obligations', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Council Tax',
            provider: 'Glasgow City Council',
            dueDate: futureDate,
            amount: new Decimal('150.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'Energy Bill',
            provider: 'British Gas',
            dueDate: pastDate,
            amount: new Decimal('120.00')
          }
        ]
      });

      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/overdue`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].accountName).toBe('Energy Bill');
      expect(response.body.data[0].urgencyLevel).toBe('overdue');
    });
  });

  describe('GET /api/accounts/fam/:famId/obligations/due-within/:days', () => {
    it('should return obligations due within specified days', async () => {
      const date2Days = new Date();
      date2Days.setDate(date2Days.getDate() + 2);

      const date5Days = new Date();
      date5Days.setDate(date5Days.getDate() + 5);

      const date10Days = new Date();
      date10Days.setDate(date10Days.getDate() + 10);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Council Tax 2 days',
            provider: 'Glasgow City Council',
            dueDate: date2Days,
            amount: new Decimal('150.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'Energy Bill 5 days',
            provider: 'British Gas',
            dueDate: date5Days,
            amount: new Decimal('120.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.TV_PACKAGE,
            name: 'TV Package 10 days',
            provider: 'Sky',
            dueDate: date10Days,
            amount: new Decimal('50.00')
          }
        ]
      });

      // Get obligations due within 3 days
      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/due-within/3`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].accountName).toBe('Council Tax 2 days');
    });

    it('should validate days parameter', async () => {
      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/due-within/invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/due-within/-1`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/due-within/400`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/accounts/fam/:famId/obligations/urgency/:urgency', () => {
    it('should return obligations by urgency level', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'High Priority',
            provider: 'British Gas',
            dueDate: tomorrow,
            amount: new Decimal('120.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Low Priority',
            provider: 'Glasgow City Council',
            dueDate: nextWeek,
            amount: new Decimal('150.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.TV_PACKAGE,
            name: 'Overdue',
            provider: 'Sky',
            dueDate: pastDate,
            amount: new Decimal('50.00')
          }
        ]
      });

      // Test high urgency
      const highResponse = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/urgency/high`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(highResponse.body.data).toHaveLength(1);
      expect(highResponse.body.data[0].accountName).toBe('High Priority');

      // Test overdue
      const overdueResponse = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/urgency/overdue`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(overdueResponse.body.data).toHaveLength(1);
      expect(overdueResponse.body.data[0].accountName).toBe('Overdue');

      // Test low urgency
      const lowResponse = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/urgency/low`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(lowResponse.body.data).toHaveLength(1);
      expect(lowResponse.body.data[0].accountName).toBe('Low Priority');
    });

    it('should validate urgency parameter', async () => {
      await request(app)
        .get(`/api/accounts/fam/${famId}/obligations/urgency/invalid`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/accounts/fam/:famId/attention', () => {
    it('should return accounts needing attention', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const renewalSoon = new Date();
      renewalSoon.setDate(renewalSoon.getDate() + 3);

      await prisma.account.createMany({
        data: [
          {
            famId,
            accountHolderId: userId,
            type: AccountType.ENERGY_BILL,
            name: 'Payment Due Soon',
            provider: 'British Gas',
            dueDate: tomorrow,
            amount: new Decimal('120.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.TV_PACKAGE,
            name: 'Overdue Payment',
            provider: 'Sky',
            dueDate: pastDate,
            amount: new Decimal('50.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.HOME_INSURANCE,
            name: 'Renewal Soon',
            provider: 'Direct Line',
            expiryDate: renewalSoon,
            amount: new Decimal('300.00')
          },
          {
            famId,
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Not Urgent',
            provider: 'Glasgow City Council',
            dueDate: nextWeek,
            amount: new Decimal('150.00')
          }
        ]
      });

      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/attention`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overdue');
      expect(response.body.data).toHaveProperty('dueSoon');
      expect(response.body.data).toHaveProperty('renewingSoon');

      expect(response.body.data.overdue).toHaveLength(1);
      expect(response.body.data.overdue[0].accountName).toBe('Overdue Payment');

      expect(response.body.data.dueSoon).toHaveLength(1);
      expect(response.body.data.dueSoon[0].accountName).toBe('Payment Due Soon');

      expect(response.body.data.renewingSoon).toHaveLength(1);
      expect(response.body.data.renewingSoon[0].accountName).toBe('Renewal Soon');
    });
  });

  describe('Personal account filtering', () => {
    it('should only show user personal accounts and shared accounts', async () => {
      // Create another user in the same fam
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      const otherUserId = otherUserResponse.body.data.user.id;

      await prisma.famMembership.create({
        data: {
          userId: otherUserId,
          famId,
          role: 'MEMBER'
        }
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      await prisma.account.createMany({
        data: [
          {
            famId,
            userId: userId, // Current user's personal account
            accountHolderId: userId,
            type: AccountType.MOBILE_CONTRACT,
            name: 'My Mobile',
            provider: 'EE',
            dueDate: futureDate,
            amount: new Decimal('45.00')
          },
          {
            famId,
            userId: otherUserId, // Other user's personal account
            accountHolderId: otherUserId,
            type: AccountType.MOBILE_CONTRACT,
            name: 'Other Mobile',
            provider: 'Vodafone',
            dueDate: futureDate,
            amount: new Decimal('40.00')
          },
          {
            famId,
            // No userId - shared account
            accountHolderId: userId,
            type: AccountType.COUNCIL_TAX,
            name: 'Shared Council Tax',
            provider: 'Glasgow City Council',
            dueDate: futureDate,
            amount: new Decimal('150.00')
          }
        ]
      });

      const response = await request(app)
        .get(`/api/accounts/fam/${famId}/obligations`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      
      const accountNames = response.body.data.map((o: any) => o.accountName);
      expect(accountNames).toContain('My Mobile');
      expect(accountNames).toContain('Shared Council Tax');
      expect(accountNames).not.toContain('Other Mobile');
    });
  });
});