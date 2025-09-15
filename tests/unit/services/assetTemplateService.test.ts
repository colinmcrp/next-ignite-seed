import { describe, it, expect, beforeEach } from 'vitest';
import { AssetTemplateService } from '../../../src/services/assetTemplateService';
import { AssetType } from '../../../src/models/types';

describe('AssetTemplateService', () => {
  let templateService: AssetTemplateService;

  beforeEach(() => {
    templateService = new AssetTemplateService();
  });

  describe('getTemplatesByType', () => {
    it('should return templates for HOME type', () => {
      const homeTemplates = templateService.getTemplatesByType(AssetType.HOME);
      
      expect(homeTemplates.length).toBeGreaterThan(0);
      expect(homeTemplates.every(template => template.type === AssetType.HOME)).toBe(true);
      
      // Check for expected UK home templates
      const templateNames = homeTemplates.map(t => t.name);
      expect(templateNames).toContain('Detached House');
      expect(templateNames).toContain('Semi-Detached House');
      expect(templateNames).toContain('Terraced House');
      expect(templateNames).toContain('Flat/Apartment');
    });

    it('should return templates for VEHICLE type', () => {
      const vehicleTemplates = templateService.getTemplatesByType(AssetType.VEHICLE);
      
      expect(vehicleTemplates.length).toBeGreaterThan(0);
      expect(vehicleTemplates.every(template => template.type === AssetType.VEHICLE)).toBe(true);
      
      // Check for expected UK vehicle templates
      const templateNames = vehicleTemplates.map(t => t.name);
      expect(templateNames).toContain('Car');
      expect(templateNames).toContain('Motorcycle');
    });

    it('should return empty array for CUSTOM type', () => {
      const customTemplates = templateService.getTemplatesByType(AssetType.CUSTOM);
      expect(customTemplates).toEqual([]);
    });
  });

  describe('getTemplateById', () => {
    it('should return template for valid ID', () => {
      const template = templateService.getTemplateById('uk-home-detached');
      
      expect(template).toBeDefined();
      expect(template?.id).toBe('uk-home-detached');
      expect(template?.name).toBe('Detached House');
      expect(template?.type).toBe(AssetType.HOME);
    });

    it('should return null for invalid ID', () => {
      const template = templateService.getTemplateById('non-existent-template');
      expect(template).toBeNull();
    });
  });

  describe('getAllTemplates', () => {
    it('should return all available templates', () => {
      const allTemplates = templateService.getAllTemplates();
      
      expect(allTemplates.length).toBeGreaterThan(0);
      expect(allTemplates.some(t => t.type === AssetType.HOME)).toBe(true);
      expect(allTemplates.some(t => t.type === AssetType.VEHICLE)).toBe(true);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('should return templates for UK Residential Property category', () => {
      const propertyTemplates = templateService.getTemplatesByCategory('UK Residential Property');
      
      expect(propertyTemplates.length).toBeGreaterThan(0);
      expect(propertyTemplates.every(t => t.category === 'UK Residential Property')).toBe(true);
      expect(propertyTemplates.every(t => t.type === AssetType.HOME)).toBe(true);
    });

    it('should return templates for UK Motor Vehicle category', () => {
      const vehicleTemplates = templateService.getTemplatesByCategory('UK Motor Vehicle');
      
      expect(vehicleTemplates.length).toBeGreaterThan(0);
      expect(vehicleTemplates.every(t => t.category === 'UK Motor Vehicle')).toBe(true);
      expect(vehicleTemplates.every(t => t.type === AssetType.VEHICLE)).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', () => {
      const categories = templateService.getCategories();
      
      expect(categories).toContain('UK Residential Property');
      expect(categories).toContain('UK Motor Vehicle');
      expect(categories.length).toBeGreaterThan(0);
      
      // Check uniqueness
      const uniqueCategories = [...new Set(categories)];
      expect(categories.length).toBe(uniqueCategories.length);
    });
  });

  describe('applyTemplate', () => {
    it('should apply template with custom values successfully', () => {
      const customValues = {
        address: '123 Main Street',
        postcode: 'SW1A 1AA',
        bedrooms: 3,
        bathrooms: 2,
        councilTaxBand: 'D'
      };

      const result = templateService.applyTemplate('uk-home-detached', customValues);

      expect(result).toMatchObject({
        propertyType: 'Detached House',
        country: 'United Kingdom',
        ...customValues
      });
    });

    it('should throw error for non-existent template', () => {
      expect(() => {
        templateService.applyTemplate('non-existent-template', {});
      }).toThrow('Template with ID non-existent-template not found');
    });

    it('should throw error for missing required fields', () => {
      // uk-home-detached template requires address and postcode
      expect(() => {
        templateService.applyTemplate('uk-home-detached', { bedrooms: 3 });
      }).toThrow('Missing required fields: address, postcode');
    });

    it('should validate field types', () => {
      expect(() => {
        templateService.applyTemplate('uk-home-detached', {
          address: '123 Main Street',
          postcode: 'SW1A 1AA',
          bedrooms: 'three' // Should be number
        });
      }).toThrow('Invalid value for field bedrooms: expected number');
    });

    it('should validate option fields', () => {
      expect(() => {
        templateService.applyTemplate('uk-home-detached', {
          address: '123 Main Street',
          postcode: 'SW1A 1AA',
          councilTaxBand: 'Z' // Invalid council tax band
        });
      }).toThrow('Invalid value for field councilTaxBand: expected string');
    });

    it('should accept valid option values', () => {
      const customValues = {
        address: '123 Main Street',
        postcode: 'SW1A 1AA',
        councilTaxBand: 'D',
        tenure: 'Freehold',
        epcRating: 'B'
      };

      const result = templateService.applyTemplate('uk-home-detached', customValues);

      expect(result.councilTaxBand).toBe('D');
      expect(result.tenure).toBe('Freehold');
      expect(result.epcRating).toBe('B');
    });

    it('should handle boolean fields', () => {
      const customValues = {
        address: 'Flat 1, 123 Main Street',
        postcode: 'SW1A 1AA',
        balcony: true,
        lift: false
      };

      const result = templateService.applyTemplate('uk-home-flat', customValues);

      expect(result.balcony).toBe(true);
      expect(result.lift).toBe(false);
    });

    it('should handle date fields', () => {
      const motExpiry = new Date('2024-12-31');
      const customValues = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        motExpiry
      };

      const result = templateService.applyTemplate('uk-vehicle-car', customValues);

      expect(result.motExpiry).toBe(motExpiry);
    });

    it('should handle date strings', () => {
      const customValues = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        motExpiry: '2024-12-31'
      };

      const result = templateService.applyTemplate('uk-vehicle-car', customValues);

      expect(result.motExpiry).toBe('2024-12-31');
    });

    it('should reject invalid date strings', () => {
      expect(() => {
        templateService.applyTemplate('uk-vehicle-car', {
          make: 'Toyota',
          model: 'Corolla',
          year: 2020,
          motExpiry: 'invalid-date'
        });
      }).toThrow('Invalid value for field motExpiry: expected date');
    });
  });

  describe('template structure validation', () => {
    it('should have proper structure for detached house template', () => {
      const template = templateService.getTemplateById('uk-home-detached');
      
      expect(template).toBeDefined();
      expect(template?.predefinedFields).toMatchObject({
        propertyType: 'Detached House',
        country: 'United Kingdom'
      });
      
      const addressField = template?.suggestedCustomFields.find(f => f.name === 'address');
      expect(addressField).toBeDefined();
      expect(addressField?.required).toBe(true);
      expect(addressField?.type).toBe('string');
      
      const councilTaxField = template?.suggestedCustomFields.find(f => f.name === 'councilTaxBand');
      expect(councilTaxField).toBeDefined();
      expect(councilTaxField?.options).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    });

    it('should have proper structure for car template', () => {
      const template = templateService.getTemplateById('uk-vehicle-car');
      
      expect(template).toBeDefined();
      expect(template?.predefinedFields).toMatchObject({
        vehicleType: 'Car',
        country: 'United Kingdom'
      });
      
      const makeField = template?.suggestedCustomFields.find(f => f.name === 'make');
      expect(makeField).toBeDefined();
      expect(makeField?.required).toBe(true);
      expect(makeField?.type).toBe('string');
      
      const fuelTypeField = template?.suggestedCustomFields.find(f => f.name === 'fuelType');
      expect(fuelTypeField).toBeDefined();
      expect(fuelTypeField?.options).toContain('Petrol');
      expect(fuelTypeField?.options).toContain('Electric');
    });
  });
});