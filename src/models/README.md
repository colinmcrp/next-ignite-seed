# FamSpace Data Models

This directory contains the core data models and validation logic for the FamSpace household administration application.

## Overview

The FamSpace data model is built around the concept of "Fams" (family units) that manage shared assets and individual member accounts. The system supports multi-tenancy, flexible custom fields, and comprehensive relationship management.

## Core Models

### User
- Represents individual users of the system
- Can belong to multiple Fams through FamMembership
- Can hold both shared (asset-based) and personal accounts
- Unique email constraint for authentication

### Fam (Family Unit)
- Central organizing unit for household management
- Contains members, assets, accounts, and plans
- Provides data isolation between different households
- Supports role-based access (Admin/Member)

### FamMembership
- Junction table managing User-Fam relationships
- Supports role-based permissions (Admin/Member)
- Unique constraint prevents duplicate memberships
- Tracks join date for audit purposes

### Asset
- Represents physical assets (homes, vehicles, etc.)
- Belongs to a single Fam
- Can have multiple associated accounts
- Supports flexible custom fields via JSONB

### Account
- Represents financial accounts and obligations
- Can be asset-based (shared) or personal
- Supports UK-specific account types (council tax, energy, etc.)
- Tracks due dates, amounts, and expiry dates
- Flexible custom fields for additional data

### Plan
- Represents family planning activities (holidays, moves, etc.)
- Contains multiple tasks with assignment and tracking
- Supports custom plan types and flexible fields
- Status tracking (Planning/In Progress/Completed)

### PlanTask
- Individual tasks within a plan
- Can be assigned to specific users
- Tracks completion status and due dates
- Supports unassigned tasks for general planning

### Document
- File attachments for accounts (bills, statements, etc.)
- Stores metadata and cloud storage references
- Cascade deletes with parent account

## Database Schema

The system uses PostgreSQL with Prisma ORM for type-safe database access. Key design decisions:

- **Multi-tenancy**: All data scoped to Fams for isolation
- **Flexible Schema**: JSONB custom fields for extensibility
- **Audit Trail**: Created/updated timestamps on all entities
- **Referential Integrity**: Proper foreign key constraints with cascade deletes
- **UK-Specific**: Account types tailored for UK households

## Validation

Comprehensive validation is provided for all models:

- **Email validation**: RFC-compliant email format checking
- **Required fields**: Ensures all mandatory data is present
- **Data types**: Validates enums and type constraints
- **Business rules**: Enforces logical constraints (dates, amounts, etc.)
- **Custom fields**: Validates JSON structure and reserved field names

## Usage Examples

### Creating a User and Fam
```typescript
import { validateCreateUser, validateCreateFam } from './validation';

const userData = { email: 'user@example.com', name: 'John Doe' };
const userValidation = validateCreateUser(userData);

if (userValidation.isValid) {
  const user = await prisma.user.create({ data: userData });
  
  const famData = { name: 'Doe Family' };
  const famValidation = validateCreateFam(famData);
  
  if (famValidation.isValid) {
    const fam = await prisma.fam.create({
      data: {
        ...famData,
        members: {
          create: {
            userId: user.id,
            role: Role.ADMIN
          }
        }
      }
    });
  }
}
```

### Creating an Asset with Accounts
```typescript
const assetData = {
  type: AssetType.HOME,
  name: 'Main House',
  customFields: { address: '123 Main St', bedrooms: 3 }
};

const asset = await prisma.asset.create({
  data: {
    ...assetData,
    famId: 'fam-id',
    accounts: {
      create: [
        {
          famId: 'fam-id',
          accountHolderId: 'user-id',
          type: AccountType.COUNCIL_TAX,
          name: 'Council Tax',
          provider: 'Local Council',
          amount: 150.00
        }
      ]
    }
  }
});
```

## Testing

The models include comprehensive test coverage:

- **Unit Tests**: Validation logic and business rules
- **Relationship Tests**: Model associations and constraints
- **Integration Tests**: Database operations (when available)

Run tests with:
```bash
npm test tests/unit/models/
npm test tests/integration/models.test.ts
```

## Migration

Database migrations are managed through Prisma:

```bash
# Generate migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Custom Fields

All major entities support custom fields stored as JSONB:

- Flexible schema extension without migrations
- JSON validation ensures data integrity
- Reserved field name protection
- Type-safe access through TypeScript interfaces

Example custom fields:
```typescript
// Asset custom fields
{ address: '123 Main St', bedrooms: 3, garden: true }

// Account custom fields
{ directDebit: true, accountType: 'savings', sortCode: '12-34-56' }

// Plan custom fields
{ budget: 5000, destination: 'Spain', travelers: 4 }
```

## UK-Specific Features

The models are tailored for UK households:

- Council tax account type
- Energy bill management
- Home insurance tracking
- TV package accounts
- Factoring (Scotland-specific)
- Life insurance and wills
- Mobile contract management

## Future Enhancements

Planned model extensions:

- Document OCR metadata storage
- Email integration tracking
- Notification preferences
- Audit log for sensitive changes
- Data export/import capabilities