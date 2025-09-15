import { 
  CreateUserRequest, 
  CreateFamRequest, 
  CreateAssetRequest, 
  CreateAccountRequest, 
  CreatePlanRequest, 
  CreatePlanTaskRequest,
  UpdatePlanRequest,
  UpdatePlanTaskRequest,
  ValidationResult,
  ValidationError,
  AssetType,
  AccountType,
  PlanType,
  PlanStatus,
  Role
} from './types';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper function to create validation result
function createValidationResult(errors: ValidationError[]): ValidationResult {
  return {
    isValid: errors.length === 0,
    errors
  };
}

// User validation
export function validateCreateUser(data: CreateUserRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email format' });
  }

  if (!data.name) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
  }

  return createValidationResult(errors);
}

// Fam validation
export function validateCreateFam(data: CreateFamRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name) {
    errors.push({ field: 'name', message: 'Fam name is required' });
  } else if (data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Fam name must be at least 2 characters long' });
  }

  return createValidationResult(errors);
}

// Asset validation
export function validateCreateAsset(data: CreateAssetRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.name) {
    errors.push({ field: 'name', message: 'Asset name is required' });
  } else if (data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Asset name must be at least 2 characters long' });
  }

  if (!data.type) {
    errors.push({ field: 'type', message: 'Asset type is required' });
  } else if (!Object.values(AssetType).includes(data.type)) {
    errors.push({ field: 'type', message: 'Invalid asset type' });
  }

  if (data.customFields && typeof data.customFields !== 'object') {
    errors.push({ field: 'customFields', message: 'Custom fields must be an object' });
  }

  return createValidationResult(errors);
}

// Account validation
export function validateCreateAccount(data: CreateAccountRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.famId) {
    errors.push({ field: 'famId', message: 'Fam ID is required' });
  }

  if (!data.accountHolderId) {
    errors.push({ field: 'accountHolderId', message: 'Account holder ID is required' });
  }

  if (!data.name) {
    errors.push({ field: 'name', message: 'Account name is required' });
  } else if (data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Account name must be at least 2 characters long' });
  }

  if (!data.provider) {
    errors.push({ field: 'provider', message: 'Provider is required' });
  } else if (data.provider.trim().length < 2) {
    errors.push({ field: 'provider', message: 'Provider name must be at least 2 characters long' });
  }

  if (!data.type) {
    errors.push({ field: 'type', message: 'Account type is required' });
  } else if (!Object.values(AccountType).includes(data.type)) {
    errors.push({ field: 'type', message: 'Invalid account type' });
  }

  // Validate that either assetId or userId is provided for personal accounts
  if (!data.assetId && !data.userId) {
    errors.push({ field: 'assetId', message: 'Either asset ID or user ID must be provided' });
  }

  if (data.assetId && data.userId) {
    errors.push({ field: 'assetId', message: 'Cannot specify both asset ID and user ID' });
  }

  if (data.amount !== undefined && data.amount < 0) {
    errors.push({ field: 'amount', message: 'Amount cannot be negative' });
  }

  if (data.dueDate && data.dueDate < new Date()) {
    errors.push({ field: 'dueDate', message: 'Due date cannot be in the past' });
  }

  if (data.expiryDate && data.expiryDate < new Date()) {
    errors.push({ field: 'expiryDate', message: 'Expiry date cannot be in the past' });
  }

  if (data.customFields && typeof data.customFields !== 'object') {
    errors.push({ field: 'customFields', message: 'Custom fields must be an object' });
  }

  return createValidationResult(errors);
}

// Plan validation
export function validateCreatePlan(data: CreatePlanRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.famId) {
    errors.push({ field: 'famId', message: 'Fam ID is required' });
  }

  if (!data.name) {
    errors.push({ field: 'name', message: 'Plan name is required' });
  } else if (data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Plan name must be at least 2 characters long' });
  }

  if (!data.type) {
    errors.push({ field: 'type', message: 'Plan type is required' });
  } else if (!Object.values(PlanType).includes(data.type)) {
    errors.push({ field: 'type', message: 'Invalid plan type' });
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.push({ field: 'endDate', message: 'End date must be after start date' });
  }

  if (data.customFields && typeof data.customFields !== 'object') {
    errors.push({ field: 'customFields', message: 'Custom fields must be an object' });
  }

  return createValidationResult(errors);
}

