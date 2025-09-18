import { Router } from 'express';
import { authRoutes } from './authRoutes';
import famRoutes from './famRoutes';
import assetRoutes from './assetRoutes';
import accountRoutes from './accountRoutes';
import planRoutes from './planRoutes';

const router = Router();

// Authentication routes
router.use('/auth', authRoutes);

// Fam management routes
router.use('/fams', famRoutes);

// Asset management routes
router.use('/assets', assetRoutes);

// Account management routes
router.use('/accounts', accountRoutes);

// Plan management routes
router.use('/plans', planRoutes);

// API routes will be added here as controllers are implemented
// This file serves as the central routing configuration

router.get('/', (req, res) => {
  res.json({
    message: 'FamSpace API Routes',
    version: '1.0.0',
    availableRoutes: [
      'GET /api - This endpoint',
      'GET /health - Health check',
      'POST /api/auth/register - User registration',
      'POST /api/auth/login - User login',
      'POST /api/auth/refresh - Refresh access token',
      'GET /api/auth/supabase/status - Supabase integration status',
      'POST /api/auth/supabase/exchange - Exchange Supabase session token',
      'GET /api/auth/profile - Get user profile (protected)',
      'POST /api/fams - Create a new Fam (protected)',
      'GET /api/fams/user - Get user\'s Fams (protected)',
      'GET /api/fams/:famId - Get Fam details (protected)',
      'PUT /api/fams/:famId - Update Fam (protected)',
      'POST /api/fams/:famId/invitations - Create invitation (protected)',
      'POST /api/fams/join - Join Fam via invitation (protected)',
      'DELETE /api/fams/:famId/members/:memberId - Remove member (protected)',
      'PUT /api/fams/:famId/members/:memberId/role - Update member role (protected)',
      'GET /api/fams/contexts - Get user\'s Fam contexts (protected)',
      'POST /api/fams/switch - Switch Fam context (protected)',
      'GET /api/fams/current - Get current Fam context (protected)',
      'GET /api/assets/templates - Get asset templates (protected)',
      'GET /api/assets/templates/categories - Get template categories (protected)',
      'GET /api/assets/templates/:templateId - Get template details (protected)',
      'POST /api/assets/templates/:templateId/validate - Validate template data (protected)',
      'POST /api/assets/fam/:famId - Create asset (protected)',
      'POST /api/assets/fam/:famId/from-template - Create asset from template (protected)',
      'GET /api/assets/fam/:famId - Get Fam assets (protected)',
      'GET /api/assets/fam/:famId/search - Search assets (protected)',
      'GET /api/assets/:assetId - Get asset details (protected)',
      'PUT /api/assets/:assetId - Update asset (protected)',
      'DELETE /api/assets/:assetId - Delete asset (protected)',
      'GET /api/assets/:assetId/accounts - Get asset with accounts (protected)'
    ]
  });
});

export default router;