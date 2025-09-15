// Core type definitions for the FamSpace application
import { Decimal } from '@prisma/client/runtime/library';

// Enums matching Prisma schema
export enum Role {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export enum AssetType {
  HOME = 'HOME',
  VEHICLE = 'VEHICLE',
  CUSTOM = 'CUSTOM'
}

export enum AccountType {
  COUNCIL_TAX = 'COUNCIL_TAX',
  HOME_INSURANCE = 'HOME_INSURANCE',
  ENERGY_BILL = 'ENERGY_BILL',
  TV_PACKAGE = 'TV_PACKAGE',
  FACTORING = 'FACTORING',
  LIFE_INSURANCE = 'LIFE_INSURANCE',
  MOBILE_CONTRACT = 'MOBILE_CONTRACT',
  WILL_TESTAMENT = 'WILL_TESTAMENT',
  CUSTOM = 'CUSTOM'
}

export enum PlanType {
  HOLIDAY = 'HOLIDAY',
  PROPERTY_MOVE = 'PROPERTY_MOVE',
  CUSTOM = 'CUSTOM'
}

export enum PlanStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

// Base interface for all entities
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Core domain interfaces
export interface User extends BaseEntity {
  email: string;
  name: string;
  famMemberships?: FamMembership[];
  personalAccounts?: Account[];
  accountHoldings?: Account[];
  assignedTasks?: PlanTask[];
}

export interface Fam extends BaseEntity {
  name: string;
  members?: FamMembership[];
  assets?: Asset[];
  accounts?: Account[];
  plans?: Plan[];
}

export interface FamMembership {
  id: string;
  userId: string;
  famId: string;
  role: Role;
  joinedAt: Date;
  user?: User;
  fam?: Fam;
}

export interface Asset extends BaseEntity {
  famId: string;
  type: AssetType;
  name: string;
  description?: string;
  customFields: Record<string, any>;
  fam?: Fam;
  accounts?: Account[];
}

export interface Account extends BaseEntity {
  assetId?: string;
  userId?: string;
  famId: string;
  accountHolderId: string;
  type: AccountType;
  name: string;
  provider: string;
  accountNumber?: string;
  dueDate?: Date;
  amount?: Decimal;
  expiryDate?: Date;
  customFields: Record<string, any>;
  asset?: Asset;
  personalUser?: User;
  fam?: Fam;
  accountHolder?: User;
  documents?: Document[];
}

export interface Plan extends BaseEntity {
  famId: string;
  type: PlanType;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status: PlanStatus;
  customFields: Record<string, any>;
  fam?: Fam;
  tasks?: PlanTask[];
}

export interface PlanTask extends BaseEntity {
  planId: string;
  title: string;
  description?: string;
  assignedToId?: string;
  dueDate?: Date;
  completed: boolean;
  plan?: Plan;
  assignedTo?: User;
}

export interface Document {
  id: string;
  accountId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageUrl: string;
  createdAt: Date;
  account?: Account;
}

// Request/Response DTOs
export interface CreateUserRequest {
  email: string;
  name: string;
}

export interface CreateFamRequest {
  name: string;
}

export interface UpdateFamRequest {
  name?: string;
}

export interface CreateAssetRequest {
  type: AssetType;
  name: string;
  description?: string;
  customFields?: Record<string, any>;
}

export interface UpdateAssetRequest {
  type?: AssetType;
  name?: string;
  description?: string;
  customFields?: Record<string, any>;
}

export interface CreateAccountRequest {
  assetId?: string;
  userId?: string;
  famId: string;
  accountHolderId: string;
  type: AccountType;
  name: string;
  provider: string;
  accountNumber?: string;
  dueDate?: Date;
  amount?: number;
  expiryDate?: Date;
  customFields?: Record<string, any>;
}

export interface UpdateAccountRequest {
  type?: AccountType;
  name?: string;
  provider?: string;
  accountNumber?: string;
  dueDate?: Date;
  amount?: number;
  expiryDate?: Date;
  customFields?: Record<string, any>;
}

export interface CreatePlanRequest {
  famId: string;
  type: PlanType;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  customFields?: Record<string, any>;
}

export interface UpdatePlanRequest {
  type?: PlanType;
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  status?: PlanStatus;
  customFields?: Record<string, any>;
}

export interface CreatePlanTaskRequest {
  planId: string;
  title: string;
  description?: string;
  assignedToId?: string;
  dueDate?: Date;
}

export interface UpdatePlanTaskRequest {
  title?: string;
  description?: string;
  assignedToId?: string;
  dueDate?: Date;
  completed?: boolean;
}

// Validation interfaces
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}