import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { logger } from '../utils/logger';

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;

      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email, password, and name are required',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email format',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Password strength validation
      if (password.length < 8) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters long',
            timestamp: new Date().toISOString()
          }
        });
      }

      const result = await authService.register({
        email: email.toLowerCase().trim(),
        password,
        name: name.trim()
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        tokens: result.tokens
      });

    } catch (error) {
      logger.error(`Registration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (error instanceof Error && error.message === 'User already exists with this email') {
        return res.status(409).json({
          error: {
            code: 'USER_EXISTS',
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Registration failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email and password are required',
            timestamp: new Date().toISOString()
          }
        });
      }

      const result = await authService.login({
        email: email.toLowerCase().trim(),
        password
      });

      // Get user's Fams for context
      const userFams = await authService.getUserFams(result.user.id);

      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens,
        fams: userFams
      });

    } catch (error) {
      logger.error(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (error instanceof Error && error.message === 'Invalid credentials') {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Login failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Refresh token is required',
            timestamp: new Date().toISOString()
          }
        });
      }

      const tokens = await authService.refreshToken(refreshToken);

      res.json({
        message: 'Tokens refreshed successfully',
        tokens
      });

    } catch (error) {
      logger.error(`Token refresh error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get user's Fams
      const userFams = await authService.getUserFams(req.user.id);

      res.json({
        user: req.user,
        fams: userFams
      });

    } catch (error) {
      logger.error(`Get profile error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user profile',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const authController = new AuthController();