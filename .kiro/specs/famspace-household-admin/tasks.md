# Implementation Plan

- [x] 1. Set up project foundation and core infrastructure
  - Initialize Node.js TypeScript project with Express.js
  - Configure Prisma ORM with PostgreSQL database
  - Set up basic project structure with folders for models, services, controllers, and tests
  - Configure environment variables and basic logging
  - _Requirements: All requirements depend on this foundation_

- [x] 2. Implement core data models and database schema
  - Create Prisma schema for User, Fam, FamMembership, Asset, Account, Plan, and PlanTask models
  - Generate and run initial database migrations
  - Create TypeScript interfaces matching the database models
  - Write unit tests for model validation and relationships
  - _Requirements: 1.1, 2.1, 3.1, 6.1, 7.1_

- [x] 3. Implement authentication and authorization system
  - Create JWT-based authentication service with refresh tokens
  - Implement user registration and login endpoints
  - Create middleware for route protection and Fam-based authorization
  - Write tests for authentication flows and security controls
  - _Requirements: 1.1, 1.3_

- [x] 4. Build Fam management functionality
- [x] 4.1 Implement Fam creation and membership
  - Create FamService with methods for creating Fams and managing memberships
  - Build API endpoints for Fam creation, invitation generation, and joining
  - Implement invitation token system with expiration
  - Write unit and integration tests for Fam management workflows
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4.2 Create Fam switching and multi-tenancy
  - Implement context switching between multiple Fams for users
  - Add middleware to ensure data isolation between Fams
  - Create API endpoints for listing user's Fams and switching context
  - Write tests for multi-tenancy data isolation
  - _Requirements: 1.4, 1.3_

- [x] 5. Implement Asset management system
- [x] 5.1 Create Asset model and basic CRUD operations
  - Build AssetService with create, read, update, delete operations
  - Implement API endpoints for Asset management
  - Add support for custom fields using JSONB storage
  - Write unit tests for Asset operations and custom field handling
  - _Requirements: 2.1, 7.1, 7.2, 7.3_

- [x] 5.2 Add predefined Asset types and templates
  - Create predefined templates for UK home assets
  - Implement template selection and customization logic
  - Add validation for Asset types and required fields
  - Write tests for template system and validation
  - _Requirements: 7.1, 7.2_

- [-] 6. Build Account management functionality
- [x] 6.1 Implement Account model with UK-specific types
  - Create AccountService with CRUD operations for household accounts
  - Add predefined UK account types (council tax, energy, insurance, etc.)
  - Implement account holder assignment from Fam members
  - Write unit tests for Account creation and type validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

- [x] 6.2 Add due date and reminder functionality
  - Implement date tracking for due dates, amounts, and expiry dates
  - Create notification service for upcoming payments and renewals
  - Build API endpoints for retrieving upcoming obligations
  - Write tests for date calculations and notification triggers
  - _Requirements: 2.3, 2.4, 2.5, 3.3_

- [x] 6.3 Create personal account management
  - Extend Account model to support personal accounts (wills, life insurance, mobile contracts)
  - Implement privacy controls for personal vs shared account visibility
  - Add personal account API endpoints with proper authorization
  - Write tests for personal account access controls
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 7. Implement Plan management system
- [x] 7.1 Create Plan model and basic operations
  - Build PlanService with CRUD operations for family plans
  - Implement predefined plan types (holiday, property move)
  - Add custom field support for flexible planning
  - Write unit tests for Plan creation and management
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_

- [x] 7.2 Add Plan task management
  - Implement PlanTask model with assignment and completion tracking
  - Create API endpoints for task creation, assignment, and status updates
  - Add progress tracking and milestone functionality
  - Write tests for task management and progress calculations
  - _Requirements: 6.4_

- [ ] 8. Build email integration and AI processing
- [ ] 8.1 Implement email connection service
  - Create email integration service supporting IMAP/OAuth2
  - Build secure credential storage for email accounts
  - Implement email fetching and parsing functionality
  - Write tests for email connection and data extraction
  - _Requirements: 4.1, 4.2_

- [ ] 8.2 Create AI-powered bill analysis
  - Integrate OpenAI API for email content analysis
  - Implement bill relevance detection and data extraction
  - Create confidence scoring and suggestion system
  - Write tests for AI analysis accuracy and error handling
  - _Requirements: 4.2, 4.3_

- [ ] 8.3 Build automated bill processing workflow
  - Create end-to-end pipeline from email detection to Account creation
  - Implement user approval workflow for AI suggestions
  - Add error handling and fallback to manual entry
  - Write integration tests for complete email processing workflow
  - _Requirements: 4.3, 4.4_

- [ ] 9. Implement OCR document processing
- [ ] 9.1 Create OCR service integration
  - Integrate Google Cloud Vision API or AWS Textract
  - Implement image preprocessing and text extraction
  - Create bill information parsing from OCR text
  - Write tests for OCR accuracy and error handling
  - _Requirements: 5.1, 5.2_

- [ ] 9.2 Build document upload and processing workflow
  - Create file upload endpoints with security validation
  - Implement OCR processing pipeline with user feedback
  - Add manual correction interface for OCR results
  - Write integration tests for document processing workflow
  - _Requirements: 5.2, 5.3_

- [ ] 10. Create notification and reminder system
- [ ] 10.1 Implement notification service
  - Build notification service with multiple delivery channels
  - Create notification templates for different event types
  - Implement user preference management for notifications
  - Write tests for notification delivery and preferences
  - _Requirements: 2.5, 3.3, 6.4_

- [ ] 10.2 Add scheduled reminder processing
  - Create background job system for processing due dates
  - Implement reminder scheduling with configurable lead times
  - Add notification batching and rate limiting
  - Write tests for scheduled job execution and reliability
  - _Requirements: 2.5, 3.3_

- [ ] 11. Build REST API endpoints and documentation
- [ ] 11.1 Create comprehensive API endpoints
  - Implement all CRUD endpoints for core entities
  - Add filtering, sorting, and pagination support
  - Create API documentation using OpenAPI/Swagger
  - Write API integration tests covering all endpoints
  - _Requirements: All requirements need API access_

- [ ] 11.2 Add API security and rate limiting
  - Implement API rate limiting and abuse prevention
  - Add request validation and sanitization
  - Create API key management for external integrations
  - Write security tests for API protection mechanisms
  - _Requirements: All requirements need secure API access_

- [ ] 12. Implement error handling and logging
- [ ] 12.1 Create comprehensive error handling
  - Implement structured error responses across all services
  - Add error categorization and appropriate HTTP status codes
  - Create error logging and monitoring integration
  - Write tests for error scenarios and recovery
  - _Requirements: All requirements need proper error handling_

- [ ] 12.2 Add application monitoring and health checks
  - Implement health check endpoints for all services
  - Add application metrics and performance monitoring
  - Create alerting for critical system failures
  - Write tests for monitoring and health check functionality
  - _Requirements: System reliability for all features_

- [ ] 13. Create data migration and seeding utilities
- [ ] 13.1 Build data seeding for UK household types
  - Create seed data for common UK account types and templates
  - Implement data migration utilities for schema updates
  - Add sample data generation for development and testing
  - Write tests for data seeding and migration processes
  - _Requirements: 7.1, 7.2_

- [ ] 13.2 Implement data export and backup functionality
  - Create data export functionality for user data portability
  - Implement backup and restore procedures
  - Add data anonymization utilities for testing
  - Write tests for data export accuracy and privacy compliance
  - _Requirements: Data protection and user control_