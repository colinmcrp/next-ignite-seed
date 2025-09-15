import { Router } from 'express';
import { assetController } from '../controllers/assetController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All Asset routes require authentication
router.use(authenticate);

// Template routes (should come before parameterized routes)
router.get('/templates', assetController.getTemplates.bind(assetController));
router.get('/templates/categories', assetController.getTemplateCategories.bind(assetController));
router.get('/templates/:templateId', assetController.getTemplate.bind(assetController));
router.post('/templates/:templateId/validate', assetController.validateTemplateData.bind(assetController));

// Asset management routes
router.post('/fam/:famId', assetController.createAsset.bind(assetController));
router.post('/fam/:famId/from-template', assetController.createAssetFromTemplate.bind(assetController));
router.get('/fam/:famId', assetController.getAssetsByFam.bind(assetController));
router.get('/fam/:famId/search', assetController.searchAssets.bind(assetController));
router.get('/:assetId', assetController.getAsset.bind(assetController));
router.put('/:assetId', assetController.updateAsset.bind(assetController));
router.delete('/:assetId', assetController.deleteAsset.bind(assetController));

// Asset with related data routes
router.get('/:assetId/accounts', assetController.getAssetWithAccounts.bind(assetController));

export default router;