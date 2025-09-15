import { Router } from 'express';
import { famController } from '../controllers/famController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All Fam routes require authentication
router.use(authenticate);

// Fam management routes
router.post('/', famController.createFam.bind(famController));
router.get('/user', famController.getUserFams.bind(famController));
router.get('/:famId', famController.getFam.bind(famController));
router.put('/:famId', famController.updateFam.bind(famController));

// Invitation routes
router.post('/:famId/invitations', famController.createInvitation.bind(famController));
router.post('/join', famController.joinFam.bind(famController));

// Member management routes
router.delete('/:famId/members/:memberId', famController.removeMember.bind(famController));
router.put('/:famId/members/:memberId/role', famController.updateMemberRole.bind(famController));

// Fam context switching routes
router.get('/contexts', famController.getFamContexts.bind(famController));
router.post('/switch', famController.switchFamContext.bind(famController));
router.get('/current', famController.getCurrentFamContext.bind(famController));

export default router;