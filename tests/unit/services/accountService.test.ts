import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { accountService, AccountService } from '../../../src/services/accountService';
import { famService } from '../../../src/services/famService';
import { prisma } from '../../../src/lib/prisma';
import { AccountType, CreateAccountRequest } from '../../../src/models/types';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    account: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn()
    },
    asset: {
      findUnique: vi.fn()
    },
    document: {
      count: vi.fn()
    }
  }
}));

vi.mock('../../../src/services/famService', () => ({
  famService: {
    verifyFamMembership: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('AccountService', () => {
  const mockUserId = 'user-123';
  const mockFamId = 'fam-123';
  const mockAccountHolderId = 'holder-123';
  const mockAssetId = 'asset-123';
  const mockAccountId = 'account-123';

  const mockAccount = {
    id: mockAccountId,
    assetId: mockAssetId,
    userId: null,
    famId: mockFamId,
    accountHolderId: mockAccountHolderId,
    type: AccountType.COUNCIL_TAX,
    name: 'Council Tax Account',
    provider: 'Local Council',
    accountNumber: 'CT123456',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    amount: new Decimal('150.00'),
    expiryDate: null,
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    accountHolder: {
      id: mockAccountHolderId,
      name: 'John Doe',
      email: 'john@example.com'
    },
    asset: {
      id: mockAssetId,
      name: 'Family Home',
      type: 'HOME'
    },
    personalUser: null,
    documents: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createAccount', () => {
    const validCreateRequest: CreateAccountRequest = {
      famId: mockFamId,
      accountHolderId: mockAccountHolderId,
      assetId: mockAssetId,
      type: AccountType.COUNCIL_TAX,
      name: 'Council Tax Account',
      provider: 'Local Council',
      accountNumber: 'CT123456',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      amount: 150.00
    };

    it('should create a household account successfully', async () => {
      // Setup mocks
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: mockAssetId,
        famId: mockFamId,
        type: 'HOME',
        name: 'Family Home',
        description: null,
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
      vi.mocked(prisma.account.create).mockResolvedValue(mockAccount);

      const result = await accountService.createAccount(mockUserId, validCreateRequest);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockAccountHolderId);
      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { id: mockAssetId }
      });
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          assetId: mockAssetId,
          userId: undefined,
          famId: mockFamId,
          accountHolderId: mockAccountHolderId,
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax Account',
          provider: 'Local Council',
          accountNumber: 'CT123456',
          dueDate: validCreateRequest.dueDate,
          amount: new Decimal(150.00),
          expiryDate: undefined,
          customFields: {}
        },
        include: {
          accountHolder: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          asset: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          personalUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          documents: true
        }
      });
      expect(result).toEqual(mockAccount);
    });

    it('should create a personal account successfully', async () => {
      const personalAccountRequest: CreateAccountRequest = {
        famId: mockFamId,
        accountHolderId: mockAccountHolderId,
        userId: mockAccountHolderId,
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company',
        amount: 50.00
      };

      const personalAccount = {
        ...mockAccount,
        assetId: null,
        userId: mockAccountHolderId,
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company',
        asset: null
      };

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.create).mockResolvedValue(personalAccount);

      const result = await accountService.createAccount(mockUserId, personalAccountRequest);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockAccountHolderId);
      expect(prisma.asset.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(personalAccount);
    });

    it('should throw error for invalid input data', async () => {
      const invalidRequest = {
        ...validCreateRequest,
        name: '' // Invalid name
      };

      await expect(accountService.createAccount(mockUserId, invalidRequest))
        .rejects.toThrow('Validation failed');
    });

    it('should throw error if user not in Fam', async () => {
      vi.mocked(famService.verifyFamMembership).mockRejectedValue(new Error('Access denied'));

      await expect(accountService.createAccount(mockUserId, validCreateRequest))
        .rejects.toThrow('Access denied');
    });

    it('should throw error if asset does not exist', async () => {
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.asset.findUnique).mockResolvedValue(null);

      await expect(accountService.createAccount(mockUserId, validCreateRequest))
        .rejects.toThrow('Asset not found');
    });

    it('should throw error if asset belongs to different Fam', async () => {
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.asset.findUnique).mockResolvedValue({
        id: mockAssetId,
        famId: 'different-fam',
        type: 'HOME',
        name: 'Family Home',
        description: null,
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await expect(accountService.createAccount(mockUserId, validCreateRequest))
        .rejects.toThrow('Asset does not belong to the specified Fam');
    });

    it('should throw error for personal account with mismatched user ID', async () => {
      const invalidPersonalRequest: CreateAccountRequest = {
        famId: mockFamId,
        accountHolderId: mockAccountHolderId,
        userId: 'different-user',
        type: AccountType.LIFE_INSURANCE,
        name: 'Life Insurance Policy',
        provider: 'Insurance Company'
      };

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

      await expect(accountService.createAccount(mockUserId, invalidPersonalRequest))
        .rejects.toThrow('Personal account user ID must match account holder ID');
    });
  });

  describe('getAccountById', () => {
    it('should return account successfully', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

      const result = await accountService.getAccountById(mockAccountId, mockUserId);

      expect(prisma.account.findUnique).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        include: {
          accountHolder: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          asset: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          personalUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          documents: true
        }
      });
      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(result).toEqual(mockAccount);
    });

    it('should throw error if account not found', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

      await expect(accountService.getAccountById(mockAccountId, mockUserId))
        .rejects.toThrow('Account not found');
    });

    it('should throw error for personal account access by different user', async () => {
      const personalAccount = {
        ...mockAccount,
        userId: 'different-user'
      };

      vi.mocked(prisma.account.findUnique).mockResolvedValue(personalAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

      await expect(accountService.getAccountById(mockAccountId, mockUserId))
        .rejects.toThrow('Access denied to personal account');
    });
  });

  describe('getAccountsByFam', () => {
    it('should return accounts for Fam', async () => {
      const mockAccounts = [mockAccount];

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      const result = await accountService.getAccountsByFam(mockFamId, mockUserId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          OR: [
            { userId: null },
            { userId: mockUserId }
          ]
        },
        include: {
          accountHolder: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          asset: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          personalUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          documents: true
        },
        orderBy: [
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ]
      });
      expect(result).toEqual(mockAccounts);
    });

    it('should filter by account type', async () => {
      const mockAccounts = [mockAccount];

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      await accountService.getAccountsByFam(mockFamId, mockUserId, { 
        accountType: AccountType.COUNCIL_TAX 
      });

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          type: AccountType.COUNCIL_TAX,
          OR: [
            { userId: null },
            { userId: mockUserId }
          ]
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });

    it('should exclude personal accounts when requested', async () => {
      const mockAccounts = [mockAccount];

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      await accountService.getAccountsByFam(mockFamId, mockUserId, { 
        includePersonal: false 
      });

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          userId: null
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      const updateData = {
        name: 'Updated Council Tax',
        amount: 175.00
      };

      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.update).mockResolvedValue({
        ...mockAccount,
        ...updateData,
        amount: new Decimal(175.00)
      });

      const result = await accountService.updateAccount(mockAccountId, mockUserId, updateData);

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: {
          name: 'Updated Council Tax',
          amount: new Decimal(175.00)
        },
        include: expect.any(Object)
      });
      expect(result.name).toBe('Updated Council Tax');
    });

    it('should throw error for invalid update data', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

      await expect(accountService.updateAccount(mockAccountId, mockUserId, { name: '' }))
        .rejects.toThrow('Account name must be at least 2 characters long');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.document.count).mockResolvedValue(0);
      vi.mocked(prisma.account.delete).mockResolvedValue(mockAccount);

      await accountService.deleteAccount(mockAccountId, mockUserId);

      expect(prisma.document.count).toHaveBeenCalledWith({
        where: { accountId: mockAccountId }
      });
      expect(prisma.account.delete).toHaveBeenCalledWith({
        where: { id: mockAccountId }
      });
    });

    it('should throw error if account has documents', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount);
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.document.count).mockResolvedValue(1);

      await expect(accountService.deleteAccount(mockAccountId, mockUserId))
        .rejects.toThrow('Cannot delete account with associated documents');
    });
  });

  describe('UK Account Types', () => {
    it('should return UK account types', () => {
      const accountTypes = accountService.getUKAccountTypes();

      expect(accountTypes).toHaveProperty(AccountType.COUNCIL_TAX);
      expect(accountTypes).toHaveProperty(AccountType.HOME_INSURANCE);
      expect(accountTypes).toHaveProperty(AccountType.ENERGY_BILL);
      expect(accountTypes).toHaveProperty(AccountType.LIFE_INSURANCE);
      expect(accountTypes).toHaveProperty(AccountType.MOBILE_CONTRACT);
      expect(accountTypes).toHaveProperty(AccountType.WILL_TESTAMENT);

      expect(accountTypes[AccountType.COUNCIL_TAX]).toEqual({
        name: 'Council Tax',
        description: 'Local authority council tax payments',
        category: 'household',
        requiredFields: ['provider', 'accountNumber'],
        optionalFields: ['dueDate', 'amount']
      });
    });

    it('should return account type info', () => {
      const typeInfo = accountService.getAccountTypeInfo(AccountType.COUNCIL_TAX);

      expect(typeInfo).toEqual({
        name: 'Council Tax',
        description: 'Local authority council tax payments',
        category: 'household',
        requiredFields: ['provider', 'accountNumber'],
        optionalFields: ['dueDate', 'amount']
      });
    });

    it('should return account types by category', () => {
      const householdTypes = accountService.getAccountTypesByCategory('household');
      const personalTypes = accountService.getAccountTypesByCategory('personal');

      expect(householdTypes).toContain(AccountType.COUNCIL_TAX);
      expect(householdTypes).toContain(AccountType.HOME_INSURANCE);
      expect(householdTypes).toContain(AccountType.ENERGY_BILL);

      expect(personalTypes).toContain(AccountType.LIFE_INSURANCE);
      expect(personalTypes).toContain(AccountType.MOBILE_CONTRACT);
      expect(personalTypes).toContain(AccountType.WILL_TESTAMENT);
    });
  });

  describe('searchAccounts', () => {
    it('should search accounts successfully', async () => {
      const mockAccounts = [mockAccount];

      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts);

      const result = await accountService.searchAccounts(mockFamId, mockUserId, 'council');

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          OR: [
            { userId: null },
            { userId: mockUserId }
          ],
          AND: {
            OR: [
              {
                name: {
                  contains: 'council',
                  mode: 'insensitive'
                }
              },
              {
                provider: {
                  contains: 'council',
                  mode: 'insensitive'
                }
              },
              {
                accountNumber: {
                  contains: 'council',
                  mode: 'insensitive'
                }
              }
            ]
          }
        },
        include: expect.any(Object),
        orderBy: expect.any(Array)
      });
      expect(result).toEqual(mockAccounts);
    });

    it('should throw error for short search query', async () => {
      vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

      await expect(accountService.searchAccounts(mockFamId, mockUserId, 'a'))
        .rejects.toThrow('Search query must be at least 2 characters long');
    });
  });

  describe('Personal Account Management', () => {
    const personalAccount = {
      ...mockAccount,
      assetId: null,
      userId: mockUserId,
      type: AccountType.LIFE_INSURANCE,
      name: 'Life Insurance Policy',
      provider: 'Insurance Company',
      asset: null
    };

    describe('createPersonalAccount', () => {
      it('should create personal account successfully', async () => {
        const createData = {
          famId: mockFamId,
          type: AccountType.LIFE_INSURANCE,
          name: 'Life Insurance Policy',
          provider: 'Insurance Company',
          amount: 50.00
        };

        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
        vi.mocked(prisma.account.create).mockResolvedValue(personalAccount);

        const result = await accountService.createPersonalAccount(mockUserId, createData);

        expect(prisma.account.create).toHaveBeenCalledWith({
          data: {
            assetId: undefined,
            userId: mockUserId,
            famId: mockFamId,
            accountHolderId: mockUserId,
            type: AccountType.LIFE_INSURANCE,
            name: 'Life Insurance Policy',
            provider: 'Insurance Company',
            accountNumber: undefined,
            dueDate: undefined,
            amount: new Decimal(50.00),
            expiryDate: undefined,
            customFields: {}
          },
          include: expect.any(Object)
        });
        expect(result).toEqual(personalAccount);
      });

      it('should throw error for invalid personal account type', async () => {
        const createData = {
          famId: mockFamId,
          type: AccountType.COUNCIL_TAX, // Not a personal account type
          name: 'Council Tax',
          provider: 'Local Council'
        };

        await expect(accountService.createPersonalAccount(mockUserId, createData))
          .rejects.toThrow('Account type COUNCIL_TAX is not valid for personal accounts');
      });

      it('should allow custom account type for personal accounts', async () => {
        const createData = {
          famId: mockFamId,
          type: AccountType.CUSTOM,
          name: 'Custom Personal Account',
          provider: 'Custom Provider'
        };

        const customPersonalAccount = {
          ...personalAccount,
          type: AccountType.CUSTOM,
          name: 'Custom Personal Account',
          provider: 'Custom Provider'
        };

        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
        vi.mocked(prisma.account.create).mockResolvedValue(customPersonalAccount);

        const result = await accountService.createPersonalAccount(mockUserId, createData);

        expect(result).toEqual(customPersonalAccount);
      });
    });

    describe('updatePersonalAccount', () => {
      it('should update personal account successfully', async () => {
        const updateData = {
          name: 'Updated Life Insurance',
          amount: 75.00
        };

        vi.mocked(prisma.account.findUnique).mockResolvedValue(personalAccount);
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
        vi.mocked(prisma.account.update).mockResolvedValue({
          ...personalAccount,
          ...updateData,
          amount: new Decimal(75.00)
        });

        const result = await accountService.updatePersonalAccount(mockAccountId, mockUserId, updateData);

        expect(result.name).toBe('Updated Life Insurance');
      });

      it('should throw error for non-personal account', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount); // Not a personal account
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        await expect(accountService.updatePersonalAccount(mockAccountId, mockUserId, { name: 'Updated' }))
          .rejects.toThrow('Account is not a personal account or access denied');
      });

      it('should throw error for personal account owned by different user', async () => {
        const otherUserPersonalAccount = {
          ...personalAccount,
          userId: 'other-user'
        };

        vi.mocked(prisma.account.findUnique).mockResolvedValue(otherUserPersonalAccount);
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        await expect(accountService.updatePersonalAccount(mockAccountId, mockUserId, { name: 'Updated' }))
          .rejects.toThrow('Access denied to personal account');
      });
    });

    describe('deletePersonalAccount', () => {
      it('should delete personal account successfully', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue(personalAccount);
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
        vi.mocked(prisma.document.count).mockResolvedValue(0);
        vi.mocked(prisma.account.delete).mockResolvedValue(personalAccount);

        await accountService.deletePersonalAccount(mockAccountId, mockUserId);

        expect(prisma.account.delete).toHaveBeenCalledWith({
          where: { id: mockAccountId }
        });
      });

      it('should throw error for non-personal account', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue(mockAccount); // Not a personal account
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        await expect(accountService.deletePersonalAccount(mockAccountId, mockUserId))
          .rejects.toThrow('Account is not a personal account or access denied');
      });
    });

    describe('getPersonalAccountsByType', () => {
      it('should get personal accounts by type successfully', async () => {
        const mockPersonalAccounts = [personalAccount];

        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);
        vi.mocked(prisma.account.findMany).mockResolvedValue(mockPersonalAccounts);

        const result = await accountService.getPersonalAccountsByType(
          mockUserId, 
          mockFamId, 
          AccountType.LIFE_INSURANCE
        );

        expect(prisma.account.findMany).toHaveBeenCalledWith({
          where: {
            famId: mockFamId,
            userId: mockUserId,
            type: AccountType.LIFE_INSURANCE
          },
          include: expect.any(Object),
          orderBy: expect.any(Array)
        });
        expect(result).toEqual(mockPersonalAccounts);
      });

      it('should throw error for invalid personal account type', async () => {
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        await expect(accountService.getPersonalAccountsByType(
          mockUserId, 
          mockFamId, 
          AccountType.COUNCIL_TAX
        )).rejects.toThrow('Account type COUNCIL_TAX is not valid for personal accounts');
      });
    });

    describe('canUserAccessPersonalAccount', () => {
      it('should return true for personal account owned by user', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          userId: mockUserId,
          famId: mockFamId
        });
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        const result = await accountService.canUserAccessPersonalAccount(mockAccountId, mockUserId);

        expect(result).toBe(true);
      });

      it('should return false for personal account owned by different user', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          userId: 'other-user',
          famId: mockFamId
        });
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        const result = await accountService.canUserAccessPersonalAccount(mockAccountId, mockUserId);

        expect(result).toBe(false);
      });

      it('should return true for shared account when user is Fam member', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          userId: null,
          famId: mockFamId
        });
        vi.mocked(famService.verifyFamMembership).mockResolvedValue(undefined);

        const result = await accountService.canUserAccessPersonalAccount(mockAccountId, mockUserId);

        expect(result).toBe(true);
      });

      it('should return false when user is not Fam member', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          userId: null,
          famId: mockFamId
        });
        vi.mocked(famService.verifyFamMembership).mockRejectedValue(new Error('Access denied'));

        const result = await accountService.canUserAccessPersonalAccount(mockAccountId, mockUserId);

        expect(result).toBe(false);
      });

      it('should return false for non-existent account', async () => {
        vi.mocked(prisma.account.findUnique).mockResolvedValue(null);

        const result = await accountService.canUserAccessPersonalAccount(mockAccountId, mockUserId);

        expect(result).toBe(false);
      });
    });
  });
});