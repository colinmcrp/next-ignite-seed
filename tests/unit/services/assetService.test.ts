import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AssetService } from '../../../src/services/assetService';
import { prisma } from '../../../src/lib/prisma';
import { famService } from '../../../src/services/famService';
import { AssetType } from '../../../src/models/types';

// Mock dependencies
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    asset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    account: {
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

describe('AssetService', () => {
  let assetService: AssetService;
  const mockUserId = 'user-123';
  const mockFamId = 'fam-123';
  const mockAssetId = 'asset-123';

  beforeEach(() => {
    assetService = new AssetService();
    vi.clearAllMocks();
  });

  describe('createAsset', () => {
    const validAssetData = {
      type: AssetType.HOME,
      name: 'Family Home',
      description: 'Our main residence',
      customFields: { address: '123 Main St' }
    };

    it('should create an asset successfully', async () => {
      const mockAsset = {
        id: mockAssetId,
        famId: mockFamId,
        ...validAssetData,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.asset.create as Mock).mockResolvedValue(mockAsset);

      const result = await assetService.createAsset(mockFamId, mockUserId, validAssetData);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.asset.create).toHaveBeenCalledWith({
        data: {
          famId: mockFamId,
          type: validAssetData.type,
          name: validAssetData.name,
          description: validAssetData.description,
          customFields: validAssetData.customFields
        },
        include: {
          accounts: true
        }
      });
      expect(result).toEqual(mockAsset);
    });

    it('should throw error if user is not a Fam member', async () => {
      (famService.verifyFamMembership as Mock).mockRejectedValue(new Error('Access denied'));

      await expect(
        assetService.createAsset(mockFamId, mockUserId, validAssetData)
      ).rejects.toThrow('Access denied');

      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid asset data', async () => {
      const invalidData = {
        type: AssetType.HOME,
        name: '', // Invalid: empty name
        description: 'Test'
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.createAsset(mockFamId, mockUserId, invalidData)
      ).rejects.toThrow('Validation failed');

      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid custom fields', async () => {
      const invalidData = {
        type: AssetType.HOME,
        name: 'Test Asset',
        customFields: { id: 'reserved-field' } // Invalid: reserved field
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.createAsset(mockFamId, mockUserId, invalidData)
      ).rejects.toThrow('Custom fields validation failed');

      expect(prisma.asset.create).not.toHaveBeenCalled();
    });
  });

  describe('getAssetById', () => {
    it('should return asset if user has access', async () => {
      const mockAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Family Home',
        description: 'Our main residence',
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: []
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(mockAsset);
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      const result = await assetService.getAssetById(mockAssetId, mockUserId);

      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { id: mockAssetId },
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
      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(result).toEqual(mockAsset);
    });

    it('should throw error if asset not found', async () => {
      (prisma.asset.findUnique as Mock).mockResolvedValue(null);

      await expect(
        assetService.getAssetById(mockAssetId, mockUserId)
      ).rejects.toThrow('Asset not found');

      expect(famService.verifyFamMembership).not.toHaveBeenCalled();
    });

    it('should throw error if user has no access to Fam', async () => {
      const mockAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Family Home',
        accounts: []
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(mockAsset);
      (famService.verifyFamMembership as Mock).mockRejectedValue(new Error('Access denied'));

      await expect(
        assetService.getAssetById(mockAssetId, mockUserId)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('getAssetsByFam', () => {
    it('should return all assets for a Fam', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          famId: mockFamId,
          type: AssetType.HOME,
          name: 'Family Home',
          accounts: []
        },
        {
          id: 'asset-2',
          famId: mockFamId,
          type: AssetType.VEHICLE,
          name: 'Family Car',
          accounts: []
        }
      ];

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.asset.findMany as Mock).mockResolvedValue(mockAssets);

      const result = await assetService.getAssetsByFam(mockFamId, mockUserId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: { famId: mockFamId },
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
      expect(result).toEqual(mockAssets);
    });
  });

  describe('updateAsset', () => {
    const updateData = {
      name: 'Updated Asset Name',
      description: 'Updated description',
      customFields: { newField: 'value' }
    };

    it('should update asset successfully', async () => {
      const existingAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Original Name',
        accounts: []
      };

      const updatedAsset = {
        ...existingAsset,
        ...updateData
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(existingAsset);
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.asset.update as Mock).mockResolvedValue(updatedAsset);

      const result = await assetService.updateAsset(mockAssetId, mockUserId, updateData);

      expect(prisma.asset.update).toHaveBeenCalledWith({
        where: { id: mockAssetId },
        data: {
          name: updateData.name,
          description: updateData.description,
          customFields: updateData.customFields
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
        }
      });
      expect(result).toEqual(updatedAsset);
    });

    it('should throw error for invalid name', async () => {
      const existingAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Original Name',
        accounts: []
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(existingAsset);
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.updateAsset(mockAssetId, mockUserId, { name: '' })
      ).rejects.toThrow('Asset name must be at least 2 characters long');

      expect(prisma.asset.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteAsset', () => {
    it('should delete asset successfully when no accounts exist', async () => {
      const existingAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Asset to Delete',
        accounts: []
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(existingAsset);
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.account.count as Mock).mockResolvedValue(0);
      (prisma.asset.delete as Mock).mockResolvedValue(existingAsset);

      await assetService.deleteAsset(mockAssetId, mockUserId);

      expect(prisma.account.count).toHaveBeenCalledWith({
        where: { assetId: mockAssetId }
      });
      expect(prisma.asset.delete).toHaveBeenCalledWith({
        where: { id: mockAssetId }
      });
    });

    it('should throw error when asset has associated accounts', async () => {
      const existingAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: 'Asset with Accounts',
        accounts: []
      };

      (prisma.asset.findUnique as Mock).mockResolvedValue(existingAsset);
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.account.count as Mock).mockResolvedValue(2);

      await expect(
        assetService.deleteAsset(mockAssetId, mockUserId)
      ).rejects.toThrow('Cannot delete asset with associated accounts');

      expect(prisma.asset.delete).not.toHaveBeenCalled();
    });
  });

  describe('searchAssets', () => {
    it('should search assets by name and description', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          famId: mockFamId,
          name: 'Home Sweet Home',
          description: 'Family residence',
          accounts: []
        }
      ];

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.asset.findMany as Mock).mockResolvedValue(mockAssets);

      const result = await assetService.searchAssets(mockFamId, mockUserId, 'home');

      expect(prisma.asset.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          OR: [
            {
              name: {
                contains: 'home',
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: 'home',
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
      expect(result).toEqual(mockAssets);
    });

    it('should throw error for short search query', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.searchAssets(mockFamId, mockUserId, 'a')
      ).rejects.toThrow('Search query must be at least 2 characters long');

      expect(prisma.asset.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createAssetFromTemplate', () => {
    const templateData = {
      templateId: 'uk-home-detached',
      name: 'Family Home',
      description: 'Our main residence',
      customValues: {
        address: '123 Main Street',
        postcode: 'SW1A 1AA',
        bedrooms: 3
      }
    };

    it('should create asset from template successfully', async () => {
      const mockAsset = {
        id: mockAssetId,
        famId: mockFamId,
        type: AssetType.HOME,
        name: templateData.name,
        description: templateData.description,
        customFields: {
          propertyType: 'Detached House',
          country: 'United Kingdom',
          ...templateData.customValues
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });
      (prisma.asset.create as Mock).mockResolvedValue(mockAsset);

      const result = await assetService.createAssetFromTemplate(mockFamId, mockUserId, templateData);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.asset.create).toHaveBeenCalledWith({
        data: {
          famId: mockFamId,
          type: AssetType.HOME,
          name: templateData.name,
          description: templateData.description,
          customFields: expect.objectContaining({
            propertyType: 'Detached House',
            country: 'United Kingdom',
            address: '123 Main Street',
            postcode: 'SW1A 1AA',
            bedrooms: 3
          })
        },
        include: {
          accounts: true
        }
      });
      expect(result).toEqual(mockAsset);
    });

    it('should throw error for non-existent template', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.createAssetFromTemplate(mockFamId, mockUserId, {
          ...templateData,
          templateId: 'non-existent-template'
        })
      ).rejects.toThrow('Template with ID non-existent-template not found');

      expect(prisma.asset.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid template data', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue({ role: 'MEMBER' });

      await expect(
        assetService.createAssetFromTemplate(mockFamId, mockUserId, {
          ...templateData,
          customValues: {
            bedrooms: 'invalid' // Should be number
          }
        })
      ).rejects.toThrow('Invalid value for field bedrooms: expected number');

      expect(prisma.asset.create).not.toHaveBeenCalled();
    });
  });

  describe('template methods', () => {
    it('should return all available templates', () => {
      const templates = assetService.getAvailableTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.id === 'uk-home-detached')).toBe(true);
    });

    it('should return templates by type', () => {
      const homeTemplates = assetService.getTemplatesByType('HOME');
      expect(homeTemplates.every(t => t.type === AssetType.HOME)).toBe(true);
    });

    it('should return template by ID', () => {
      const template = assetService.getTemplateById('uk-home-detached');
      expect(template?.id).toBe('uk-home-detached');
    });

    it('should return template categories', () => {
      const categories = assetService.getTemplateCategories();
      expect(categories).toContain('UK Residential Property');
    });

    it('should validate template data', () => {
      const validation = assetService.validateTemplateData('uk-home-detached', {
        address: '123 Main Street',
        postcode: 'SW1A 1AA'
      });
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should return validation errors for invalid data', () => {
      const validation = assetService.validateTemplateData('uk-home-detached', {
        bedrooms: 'invalid'
      });
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});