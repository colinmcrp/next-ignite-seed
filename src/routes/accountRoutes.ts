import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All Account routes require authentication
router.use(authenticate);

// UK account type information routes (should come before parameterized routes)
router.get('/uk-types', accountController.getUKAccountTypes.bind(accountController));
router.get('/uk-types/category/:category', accountController.getAccountTypesByCategory.bind(accountController));
router.get('/uk-types/:accountType', accountController.getAccountTypeInfo.bind(accountController));

// Account management routes
router.post('/', accountController.createAccount.bind(accountController));
router.get('/:accountId', accountController.getAccount.bind(accountController));
router.put('/:accountId', accountController.updateAccount.bind(accountController));
router.delete('/:accountId', accountController.deleteAccount.bind(accountController));

// Fam-specific account routes
router.get('/fam/:famId', accountController.getAccountsByFam.bind(accountController));
router.get('/fam/:famId/search', accountController.searchAccounts.bind(accountController));
router.get('/fam/:famId/personal', accountController.getPersonalAccounts.bind(accountController));
router.get('/fam/:famId/personal/:accountType', accountController.getPersonalAccountsByType.bind(accountController));

// Personal account management routes
router.post('/personal', accountController.createPersonalAccount.bind(accountController));
router.put('/personal/:accountId', accountController.updatePersonalAccount.bind(accountController));
router.delete('/personal/:accountId', accountController.deletePersonalAccount.bind(accountController));
router.get('/personal/:accountId/access', accountController.checkPersonalAccountAccess.bind(accountController));

// Asset-specific account routes
router.get('/asset/:assetId', accountController.getAccountsByAsset.bind(accountController));

// Notification and reminder routes
router.get('/fam/:famId/obligations', accountController.getUpcomingObligations.bind(accountController));
router.get('/fam/:famId/obligations/summary', accountController.getNotificationSummary.bind(accountController));
router.get('/fam/:famId/obligations/overdue', accountController.getOverdueObligations.bind(accountController));
router.get('/fam/:famId/obligations/due-within/:days', accountController.getObligationsDueWithin.bind(accountController));
router.get('/fam/:famId/obligations/urgency/:urgency', accountController.getObligationsByUrgency.bind(accountController));
router.get('/fam/:famId/attention', accountController.getAccountsNeedingAttention.bind(accountController));

export default router;