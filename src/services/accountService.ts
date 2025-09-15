import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Account, CreateAccountRequest, UpdateAccountRequest, AccountType } from '../models/types';
import { validateCreateAccount, validateCustomFields } from '../models/validation';
import { famService } from './famService';
import { Decimal } from '@prisma/client/runtime/library';

export interface AccountWithDetails extends Account {
  accountHolder: {
    id: string;
    name: string;
    email: string;
  };
  asset?: {
    id: string;
    name: string;
    type: string;
  };
  personalUser?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface GetAccountsOptions {
  includePersonal?: boolean;
  accountType?: AccountType;
  assetId?: string;
  userId?: string;
}

export class AccountService {
  // UK-specific account type definitions
  private readonly UK_ACCOUNT_TYPES = {
    [AccountType.COUNCIL_TAX]: {
      name: 'Council Tax',
      description: 'Local authority council tax payments',
      category: 'household',
      requiredFields: ['provider', 'accountNumber'],
      optionalFields: ['dueDate', 'amount']
    },
    [AccountType.HOME_INSURANCE]: {
      name: 'Home Insurance',
      description: 'Property insurance coverage',
      category: 'household',
      requiredFields: ['provider'],
      optionalFields: ['expiryDate', 'amount']
    },
    [AccountType.ENERGY_BILL]: {
      name: 'Energy Bill',
      description: 'Gas and electricity supply',
      category: 'household',
      requiredFields: ['provider'],
      optionalFields: ['dueDate', 'amount', 'accountNumber']
    },
    [AccountType.TV_PACKAGE]: {
      name: 'TV Package',
      description: 'Television and broadband services',
      category: 'household',
      requiredFields: ['provider'],
      optionalFields: ['dueDate', 'amount', 'accountNumber']
    },
    [AccountType.FACTORING]: {
      name: 'Factoring',
      description: 'Property maintenance and management fees',
      category: 'household',
      requiredFields: ['provider'],
      optionalFields: ['dueDate', 'amount']
    },
    [AccountType.LIFE_INSURANCE]: {
      name: 'Life Insurance',
      description: 'Personal life insurance policy',
      category: 'personal',
      requiredFields: ['provider'],
      optionalFields: ['expiryDate', 'amount']
    },
    [AccountType.MOBILE_CONTRACT]: {
      name: 'Mobile Contract',
      description: 'Mobile phone contract',
      category: 'personal',
      requiredFields: ['provider'],
      optionalFields: ['dueDate', 'amount', 'expiryDate']
    },
    [AccountType.WILL_TESTAMENT]: {
      name: 'Will & Testament',
      description: 'Legal will and testament documents',
      category: 'personal',
      requiredFields: ['provider'],
      optionalFields: ['expiryDate']
    },
    [AccountType.CUSTOM]: {
      name: 'Custom Account',
      description: 'User-defined account type',
      category: 'custom',
      requiredFields: ['provider'],
      optionalFields: []
    }
  };

  async createAccount(userId: string, data: CreateAccountRequest): Promise<AccountWithDetails> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(data.famId, userId);

