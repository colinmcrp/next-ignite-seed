import { Request, Response, NextFunction } from 'express';
import { authService, AuthUser } from '../services/authService';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// Extend Express Request interface to include user and fam context
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      famId?: string;
      famRole?: string;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface FamAuthorizedRequest extends AuthenticatedRequest {
  famId: string;
  famRole: string;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const user = await authService.verifyAccessToken(token);
    req.user = user;
    
    next();
  } catch (error) {
    logger.warn(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired access token',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware to authorize access to a specific Fam
 * Requires famId in request params or body
 */
export const authorizeFam = async (req: Request, res: Response, next: NextFunction) => {
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

    // Get famId from params, body, or query
    const famId = req.params.famId || req.body.famId || req.query.famId as string;
    
    if (!famId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Fam ID required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is a member of the Fam
    const membership = await prisma.famMembership.findUnique({
      where: {
        userId_famId: {
          userId: req.user.id,
          famId: famId
        }
      }
    });

    if (!membership) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this Fam',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Add Fam context to request
    req.famId = famId;
    req.famRole = membership.role;
    
    next();
  } catch (error) {
    logger.error(`Fam authorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authorization check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware to require admin role within a Fam
 */
export const requireFamAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.famRole || req.famRole !== 'ADMIN') {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin role required for this action',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  next();
};

/**
 * Middleware to authorize access to personal accounts
 * Checks if the account belongs to the authenticated user
 */
export const authorizePersonalAccount = async (req: Request, res: Response, next: NextFunction) => {
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

    const accountId = req.params.accountId || req.body.accountId;
    
    if (!accountId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Account ID required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if account exists and belongs to user (personal account)
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: req.user.id // Personal account check
      }
    });

    if (!account) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to this account',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error(`Personal account authorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authorization check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};