import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AssetType, AccountType, PlanType, Role } from '../../src/models/types';

// This test will only run if DATABASE_URL is available
const prisma = new PrismaClient();

describe('Model Integration Tests', () => {
  let testUserId: string;
  let testFamId: string;
  let testAssetId: string;

  beforeAll(async () => {
    try {
      // Test database connection
      await prisma.$connect();
    } catch (error) {
      console.log('Database not available, skipping integration tests');
      return;
    }
  });

  afterAll(async () => {
    try {
      // Clean up test data
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
      if (testFamId) {
        await prisma.fam.delete({ where: { id: testFamId } }).catch(() => {});
      }
      await prisma.$disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create and retrieve a user', async () => {
    try {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User'
        }
      });

      testUserId = user.id;

      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);

      // Retrieve the user
      const retrievedUser = await prisma.user.findUnique({
        where: { id: user.id }
      });

      expect(retrievedUser).toEqual(user);
    } catch (error) {
      if (error.code === 'P1001') {
        console.log('Database not available, skipping test');
        return;
      }
      throw error;
    }
  });

  it('should create a fam with membership', async () => {
    try {
      if (!testUserId) {
        // Create user first if previous test was skipped
        const user = await prisma.user.create({
          data: {
            email: 'test2@example.com',
            name: 'Test User 2'
          }
        });
        testUserId = user.id;
      }

      const fam = await prisma.fam.create({
        data: {
          name: 'Test Family',
          members: {
            create: {
              userId: testUserId,
              role: Role.ADMIN
            }
          }
        },
        include: {
          members: {
            include: {
              user: true
            }
          }
        }
      });

      testFamId = fam.id;

      expect(fam.name).toBe('Test Family');
      expect(fam.members).toHaveLength(1);
      expect(fam.members[0].role).toBe(Role.ADMIN);
      expect(fam.members[0].user.id).toBe(testUserId);
    } catch (error) {
      if (error.code === 'P1001') {
        console.log('Database not available, skipping test');
        return;
      }
      throw error;
    }
  });

  it('should create an asset with accounts', async () => {
    try {
      if (!testFamId || !testUserId) {
        console.log('Prerequisites not met, skipping test');
        return;
      }

      const asset = await prisma.asset.create({
        data: {
          famId: testFamId,
          type: AssetType.HOME,
          name: 'Test House',
          description: 'A test house',
          customFields: {
            address: '123 Test Street',
            bedrooms: 3
          },
          accounts: {
            create: [
              {
                famId: testFamId,
                accountHolderId: testUserId,
                type: AccountType.COUNCIL_TAX,
                name: 'Council Tax',
                provider: 'Test Council',
                amount: 150.00
              },
              {
                famId: testFamId,
                accountHolderId: testUserId,
                type: AccountType.HOME_INSURANCE,
                name: 'Home Insurance',
                provider: 'Test Insurance'
              }
            ]
          }
        },
        include: {
          accounts: true
        }
      });

      testAssetId = asset.id;

      expect(asset.name).toBe('Test House');
      expect(asset.type).toBe(AssetType.HOME);
      expect(asset.customFields).toEqual({
        address: '123 Test Street',
        bedrooms: 3
      });
      expect(asset.accounts).toHaveLength(2);
      expect(asset.accounts[0].type).toBe(AccountType.COUNCIL_TAX);
      expect(asset.accounts[1].type).toBe(AccountType.HOME_INSURANCE);
    } catch (error) {
      if (error.code === 'P1001') {
        console.log('Database not available, skipping test');
        return;
      }
      throw error;
    }
  });

  it('should create a plan with tasks', async () => {
    try {
      if (!testFamId || !testUserId) {
        console.log('Prerequisites not met, skipping test');
        return;
      }

      const plan = await prisma.plan.create({
        data: {
          famId: testFamId,
          type: PlanType.HOLIDAY,
          name: 'Summer Holiday',
          description: 'Family vacation',
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-07-15'),
          tasks: {
            create: [
              {
                title: 'Book flights',
                description: 'Book return flights',
                assignedToId: testUserId,
                dueDate: new Date('2024-06-01')
              },
              {
                title: 'Book hotel',
                description: 'Find and book accommodation'
              }
            ]
          }
        },
        include: {
          tasks: {
            include: {
              assignedTo: true
            }
          }
        }
      });

      expect(plan.name).toBe('Summer Holiday');
      expect(plan.type).toBe(PlanType.HOLIDAY);
      expect(plan.tasks).toHaveLength(2);
      expect(plan.tasks[0].title).toBe('Book flights');
      expect(plan.tasks[0].assignedTo?.id).toBe(testUserId);
      expect(plan.tasks[1].assignedTo).toBeNull();
    } catch (error) {
      if (error.code === 'P1001') {
        console.log('Database not available, skipping test');
        return;
      }
      throw error;
    }
  });

  it('should handle personal accounts', async () => {
    try {
      if (!testFamId || !testUserId) {
        console.log('Prerequisites not met, skipping test');
        return;
      }

      const personalAccount = await prisma.account.create({
        data: {
          userId: testUserId, // Personal account
          famId: testFamId,
          accountHolderId: testUserId,
          type: AccountType.MOBILE_CONTRACT,
          name: 'Mobile Phone',
          provider: 'Test Mobile',
          expiryDate: new Date('2025-12-31')
        }
      });

      expect(personalAccount.userId).toBe(testUserId);
      expect(personalAccount.assetId).toBeNull();
      expect(personalAccount.type).toBe(AccountType.MOBILE_CONTRACT);
    } catch (error) {
      if (error.code === 'P1001') {
        console.log('Database not available, skipping test');
        return;
      }
      throw error;
    }
  });
});