// Plan Task validation
export function validateCreatePlanTask(data: CreatePlanTaskRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (!data.planId) {
    errors.push({ field: 'planId', message: 'Plan ID is required' });
  }

  if (!data.title) {
    errors.push({ field: 'title', message: 'Task title is required' });
  } else if (data.title.trim().length < 2) {
    errors.push({ field: 'title', message: 'Task title must be at least 2 characters long' });
  }

  if (data.dueDate && data.dueDate < new Date()) {
    errors.push({ field: 'dueDate', message: 'Due date cannot be in the past' });
  }

  return createValidationResult(errors);
}

// Plan update validation
export function validateUpdatePlan(data: UpdatePlanRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (data.name !== undefined) {
    if (!data.name) {
      errors.push({ field: 'name', message: 'Plan name cannot be empty' });
    } else if (data.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'Plan name must be at least 2 characters long' });
    }
  }

  if (data.type !== undefined && !Object.values(PlanType).includes(data.type)) {
    errors.push({ field: 'type', message: 'Invalid plan type' });
  }

  if (data.status !== undefined && !Object.values(PlanStatus).includes(data.status)) {
    errors.push({ field: 'status', message: 'Invalid plan status' });
  }

  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    errors.push({ field: 'endDate', message: 'End date must be after start date' });
  }

  if (data.customFields && typeof data.customFields !== 'object') {
    errors.push({ field: 'customFields', message: 'Custom fields must be an object' });
  }

  return createValidationResult(errors);
}

// Plan Task update validation
export function validateUpdatePlanTask(data: UpdatePlanTaskRequest): ValidationResult {
  const errors: ValidationError[] = [];

  if (data.title !== undefined) {
    if (!data.title) {
      errors.push({ field: 'title', message: 'Task title cannot be empty' });
    } else if (data.title.trim().length < 2) {
      errors.push({ field: 'title', message: 'Task title must be at least 2 characters long' });
    }
  }

  if (data.dueDate && data.dueDate < new Date()) {
    errors.push({ field: 'dueDate', message: 'Due date cannot be in the past' });
  }

  if (data.completed !== undefined && typeof data.completed !== 'boolean') {
    errors.push({ field: 'completed', message: 'Completed must be a boolean value' });
  }

  return createValidationResult(errors);
}

// Role validation
export function validateRole(role: string): boolean {
  return Object.values(Role).includes(role as Role);
}

// Relationship validation helpers
export function validateFamMembership(userId: string, famId: string, role: Role): ValidationResult {
  const errors: ValidationError[] = [];

  if (!userId) {
    errors.push({ field: 'userId', message: 'User ID is required' });
  }

  if (!famId) {
    errors.push({ field: 'famId', message: 'Fam ID is required' });
  }

  if (!validateRole(role)) {
    errors.push({ field: 'role', message: 'Invalid role' });
  }

  return createValidationResult(errors);
}

// Custom field validation
export function validateCustomFields(customFields: Record<string, any>): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof customFields !== 'object' || customFields === null) {
    errors.push({ field: 'customFields', message: 'Custom fields must be an object' });
    return createValidationResult(errors);
  }

  // Check for reserved field names
  const reservedFields = ['id', 'createdAt', 'updatedAt', 'famId', 'userId', 'assetId'];
  for (const field of reservedFields) {
    if (field in customFields) {
      errors.push({ field: 'customFields', message: `Field '${field}' is reserved and cannot be used in custom fields` });
    }
  }

  // Validate field values are serializable
  try {
    JSON.stringify(customFields);
  } catch (error) {
    errors.push({ field: 'customFields', message: 'Custom fields must be JSON serializable' });
  }

  return createValidationResult(errors);
}