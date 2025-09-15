import { AssetType } from '../models/types';

export interface AssetTemplate {
  id: string;
  type: AssetType;
  name: string;
  description: string;
  category: string;
  predefinedFields: Record<string, any>;
  suggestedCustomFields: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    description: string;
    required?: boolean;
    options?: string[]; // For select fields
  }>;
}

export class AssetTemplateService {
  private templates: AssetTemplate[] = [
    // Home Asset Templates
    {
      id: 'uk-home-detached',
      type: AssetType.HOME,
      name: 'Detached House',
      description: 'A standalone house not attached to any other building',
      category: 'UK Residential Property',
      predefinedFields: {
        propertyType: 'Detached House',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'address',
          type: 'string',
          description: 'Full property address',
          required: true
        },
        {
          name: 'postcode',
          type: 'string',
          description: 'UK postcode',
          required: true
        },
        {
          name: 'bedrooms',
          type: 'number',
          description: 'Number of bedrooms'
        },
        {
          name: 'bathrooms',
          type: 'number',
          description: 'Number of bathrooms'
        },
        {
          name: 'garages',
          type: 'number',
          description: 'Number of garages/parking spaces'
        },
        {
          name: 'gardenSize',
          type: 'string',
          description: 'Garden size description',
          options: ['None', 'Small', 'Medium', 'Large', 'Very Large']
        },
        {
          name: 'yearBuilt',
          type: 'number',
          description: 'Year the property was built'
        },
        {
          name: 'councilTaxBand',
          type: 'string',
          description: 'Council tax band',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        },
        {
          name: 'tenure',
          type: 'string',
          description: 'Property tenure type',
          options: ['Freehold', 'Leasehold', 'Shared Ownership']
        },
        {
          name: 'epcRating',
          type: 'string',
          description: 'Energy Performance Certificate rating',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        }
      ]
    },
    {
      id: 'uk-home-semi-detached',
      type: AssetType.HOME,
      name: 'Semi-Detached House',
      description: 'A house joined to another house on one side',
      category: 'UK Residential Property',
      predefinedFields: {
        propertyType: 'Semi-Detached House',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'address',
          type: 'string',
          description: 'Full property address',
          required: true
        },
        {
          name: 'postcode',
          type: 'string',
          description: 'UK postcode',
          required: true
        },
        {
          name: 'bedrooms',
          type: 'number',
          description: 'Number of bedrooms'
        },
        {
          name: 'bathrooms',
          type: 'number',
          description: 'Number of bathrooms'
        },
        {
          name: 'parking',
          type: 'string',
          description: 'Parking arrangements',
          options: ['None', 'On-street', 'Driveway', 'Garage']
        },
        {
          name: 'gardenSize',
          type: 'string',
          description: 'Garden size description',
          options: ['None', 'Small', 'Medium', 'Large']
        },
        {
          name: 'yearBuilt',
          type: 'number',
          description: 'Year the property was built'
        },
        {
          name: 'councilTaxBand',
          type: 'string',
          description: 'Council tax band',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        },
        {
          name: 'tenure',
          type: 'string',
          description: 'Property tenure type',
          options: ['Freehold', 'Leasehold', 'Shared Ownership']
        },
        {
          name: 'epcRating',
          type: 'string',
          description: 'Energy Performance Certificate rating',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        }
      ]
    },
    {
      id: 'uk-home-terraced',
      type: AssetType.HOME,
      name: 'Terraced House',
      description: 'A house in a row of similar houses joined together',
      category: 'UK Residential Property',
      predefinedFields: {
        propertyType: 'Terraced House',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'address',
          type: 'string',
          description: 'Full property address',
          required: true
        },
        {
          name: 'postcode',
          type: 'string',
          description: 'UK postcode',
          required: true
        },
        {
          name: 'bedrooms',
          type: 'number',
          description: 'Number of bedrooms'
        },
        {
          name: 'bathrooms',
          type: 'number',
          description: 'Number of bathrooms'
        },
        {
          name: 'parking',
          type: 'string',
          description: 'Parking arrangements',
          options: ['None', 'On-street', 'Rear access', 'Permit parking']
        },
        {
          name: 'gardenType',
          type: 'string',
          description: 'Garden type',
          options: ['None', 'Front only', 'Rear only', 'Front and rear', 'Courtyard']
        },
        {
          name: 'yearBuilt',
          type: 'number',
          description: 'Year the property was built'
        },
        {
          name: 'councilTaxBand',
          type: 'string',
          description: 'Council tax band',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        },
        {
          name: 'tenure',
          type: 'string',
          description: 'Property tenure type',
          options: ['Freehold', 'Leasehold', 'Shared Ownership']
        },
        {
          name: 'epcRating',
          type: 'string',
          description: 'Energy Performance Certificate rating',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        }
      ]
    },
    {
      id: 'uk-home-flat',
      type: AssetType.HOME,
      name: 'Flat/Apartment',
      description: 'A self-contained housing unit within a larger building',
      category: 'UK Residential Property',
      predefinedFields: {
        propertyType: 'Flat/Apartment',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'address',
          type: 'string',
          description: 'Full property address including flat number',
          required: true
        },
        {
          name: 'postcode',
          type: 'string',
          description: 'UK postcode',
          required: true
        },
        {
          name: 'floor',
          type: 'string',
          description: 'Floor level',
          options: ['Ground', '1st', '2nd', '3rd', '4th', '5th+', 'Basement']
        },
        {
          name: 'bedrooms',
          type: 'number',
          description: 'Number of bedrooms'
        },
        {
          name: 'bathrooms',
          type: 'number',
          description: 'Number of bathrooms'
        },
        {
          name: 'parking',
          type: 'string',
          description: 'Parking arrangements',
          options: ['None', 'On-street', 'Allocated space', 'Underground garage']
        },
        {
          name: 'balcony',
          type: 'boolean',
          description: 'Has balcony or terrace'
        },
        {
          name: 'lift',
          type: 'boolean',
          description: 'Building has lift access'
        },
        {
          name: 'yearBuilt',
          type: 'number',
          description: 'Year the building was built'
        },
        {
          name: 'councilTaxBand',
          type: 'string',
          description: 'Council tax band',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        },
        {
          name: 'tenure',
          type: 'string',
          description: 'Property tenure type',
          options: ['Freehold', 'Leasehold', 'Shared Ownership']
        },
        {
          name: 'leaseYearsRemaining',
          type: 'number',
          description: 'Years remaining on lease (if leasehold)'
        },
        {
          name: 'serviceCharge',
          type: 'number',
          description: 'Annual service charge (£)'
        },
        {
          name: 'groundRent',
          type: 'number',
          description: 'Annual ground rent (£)'
        },
        {
          name: 'epcRating',
          type: 'string',
          description: 'Energy Performance Certificate rating',
          options: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
        }
      ]
    },
    // Vehicle Asset Templates
    {
      id: 'uk-vehicle-car',
      type: AssetType.VEHICLE,
      name: 'Car',
      description: 'Personal motor vehicle',
      category: 'UK Motor Vehicle',
      predefinedFields: {
        vehicleType: 'Car',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'make',
          type: 'string',
          description: 'Vehicle manufacturer',
          required: true
        },
        {
          name: 'model',
          type: 'string',
          description: 'Vehicle model',
          required: true
        },
        {
          name: 'year',
          type: 'number',
          description: 'Year of manufacture',
          required: true
        },
        {
          name: 'registrationNumber',
          type: 'string',
          description: 'UK registration plate'
        },
        {
          name: 'colour',
          type: 'string',
          description: 'Vehicle colour'
        },
        {
          name: 'fuelType',
          type: 'string',
          description: 'Fuel type',
          options: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid']
        },
        {
          name: 'engineSize',
          type: 'string',
          description: 'Engine size (e.g., 1.6L, 2.0L)'
        },
        {
          name: 'mileage',
          type: 'number',
          description: 'Current mileage'
        },
        {
          name: 'motExpiry',
          type: 'date',
          description: 'MOT expiry date'
        },
        {
          name: 'taxExpiry',
          type: 'date',
          description: 'Road tax expiry date'
        },
        {
          name: 'insuranceExpiry',
          type: 'date',
          description: 'Insurance expiry date'
        },
        {
          name: 'purchaseDate',
          type: 'date',
          description: 'Date of purchase'
        },
        {
          name: 'purchasePrice',
          type: 'number',
          description: 'Purchase price (£)'
        }
      ]
    },
    {
      id: 'uk-vehicle-motorcycle',
      type: AssetType.VEHICLE,
      name: 'Motorcycle',
      description: 'Motor bike or scooter',
      category: 'UK Motor Vehicle',
      predefinedFields: {
        vehicleType: 'Motorcycle',
        country: 'United Kingdom'
      },
      suggestedCustomFields: [
        {
          name: 'make',
          type: 'string',
          description: 'Vehicle manufacturer',
          required: true
        },
        {
          name: 'model',
          type: 'string',
          description: 'Vehicle model',
          required: true
        },
        {
          name: 'year',
          type: 'number',
          description: 'Year of manufacture',
          required: true
        },
        {
          name: 'registrationNumber',
          type: 'string',
          description: 'UK registration plate'
        },
        {
          name: 'colour',
          type: 'string',
          description: 'Vehicle colour'
        },
        {
          name: 'engineSize',
          type: 'string',
          description: 'Engine size (e.g., 125cc, 600cc)'
        },
        {
          name: 'mileage',
          type: 'number',
          description: 'Current mileage'
        },
        {
          name: 'motExpiry',
          type: 'date',
          description: 'MOT expiry date'
        },
        {
          name: 'taxExpiry',
          type: 'date',
          description: 'Road tax expiry date'
        },
        {
          name: 'insuranceExpiry',
          type: 'date',
          description: 'Insurance expiry date'
        },
        {
          name: 'purchaseDate',
          type: 'date',
          description: 'Date of purchase'
        },
        {
          name: 'purchasePrice',
          type: 'number',
          description: 'Purchase price (£)'
        }
      ]
    }
  ];

  getTemplatesByType(type: AssetType): AssetTemplate[] {
    return this.templates.filter(template => template.type === type);
  }

  getTemplateById(templateId: string): AssetTemplate | null {
    return this.templates.find(template => template.id === templateId) || null;
  }

  getAllTemplates(): AssetTemplate[] {
    return [...this.templates];
  }

  getTemplatesByCategory(category: string): AssetTemplate[] {
    return this.templates.filter(template => template.category === category);
  }

  getCategories(): string[] {
    const categories = new Set(this.templates.map(template => template.category));
    return Array.from(categories);
  }

  applyTemplate(templateId: string, customValues: Record<string, any> = {}): Record<string, any> {
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Start with predefined fields
    const result = { ...template.predefinedFields };

    // Apply custom values, validating against suggested fields
    for (const [key, value] of Object.entries(customValues)) {
      const suggestedField = template.suggestedCustomFields.find(field => field.name === key);
      
      if (suggestedField) {
        // Validate the value type if it's a suggested field
        if (!this.validateFieldValue(value, suggestedField)) {
          throw new Error(`Invalid value for field ${key}: expected ${suggestedField.type}`);
        }
      }
      
      result[key] = value;
    }

    // Check for required fields
    const missingRequired = template.suggestedCustomFields
      .filter(field => field.required && !(field.name in result))
      .map(field => field.name);

    if (missingRequired.length > 0) {
      throw new Error(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    return result;
  }

  private validateFieldValue(value: any, field: { type: string; options?: string[] }): boolean {
    // Check type
    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') return false;
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) return false;
        break;
      case 'boolean':
        if (typeof value !== 'boolean') return false;
        break;
      case 'date':
        if (!(value instanceof Date) && typeof value !== 'string') return false;
        if (typeof value === 'string' && isNaN(Date.parse(value))) return false;
        break;
      default:
        return false;
    }

    // Check options if provided
    if (field.options && field.type === 'string') {
      return field.options.includes(value as string);
    }

    return true;
  }
}

export const assetTemplateService = new AssetTemplateService();