import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { AssetType } from '../../src/models/types';

describe('Asset API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let famId: string;
  let assetId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.asset.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    expect(userResponse.status).toBe(201);
    authToken = userResponse.body.data.accessToken;
    userId = userResponse.body.data.user.id;

    // Create test Fam
    const famResponse = await request(app)
      .post('/api/fams')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Family'
      });

    expect(famResponse.status).toBe(201);
    famId = famResponse.body.data.id;
  });

  afterEach(async () => {
    // Clean up database
    await prisma.asset.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/assets/fam/:famId', () => {
    it('should create a new asset', async () => {
      const assetData = {
        type: AssetType.HOME,
        name: 'Family Home',
        description: 'Our main residence',
        customFields: {
          address: '123 Main St',
          bedrooms: 3,
          bathrooms: 2
        }
      };

      const response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assetData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        famId,
        type: assetData.type,
        name: assetData.name,
        description: assetData.description,
        customFields: assetData.customFields
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.createdAt).toBeDefined();

      assetId = response.body.data.id;
    });

    it('should return 400 for invalid asset data', async () => {
      const invalidData = {
        type: AssetType.HOME,
        name: '', // Invalid: empty name
        description: 'Test'
      };

      const response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 401 without authentication', async () => {
      const assetData = {
        type: AssetType.HOME,
        name: 'Test Asset'
      };

      const response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .send(assetData);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-member user', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      const otherToken = otherUserResponse.body.data.accessToken;

      const assetData = {
        type: AssetType.HOME,
        name: 'Test Asset'
      };

      const response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(assetData);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/assets/fam/:famId', () => {
    beforeEach(async () => {
      // Create test assets
      const asset1Response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Family Home',
          description: 'Main residence'
        });

      const asset2Response = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.VEHICLE,
          name: 'Family Car',
          description: 'Daily driver'
        });

      expect(asset1Response.status).toBe(201);
      expect(asset2Response.status).toBe(201);
    });

    it('should return all assets for a Fam', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('type');
      expect(response.body.data[0]).toHaveProperty('famId', famId);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/assets/:assetId', () => {
    beforeEach(async () => {
      const assetResponse = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Test Asset',
          description: 'Test description'
        });

      assetId = assetResponse.body.data.id;
    });

    it('should return asset details', async () => {
      const response = await request(app)
        .get(`/api/assets/${assetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: assetId,
        famId,
        type: AssetType.HOME,
        name: 'Test Asset',
        description: 'Test description'
      });
    });

    it('should return 404 for non-existent asset', async () => {
      const response = await request(app)
        .get('/api/assets/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/assets/:assetId', () => {
    beforeEach(async () => {
      const assetResponse = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Original Asset',
          description: 'Original description'
        });

      assetId = assetResponse.body.data.id;
    });

    it('should update asset successfully', async () => {
      const updateData = {
        name: 'Updated Asset',
        description: 'Updated description',
        customFields: {
          newField: 'newValue'
        }
      };

      const response = await request(app)
        .put(`/api/assets/${assetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: assetId,
        name: updateData.name,
        description: updateData.description,
        customFields: updateData.customFields
      });
    });

    it('should return 400 for invalid update data', async () => {
      const invalidData = {
        name: '' // Invalid: empty name
      };

      const response = await request(app)
        .put(`/api/assets/${assetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/assets/:assetId', () => {
    beforeEach(async () => {
      const assetResponse = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Asset to Delete',
          description: 'Will be deleted'
        });

      assetId = assetResponse.body.data.id;
    });

    it('should delete asset successfully', async () => {
      const response = await request(app)
        .delete(`/api/assets/${assetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Asset deleted successfully');

      // Verify asset is deleted
      const getResponse = await request(app)
        .get(`/api/assets/${assetId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent asset', async () => {
      const response = await request(app)
        .delete('/api/assets/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/assets/fam/:famId/search', () => {
    beforeEach(async () => {
      // Create test assets with different names
      await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Family Home',
          description: 'Main residence'
        });

      await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.VEHICLE,
          name: 'Family Car',
          description: 'Daily driver'
        });

      await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.CUSTOM,
          name: 'Boat',
          description: 'Weekend fun'
        });
    });

    it('should search assets by name', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}/search`)
        .query({ q: 'family' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Family Home and Family Car
      expect(response.body.data.every((asset: any) => 
        asset.name.toLowerCase().includes('family')
      )).toBe(true);
    });

    it('should search assets by description', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}/search`)
        .query({ q: 'driver' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Family Car');
    });

    it('should return 400 for missing search query', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}/search`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Search query is required');
    });

    it('should return 400 for short search query', async () => {
      const response = await request(app)
        .get(`/api/assets/fam/${famId}/search`)
        .query({ q: 'a' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/assets/:assetId/accounts', () => {
    beforeEach(async () => {
      const assetResponse = await request(app)
        .post(`/api/assets/fam/${famId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: AssetType.HOME,
          name: 'Test Asset with Accounts',
          description: 'Asset for account testing'
        });

      assetId = assetResponse.body.data.id;
    });

    it('should return asset with accounts', async () => {
      const response = await request(app)
        .get(`/api/assets/${assetId}/accounts`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accounts');
      expect(Array.isArray(response.body.data.accounts)).toBe(true);
    });
  });

  describe('Template API Endpoints', () => {
    describe('GET /api/assets/templates', () => {
      it('should return all available templates', async () => {
        const response = await request(app)
          .get('/api/assets/templates')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        
        // Check template structure
        const template = response.body.data[0];
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('type');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('category');
        expect(template).toHaveProperty('suggestedCustomFields');
      });

      it('should filter templates by type', async () => {
        const response = await request(app)
          .get('/api/assets/templates')
          .query({ type: AssetType.HOME })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.every((t: any) => t.type === AssetType.HOME)).toBe(true);
      });

      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .get('/api/assets/templates');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/assets/templates/categories', () => {
      it('should return template categories', async () => {
        const response = await request(app)
          .get('/api/assets/templates/categories')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data).toContain('UK Residential Property');
        expect(response.body.data).toContain('UK Motor Vehicle');
      });
    });

    describe('GET /api/assets/templates/:templateId', () => {
      it('should return specific template', async () => {
        const response = await request(app)
          .get('/api/assets/templates/uk-home-detached')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe('uk-home-detached');
        expect(response.body.data.name).toBe('Detached House');
        expect(response.body.data.type).toBe(AssetType.HOME);
      });

      it('should return 404 for non-existent template', async () => {
        const response = await request(app)
          .get('/api/assets/templates/non-existent')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/assets/templates/:templateId/validate', () => {
      it('should validate template data successfully', async () => {
        const customValues = {
          address: '123 Main Street',
          postcode: 'SW1A 1AA',
          bedrooms: 3,
          councilTaxBand: 'D'
        };

        const response = await request(app)
          .post('/api/assets/templates/uk-home-detached/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ customValues });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(true);
        expect(response.body.data.errors).toEqual([]);
      });

      it('should return validation errors for invalid data', async () => {
        const customValues = {
          bedrooms: 'three' // Should be number
        };

        const response = await request(app)
          .post('/api/assets/templates/uk-home-detached/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ customValues });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.isValid).toBe(false);
        expect(response.body.data.errors.length).toBeGreaterThan(0);
      });

      it('should return 400 for missing custom values', async () => {
        const response = await request(app)
          .post('/api/assets/templates/uk-home-detached/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/assets/fam/:famId/from-template', () => {
      it('should create asset from template successfully', async () => {
        const templateData = {
          templateId: 'uk-home-detached',
          name: 'My Family Home',
          description: 'Our lovely detached house',
          customValues: {
            address: '123 Main Street',
            postcode: 'SW1A 1AA',
            bedrooms: 4,
            bathrooms: 2,
            councilTaxBand: 'E'
          }
        };

        const response = await request(app)
          .post(`/api/assets/fam/${famId}/from-template`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(templateData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('My Family Home');
        expect(response.body.data.type).toBe(AssetType.HOME);
        expect(response.body.data.customFields).toMatchObject({
          propertyType: 'Detached House',
          country: 'United Kingdom',
          address: '123 Main Street',
          postcode: 'SW1A 1AA',
          bedrooms: 4,
          bathrooms: 2,
          councilTaxBand: 'E'
        });
      });

      it('should return 400 for missing template ID', async () => {
        const response = await request(app)
          .post(`/api/assets/fam/${famId}/from-template`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Asset'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Template ID is required');
      });

      it('should return 400 for missing asset name', async () => {
        const response = await request(app)
          .post(`/api/assets/fam/${famId}/from-template`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateId: 'uk-home-detached'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Asset name must be at least 2 characters long');
      });

      it('should return 400 for non-existent template', async () => {
        const response = await request(app)
          .post(`/api/assets/fam/${famId}/from-template`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateId: 'non-existent-template',
            name: 'Test Asset'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Template with ID non-existent-template not found');
      });

      it('should return 400 for invalid template data', async () => {
        const response = await request(app)
          .post(`/api/assets/fam/${famId}/from-template`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateId: 'uk-home-detached',
            name: 'Test Asset',
            customValues: {
              bedrooms: 'invalid' // Should be number
            }
          });

        expect(response.status).toBe(400);
      });
    });
  });
});