    // Validate input data
    const validation = validateCreateAccount(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Validate custom fields if provided
    if (data.customFields) {
      const customFieldsValidation = validateCustomFields(data.customFields);
      if (!customFieldsValidation.isValid) {
        throw new Error(`Custom fields validation failed: ${customFieldsValidation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Verify account holder is a member of the Fam
    await famService.verifyFamMembership(data.famId, data.accountHolderId);

    // If assetId is provided, verify it exists and belongs to the Fam
    if (data.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: data.assetId }
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.famId !== data.famId) {
        throw new Error('Asset does not belong to the specified Fam');
      }
    }

    // If userId is provided for personal account, verify it matches the account holder
    if (data.userId && data.userId !== data.accountHolderId) {
      throw new Error('Personal account user ID must match account holder ID');
    }

    // Convert amount to Decimal if provided
    const amount = data.amount !== undefined ? new Decimal(data.amount) : undefined;

    // Create account
    const account = await prisma.account.create({
      data: {
        assetId: data.assetId,
        userId: data.userId,
        famId: data.famId,
        accountHolderId: data.accountHolderId,
        type: data.type,
        name: data.name.trim(),
        provider: data.provider.trim(),
        accountNumber: data.accountNumber?.trim(),
        dueDate: data.dueDate,
        amount,
        expiryDate: data.expiryDate,
        customFields: data.customFields || {}
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

    const accountType = this.UK_ACCOUNT_TYPES[data.type];
    logger.info(`Account created: ${data.name} (${accountType.name}) in Fam ${data.famId} by user ${userId}`);

    return account as AccountWithDetails;
  }

  async getAccountById(accountId: string, userId: string): Promise<AccountWithDetails> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
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

    if (!account) {
      throw new Error('Account not found');
    }

    // Verify user has access to this Fam
    await famService.verifyFamMembership(account.famId, userId);

    // For personal accounts, verify user can access them
    if (account.userId && account.userId !== userId) {
      throw new Error('Access denied to personal account');
    }

    return account as AccountWithDetails;
  }

  async getAccountsByFam(famId: string, userId: string, options: GetAccountsOptions = {}): Promise<AccountWithDetails[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const whereClause: any = {
      famId
    };

    // Filter by account type if specified
    if (options.accountType) {
      whereClause.type = options.accountType;
    }

    // Filter by asset if specified
    if (options.assetId) {
      whereClause.assetId = options.assetId;
    }

    // Handle personal account filtering
    if (options.includePersonal === false) {
      whereClause.userId = null;
    } else if (options.userId) {
      whereClause.userId = options.userId;
    } else if (options.includePersonal !== true) {
      // By default, only show personal accounts for the requesting user
      whereClause.OR = [
        { userId: null }, // Shared accounts
        { userId: userId } // User's personal accounts
      ];
    }

    const accounts = await prisma.account.findMany({
      where: whereClause,
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

    return accounts as AccountWithDetails[];
  }

  async updateAccount(accountId: string, userId: string, data: UpdateAccountRequest): Promise<AccountWithDetails> {
    // Get existing account and verify access
    const existingAccount = await this.getAccountById(accountId, userId);

    // Validate custom fields if provided
    if (data.customFields) {
      const customFieldsValidation = validateCustomFields(data.customFields);
      if (!customFieldsValidation.isValid) {
        throw new Error(`Custom fields validation failed: ${customFieldsValidation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Validate other fields
    if (data.name !== undefined && (!data.name || data.name.trim().length < 2)) {
      throw new Error('Account name must be at least 2 characters long');
    }

    if (data.provider !== undefined && (!data.provider || data.provider.trim().length < 2)) {
      throw new Error('Provider name must be at least 2 characters long');
    }

    if (data.amount !== undefined && data.amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (data.dueDate && data.dueDate < new Date()) {
      throw new Error('Due date cannot be in the past');
    }

    if (data.expiryDate && data.expiryDate < new Date()) {
      throw new Error('Expiry date cannot be in the past');
    }

    const updateData: any = {};
    
    if (data.type !== undefined) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.provider !== undefined) updateData.provider = data.provider.trim();
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber?.trim();
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.amount !== undefined) updateData.amount = data.amount !== null ? new Decimal(data.amount) : null;
    if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    const account = await prisma.account.update({
      where: { id: accountId },
      data: updateData,
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

    logger.info(`Account updated: ${accountId} by user ${userId}`);

    return account as AccountWithDetails;
  }

  async deleteAccount(accountId: string, userId: string): Promise<void> {
    // Get existing account and verify access
    await this.getAccountById(accountId, userId);

    // Check if account has associated documents
    const documentCount = await prisma.document.count({
      where: { accountId }
    });

    if (documentCount > 0) {
      throw new Error('Cannot delete account with associated documents. Please remove documents first.');
    }

    await prisma.account.delete({
      where: { id: accountId }
    });

    logger.info(`Account deleted: ${accountId} by user ${userId}`);
  }

  // UK-specific helper methods
  getUKAccountTypes(): Record<AccountType, any> {
    return this.UK_ACCOUNT_TYPES;
  }

  getAccountTypeInfo(type: AccountType): any {
    return this.UK_ACCOUNT_TYPES[type];
  }

  getAccountTypesByCategory(category: 'household' | 'personal' | 'custom'): AccountType[] {
    return Object.entries(this.UK_ACCOUNT_TYPES)
      .filter(([_, info]) => info.category === category)
      .map(([type, _]) => type as AccountType);
  }

  async getAccountsByAsset(assetId: string, userId: string): Promise<AccountWithDetails[]> {
    // First verify the asset exists and user has access
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Verify user has access to this Fam
    await famService.verifyFamMembership(asset.famId, userId);

    const accounts = await prisma.account.findMany({
      where: { assetId },
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

    return accounts as AccountWithDetails[];
  }

  async getPersonalAccounts(userId: string, famId: string): Promise<AccountWithDetails[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const accounts = await prisma.account.findMany({
      where: {
        famId,
        userId
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

    return accounts as AccountWithDetails[];
  }

  async createPersonalAccount(userId: string, data: Omit<CreateAccountRequest, 'userId' | 'assetId'>): Promise<AccountWithDetails> {
    // Ensure this is a personal account by setting userId and removing assetId
    const personalAccountData: CreateAccountRequest = {
      ...data,
      userId,
      assetId: undefined,
      accountHolderId: userId // Personal accounts are always owned by the user
    };

    // Validate that the account type is appropriate for personal accounts
    const personalAccountTypes = this.getAccountTypesByCategory('personal');
    if (!personalAccountTypes.includes(data.type) && data.type !== AccountType.CUSTOM) {
      throw new Error(`Account type ${data.type} is not valid for personal accounts`);
    }

    return this.createAccount(userId, personalAccountData);
  }

  async updatePersonalAccount(accountId: string, userId: string, data: UpdateAccountRequest): Promise<AccountWithDetails> {
    // First verify this is a personal account owned by the user
    const existingAccount = await this.getAccountById(accountId, userId);
    
    if (!existingAccount.userId || existingAccount.userId !== userId) {
      throw new Error('Account is not a personal account or access denied');
    }

    return this.updateAccount(accountId, userId, data);
  }

  async deletePersonalAccount(accountId: string, userId: string): Promise<void> {
    // First verify this is a personal account owned by the user
    const existingAccount = await this.getAccountById(accountId, userId);
    
    if (!existingAccount.userId || existingAccount.userId !== userId) {
      throw new Error('Account is not a personal account or access denied');
    }

    return this.deleteAccount(accountId, userId);
  }

  async getPersonalAccountsByType(userId: string, famId: string, accountType: AccountType): Promise<AccountWithDetails[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate that the account type is appropriate for personal accounts
    const personalAccountTypes = this.getAccountTypesByCategory('personal');
    if (!personalAccountTypes.includes(accountType) && accountType !== AccountType.CUSTOM) {
      throw new Error(`Account type ${accountType} is not valid for personal accounts`);
    }

    const accounts = await prisma.account.findMany({
      where: {
        famId,
        userId,
        type: accountType
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

    return accounts as AccountWithDetails[];
  }

  async canUserAccessPersonalAccount(accountId: string, userId: string): Promise<boolean> {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: {
          userId: true,
          famId: true
        }
      });

      if (!account) {
        return false;
      }

      // Check if user has access to the Fam
      try {
        await famService.verifyFamMembership(account.famId, userId);
      } catch {
        return false;
      }

      // If it's a personal account, only the owner can access it
      if (account.userId) {
        return account.userId === userId;
      }

      // If it's a shared account, any Fam member can access it
      return true;
    } catch {
      return false;
    }
  }

  async searchAccounts(famId: string, userId: string, query: string): Promise<AccountWithDetails[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    const accounts = await prisma.account.findMany({
      where: {
        famId,
        OR: [
          { userId: null }, // Shared accounts
          { userId: userId } // User's personal accounts
        ],
        AND: {
          OR: [
            {
              name: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            },
            {
              provider: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            },
            {
              accountNumber: {
                contains: query.trim(),
                mode: 'insensitive'
              }
            }
          ]
        }
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

    return accounts as AccountWithDetails[];
  }
}

export const accountService = new AccountService();