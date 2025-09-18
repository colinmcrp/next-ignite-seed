import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));
router.get('/supabase/status', authController.getSupabaseStatus.bind(authController));
router.post('/supabase/exchange', authController.exchangeSupabaseToken.bind(authController));

// Protected routes
router.get('/profile', authenticate, authController.getProfile.bind(authController));

export { router as authRoutes };