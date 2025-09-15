import { Request, Response } from 'express';
import { assetService, CreateAssetFromTemplateRequest } from '../services/assetService';
import { logger } from '../utils/logger';
import { CreateAssetRequest, UpdateAssetRequest } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export class AssetController {
  async createAssetFromTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      if (!famId) {
        res.status(400).json({ error: 'Fam ID is required' });
        return;
      }

      const data: CreateAssetFromTemplateRequest = req.body;
      
      if (!data.templateId) {
        res.status(400).json({ error: 'Template ID is required' });
        return;
      }

      if (!data.name || data.name.trim().length < 2) {
        res.status(400).json({ error: 'Asset name must be at least 2 characters long' });
        return;
      }

      const asset = await assetService.createAssetFromTemplate(famId, userId, data);

      res.status(201).json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error creating asset from template:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create asset from template'
      });
    }
  }

  async createAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      if (!famId) {
        res.status(400).json({ error: 'Fam ID is required' });
        return;
      }

      const data: CreateAssetRequest = req.body;
      const asset = await assetService.createAsset(famId, userId, data);

      res.status(201).json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error creating asset:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create asset'
      });
    }
  }

  async getAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { assetId } = req.params;
      const asset = await assetService.getAssetById(assetId, userId);

      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error getting asset:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get asset'
      });
    }
  }

  async getAssetsByFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const assets = await assetService.getAssetsByFam(famId, userId);

      res.json({
        success: true,
        data: assets
      });
    } catch (error) {
      logger.error('Error getting assets:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get assets'
      });
    }
  }

  async updateAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { assetId } = req.params;
      const data: UpdateAssetRequest = req.body;
      const asset = await assetService.updateAsset(assetId, userId, data);

      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error updating asset:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update asset'
      });
    }
  }

  async deleteAsset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { assetId } = req.params;
      await assetService.deleteAsset(assetId, userId);

      res.json({
        success: true,
        message: 'Asset deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting asset:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to delete asset'
      });
    }
  }

  async getAssetWithAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { assetId } = req.params;
      const asset = await assetService.getAssetWithAccounts(assetId, userId);

      res.json({
        success: true,
        data: asset
      });
    } catch (error) {
      logger.error('Error getting asset with accounts:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get asset with accounts'
      });
    }
  }

  async searchAssets(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      const assets = await assetService.searchAssets(famId, userId, query);

      res.json({
        success: true,
        data: assets
      });
    } catch (error) {
      logger.error('Error searching assets:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to search assets'
      });
    }
  }

  // Template-related endpoints
  async getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { type } = req.query;
      let templates;

      if (type && typeof type === 'string') {
        templates = assetService.getTemplatesByType(type);
      } else {
        templates = assetService.getAvailableTemplates();
      }

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get templates'
      });
    }
  }

  async getTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { templateId } = req.params;
      const template = assetService.getTemplateById(templateId);

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get template'
      });
    }
  }

  async getTemplateCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const categories = assetService.getTemplateCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Error getting template categories:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get template categories'
      });
    }
  }

  async validateTemplateData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { templateId } = req.params;
      const { customValues } = req.body;

      if (!customValues || typeof customValues !== 'object') {
        res.status(400).json({ error: 'Custom values object is required' });
        return;
      }

      const validation = assetService.validateTemplateData(templateId, customValues);

      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      logger.error('Error validating template data:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to validate template data'
      });
    }
  }
}

export const assetController = new AssetController();