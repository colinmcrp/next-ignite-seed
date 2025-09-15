import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Asset, CreateAssetRequest, UpdateAssetRequest } from '../models/types';
import { validateCreateAsset, validateCustomFields } from '../models/validation';
import { famService } from './famService';
import { assetTemplateService, AssetTemplate } from './assetTemplateService';

export interface CreateAssetFromTemplateRequest {
  templateId: string;
  name: string;
  description?: string;
  customValues?: Record<string, any>;
}

export class AssetService {
  async createAssetFromTemplate(famId: string, userId: string, data: CreateAssetFromTemplateRequest): Promise<Asset> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Get template
    const template = assetTemplateService.getTemplateById(data.templateId);
    if (!template) {
      throw new Error(`Template with ID ${data.templateId} not found`);
    }

    // Apply template with custom values
    const customFields = assetTemplateService.applyTemplate(data.templateId, data.customValues);

    // Create asset using template
    const asset = await prisma.asset.create({
      data: {
        famId,
        type: template.type,
        name: data.name.trim(),
        description: data.description?.trim(),
        customFields
      },
      include: {
        accounts: true
      }
    });

    logger.info(`Asset created from template ${data.templateId}: ${data.name} in Fam ${famId} by user ${userId}`);

    return asset;
  }

  async createAsset(famId: string, userId: string, data: CreateAssetRequest): Promise<Asset> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate input data
    const validation = validateCreateAsset(data);
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

    const { type, name, description, customFields } = data;

    // Create asset
    const asset = await prisma.asset.create({
      data: {
        famId,
        type,
        name: name.trim(),
        description: description?.trim(),
        customFields: customFields || {}
      },
      include: {
        accounts: true
      }
    });

    logger.info(`Asset created: ${name} (${type}) in Fam ${famId} by user ${userId}`);

    return asset;
  }

  async getAssetById(assetId: string, userId: string): Promise<Asset> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        accounts: {
          include: {
            accountHolder: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Verify user has access to this Fam
    await famService.verifyFamMembership(asset.famId, userId);

    return asset;
  }

  async getAssetsByFam(famId: string, userId: string): Promise<Asset[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const assets = await prisma.asset.findMany({
      where: { famId },
      include: {
        accounts: {
          include: {
            accountHolder: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return assets;
  }

  async updateAsset(assetId: string, userId: string, data: UpdateAssetRequest): Promise<Asset> {
    // Get existing asset and verify access
    const existingAsset = await this.getAssetById(assetId, userId);

    // Validate custom fields if provided
    if (data.customFields) {
      const customFieldsValidation = validateCustomFields(data.customFields);
      if (!customFieldsValidation.isValid) {
        throw new Error(`Custom fields validation failed: ${customFieldsValidation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // Validate other fields
    if (data.name !== undefined && (!data.name || data.name.trim().length < 2)) {
      throw new Error('Asset name must be at least 2 characters long');
    }

    const updateData: any = {};
    
    if (data.type !== undefined) updateData.type = data.type;
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim();
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    const asset = await prisma.asset.update({
      where: { id: assetId },
      data: updateData,
      include: {
        accounts: {
          include: {
            accountHolder: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    logger.info(`Asset updated: ${assetId} by user ${userId}`);

    return asset;
  }

  async deleteAsset(assetId: string, userId: string): Promise<void> {
    // Get existing asset and verify access
    const existingAsset = await this.getAssetById(assetId, userId);

    // Check if asset has associated accounts
    const accountCount = await prisma.account.count({
      where: { assetId }
    });

    if (accountCount > 0) {
      throw new Error('Cannot delete asset with associated accounts. Please remove or reassign accounts first.');
    }

    await prisma.asset.delete({
      where: { id: assetId }
    });

    logger.info(`Asset deleted: ${assetId} by user ${userId}`);
  }

  async getAssetWithAccounts(assetId: string, userId: string): Promise<Asset> {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        accounts: {
          include: {
            accountHolder: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            documents: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Verify user has access to this Fam
    await famService.verifyFamMembership(asset.famId, userId);

    return asset;
  }

  async searchAssets(famId: string, userId: string, query: string): Promise<Asset[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    if (!query || query.trim().length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    const assets = await prisma.asset.findMany({
      where: {
        famId,
        OR: [
          {
            name: {
              contains: query.trim(),
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: query.trim(),
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        accounts: {
          include: {
            accountHolder: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return assets;
  }

  // Template-related methods
  getAvailableTemplates(): AssetTemplate[] {
    return assetTemplateService.getAllTemplates();
  }

  getTemplatesByType(type: string): AssetTemplate[] {
    return assetTemplateService.getTemplatesByType(type as any);
  }

  getTemplateById(templateId: string): AssetTemplate | null {
    return assetTemplateService.getTemplateById(templateId);
  }

  getTemplateCategories(): string[] {
    return assetTemplateService.getCategories();
  }

  validateTemplateData(templateId: string, customValues: Record<string, any>): { isValid: boolean; errors: string[] } {
    try {
      assetTemplateService.applyTemplate(templateId, customValues);
      return { isValid: true, errors: [] };
    } catch (error) {
      return { 
        isValid: false, 
        errors: [error instanceof Error ? error.message : 'Template validation failed'] 
      };
    }
  }
}

export const assetService = new AssetService();