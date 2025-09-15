import { Request, Response } from 'express';
import { accountService, GetAccountsOptions } from '../services/accountService';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { CreateAccountRequest, UpdateAccountRequest, AccountType } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export class AccountController {
  async createAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const data: CreateAccountRequest = req.body;
      const account = await accountService.createAccount(userId, data);

      res.status(201).json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error('Error creating account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create account'
      });
    }
  }

  async getAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      const account = await accountService.getAccountById(accountId, userId);

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error('Error getting account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get account'
      });
    }
  }

  async getAccountsByFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { 
        includePersonal, 
        accountType, 
        assetId, 
        userId: filterUserId 
      } = req.query;

      const options: GetAccountsOptions = {};
      
      if (includePersonal !== undefined) {
        options.includePersonal = includePersonal === 'true';
      }
      
      if (accountType && typeof accountType === 'string') {
        options.accountType = accountType as AccountType;
      }
      
      if (assetId && typeof assetId === 'string') {
        options.assetId = assetId;
      }
      
      if (filterUserId && typeof filterUserId === 'string') {
        options.userId = filterUserId;
      }

      const accounts = await accountService.getAccountsByFam(famId, userId, options);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error getting accounts:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get accounts'
      });
    }
  }

  async updateAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      const data: UpdateAccountRequest = req.body;
      const account = await accountService.updateAccount(accountId, userId, data);

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error('Error updating account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update account'
      });
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      await accountService.deleteAccount(accountId, userId);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to delete account'
      });
    }
  }

  async getAccountsByAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { assetId } = req.params;
      const accounts = await accountService.getAccountsByAsset(assetId, userId);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error getting accounts by asset:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get accounts by asset'
      });
    }
  }

  async getPersonalAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const accounts = await accountService.getPersonalAccounts(userId, famId);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error getting personal accounts:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get personal accounts'
      });
    }
  }

  async createPersonalAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const data = req.body;
      const account = await accountService.createPersonalAccount(userId, data);

      res.status(201).json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error('Error creating personal account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create personal account'
      });
    }
  }

  async updatePersonalAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      const data: UpdateAccountRequest = req.body;
      const account = await accountService.updatePersonalAccount(accountId, userId, data);

      res.json({
        success: true,
        data: account
      });
    } catch (error) {
      logger.error('Error updating personal account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update personal account'
      });
    }
  }

  async deletePersonalAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      await accountService.deletePersonalAccount(accountId, userId);

      res.json({
        success: true,
        message: 'Personal account deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting personal account:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to delete personal account'
      });
    }
  }

  async getPersonalAccountsByType(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, accountType } = req.params;
      
      if (!Object.values(AccountType).includes(accountType as AccountType)) {
        res.status(400).json({ error: 'Invalid account type' });
        return;
      }

      const accounts = await accountService.getPersonalAccountsByType(
        userId, 
        famId, 
        accountType as AccountType
      );

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error getting personal accounts by type:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get personal accounts by type'
      });
    }
  }

  async checkPersonalAccountAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountId } = req.params;
      const hasAccess = await accountService.canUserAccessPersonalAccount(accountId, userId);

      res.json({
        success: true,
        data: {
          hasAccess,
          accountId,
          userId
        }
      });
    } catch (error) {
      logger.error('Error checking personal account access:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to check personal account access'
      });
    }
  }

  async searchAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { q: query } = req.query;

      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      const accounts = await accountService.searchAccounts(famId, userId, query);

      res.json({
        success: true,
        data: accounts
      });
    } catch (error) {
      logger.error('Error searching accounts:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to search accounts'
      });
    }
  }

  // UK-specific endpoints
  async getUKAccountTypes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const accountTypes = accountService.getUKAccountTypes();

      res.json({
        success: true,
        data: accountTypes
      });
    } catch (error) {
      logger.error('Error getting UK account types:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get UK account types'
      });
    }
  }

  async getAccountTypeInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { accountType } = req.params;
      
      if (!Object.values(AccountType).includes(accountType as AccountType)) {
        res.status(400).json({ error: 'Invalid account type' });
        return;
      }

      const typeInfo = accountService.getAccountTypeInfo(accountType as AccountType);

      res.json({
        success: true,
        data: typeInfo
      });
    } catch (error) {
      logger.error('Error getting account type info:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get account type info'
      });
    }
  }

  async getAccountTypesByCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { category } = req.params;
      
      if (!['household', 'personal', 'custom'].includes(category)) {
        res.status(400).json({ error: 'Invalid category. Must be household, personal, or custom' });
        return;
      }

      const accountTypes = accountService.getAccountTypesByCategory(category as 'household' | 'personal' | 'custom');

      res.json({
        success: true,
        data: accountTypes
      });
    } catch (error) {
      logger.error('Error getting account types by category:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get account types by category'
      });
    }
  }

  // Notification and reminder endpoints
  async getUpcomingObligations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { daysAhead } = req.query;

      const daysAheadNum = daysAhead && typeof daysAhead === 'string' 
        ? parseInt(daysAhead, 10) 
        : 30;

      if (isNaN(daysAheadNum) || daysAheadNum < 0 || daysAheadNum > 365) {
        res.status(400).json({ error: 'daysAhead must be a number between 0 and 365' });
        return;
      }

      const obligations = await notificationService.getUpcomingObligations(famId, userId, daysAheadNum);

      res.json({
        success: true,
        data: obligations
      });
    } catch (error) {
      logger.error('Error getting upcoming obligations:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get upcoming obligations'
      });
    }
  }

  async getNotificationSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { daysAhead } = req.query;

      const daysAheadNum = daysAhead && typeof daysAhead === 'string' 
        ? parseInt(daysAhead, 10) 
        : 30;

      if (isNaN(daysAheadNum) || daysAheadNum < 0 || daysAheadNum > 365) {
        res.status(400).json({ error: 'daysAhead must be a number between 0 and 365' });
        return;
      }

      const summary = await notificationService.getNotificationSummary(famId, userId, daysAheadNum);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting notification summary:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get notification summary'
      });
    }
  }

  async getOverdueObligations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const obligations = await notificationService.getOverdueObligations(famId, userId);

      res.json({
        success: true,
        data: obligations
      });
    } catch (error) {
      logger.error('Error getting overdue obligations:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get overdue obligations'
      });
    }
  }

  async getObligationsDueWithin(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, days } = req.params;
      const daysNum = parseInt(days, 10);

      if (isNaN(daysNum) || daysNum < 0 || daysNum > 365) {
        res.status(400).json({ error: 'Days must be a number between 0 and 365' });
        return;
      }

      const obligations = await notificationService.getObligationsDueWithin(famId, userId, daysNum);

      res.json({
        success: true,
        data: obligations
      });
    } catch (error) {
      logger.error('Error getting obligations due within timeframe:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get obligations due within timeframe'
      });
    }
  }

  async getObligationsByUrgency(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, urgency } = req.params;

      if (!['low', 'medium', 'high', 'overdue'].includes(urgency)) {
        res.status(400).json({ error: 'Urgency must be low, medium, high, or overdue' });
        return;
      }

      const obligations = await notificationService.getObligationsByUrgency(
        famId, 
        userId, 
        urgency as 'low' | 'medium' | 'high' | 'overdue'
      );

      res.json({
        success: true,
        data: obligations
      });
    } catch (error) {
      logger.error('Error getting obligations by urgency:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get obligations by urgency'
      });
    }
  }

  async getAccountsNeedingAttention(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const accountsNeedingAttention = await notificationService.getAccountsNeedingAttention(famId, userId);

      res.json({
        success: true,
        data: accountsNeedingAttention
      });
    } catch (error) {
      logger.error('Error getting accounts needing attention:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get accounts needing attention'
      });
    }
  }
}

export const accountController = new AccountController();