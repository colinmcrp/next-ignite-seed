import { describe, it, expect } from 'vitest';
import {
  validateCreateUser,
  validateCreateFam,
  validateCreateAsset,
  validateCreateAccount,
  validateCreatePlan,
  validateCreatePlanTask,
  validateFamMembership,
  validateCustomFields,
  validateRole
} from '../../../src/models/validation';
import {
  AssetType,
  AccountType,
  PlanType,
  Role,
  CreateUserRequest,
  CreateFamRequest,
  CreateAssetRequest,
  CreateAccountRequest,
  CreatePlanRequest,
  CreatePlanTaskRequest
} from '../../../src/models/types';

describe('Model Validation', () => {
  describe('validateCreateUser', () => {
    it('should validate a valid user', () => {
      const validUser: CreateUserRequest = {
        email: 'test@example.com',
        name: 'John Doe'
      };

      const result = validateCreateUser(validUser);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject user with invalid email', () => {
      const invalidUser: CreateUserRequest = {
        email: 'invalid-email',
        name: 'John Doe'
      };

      const result = validateCreateUser(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'email',
        message: 'Invalid email format'
      });
    });

    it('should reject user with missing name', () => {
      const invalidUser: CreateUserRequest = {
        email: 'test@example.com',
        name: ''
      };

      const result = validateCreateUser(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Name is required'
      });
    });

    it('should reject user with short name', () => {
      const invalidUser: CreateUserRequest = {
        email: 'test@example.com',
        name: 'A'
      };

      const result = validateCreateUser(invalidUser);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Name must be at least 2 characters long'
      });
    });
  });

  describe('validateCreateFam', () => {
    it('should validate a valid fam', () => {
      const validFam: CreateFamRequest = {
        name: 'Smith Family'
      };

      const result = validateCreateFam(validFam);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject fam with missing name', () => {
      const invalidFam: CreateFamRequest = {
        name: ''
      };

      const result = validateCreateFam(invalidFam);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Fam name is required'
      });
    });
  });

  describe('validateCreateAsset', () => {
    it('should validate a valid asset', () => {
      const validAsset: CreateAssetRequest = {
        type: AssetType.HOME,
        name: 'Main House',
        description: 'Family home',
        customFields: { address: '123 Main St' }
      };

      const result = validateCreateAsset(validAsset);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject asset with invalid type', () => {
      const invalidAsset: CreateAssetRequest = {
        type: 'INVALID' as AssetType,
        name: 'Main House'
      };

      const result = validateCreateAsset(invalidAsset);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'type',
        message: 'Invalid asset type'
      });
    });

    it('should reject asset with missing name', () => {
      const invalidAsset: CreateAssetRequest = {
        type: AssetType.HOME,
        name: ''
      };

      const result = validateCreateAsset(invalidAsset);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'name',
        message: 'Asset name is required'
      });
    });
  });

  describe('validateCreateAccount', () => {
    it('should validate a valid asset account', () => {
      const validAccount: CreateAccountRequest = {
        assetId: 'asset-123',
        famId: 'fam-123',
        accountHolderId: 'user-123',
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax',
        provider: 'Local Council',
        amount: 150.00,
        dueDate: new Date(Date.now() + 86400000) // tomorrow
      };

      const result = validateCreateAccount(validAccount);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid personal account', () => {
      const validAccount: CreateAccountRequest = {
        userId: 'user-123',
        famId: 'fam-123',
        accountHolderId: 'user-123',
        type: AccountType.MOBILE_CONTRACT,
        name: 'Mobile Phone',
        provider: 'EE'
      };

      const result = validateCreateAccount(validAccount);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject account with both assetId and userId', () => {
      const invalidAccount: CreateAccountRequest = {
        assetId: 'asset-123',
        userId: 'user-123',
        famId: 'fam-123',
        accountHolderId: 'user-123',
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax',
        provider: 'Local Council'
      };

      const result = validateCreateAccount(invalidAccount);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'assetId',
        message: 'Cannot specify both asset ID and user ID'
      });
    });

    it('should reject account with neither assetId nor userId', () => {
      const invalidAccount: CreateAccountRequest = {
        famId: 'fam-123',
        accountHolderId: 'user-123',
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax',
        provider: 'Local Council'
      };

      const result = validateCreateAccount(invalidAccount);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'assetId',
        message: 'Either asset ID or user ID must be provided'
      });
    });

    it('should reject account with negative amount', () => {
      const invalidAccount: CreateAccountRequest = {
        assetId: 'asset-123',
        famId: 'fam-123',
        accountHolderId: 'user-123',
        type: AccountType.COUNCIL_TAX,
        name: 'Council Tax',
        provider: 'Local Council',
        amount: -50
      };

      const result = validateCreateAccount(invalidAccount);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'amount',
        message: 'Amount cannot be negative'
      });
    });
  });

  describe('validateCreatePlan', () => {
    it('should validate a valid plan', () => {
      const validPlan: CreatePlanRequest = {
        famId: 'fam-123',
        type: PlanType.HOLIDAY,
        name: 'Summer Holiday 2024',
        description: 'Family trip to Spain',
        startDate: new Date('2024-07-01'),
        endDate: new Date('2024-07-15')
      };

      const result = validateCreatePlan(validPlan);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject plan with end date before start date', () => {
      const invalidPlan: CreatePlanRequest = {
        famId: 'fam-123',
        type: PlanType.HOLIDAY,
        name: 'Summer Holiday 2024',
        startDate: new Date('2024-07-15'),
        endDate: new Date('2024-07-01')
      };

      const result = validateCreatePlan(invalidPlan);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'endDate',
        message: 'End date must be after start date'
      });
    });
  });

  describe('validateCreatePlanTask', () => {
    it('should validate a valid plan task', () => {
      const validTask: CreatePlanTaskRequest = {
        planId: 'plan-123',
        title: 'Book flights',
        description: 'Book return flights to Madrid',
        assignedToId: 'user-123',
        dueDate: new Date(Date.now() + 86400000) // tomorrow
      };

      const result = validateCreatePlanTask(validTask);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject task with missing title', () => {
      const invalidTask: CreatePlanTaskRequest = {
        planId: 'plan-123',
        title: ''
      };

      const result = validateCreatePlanTask(invalidTask);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'title',
        message: 'Task title is required'
      });
    });
  });

  describe('validateRole', () => {
    it('should validate valid roles', () => {
      expect(validateRole(Role.ADMIN)).toBe(true);
      expect(validateRole(Role.MEMBER)).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(validateRole('INVALID')).toBe(false);
      expect(validateRole('')).toBe(false);
    });
  });

  describe('validateFamMembership', () => {
    it('should validate valid membership', () => {
      const result = validateFamMembership('user-123', 'fam-123', Role.MEMBER);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject membership with missing user ID', () => {
      const result = validateFamMembership('', 'fam-123', Role.MEMBER);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'userId',
        message: 'User ID is required'
      });
    });
  });

  describe('validateCustomFields', () => {
    it('should validate valid custom fields', () => {
      const validFields = { color: 'blue', priority: 1, tags: ['important'] };
      const result = validateCustomFields(validFields);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject reserved field names', () => {
      const invalidFields = { id: 'custom-id', color: 'blue' };
      const result = validateCustomFields(invalidFields);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customFields',
        message: "Field 'id' is reserved and cannot be used in custom fields"
      });
    });

    it('should reject non-object custom fields', () => {
      const result = validateCustomFields('not an object' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'customFields',
        message: 'Custom fields must be an object'
      });
    });
  });
});