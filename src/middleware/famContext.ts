import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Role } from '../models/types';

// Extend Express Request interface to include Fam context
declare global {
  namespace Express {
    interface Request {
      famContext?: {
        famId: string;
        role: Role;
        membership: {
          id: string;
          userId: string;
          famId: string;
          role: Role;
          joinedAt: Date;
        };
      };
    }
  }
}

export interface FamContextRequest extends Request {
  famContext: {
    famId: string;
    role: Role;
    membership: {
      id: string;
      userId: string;
      famId: string;
      role: Role;
      joinedAt: Date;
    };
  };
}

/**
 * Middleware to establish Fam context for multi-tenancy
 * Extracts famId from various sources and validates user membership
 */
export const establishFamContext = async (req: Request, res: Response, next: NextFunction) => {
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

    // Extract famId from various sources (params, body, query, headers)
    const famId = req.params.famId || 
                  req.body.famId || 
                  req.query.famId as string ||
                  req.headers['x-fam-id'] as string;

    if (!famId) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Fam ID is required. Provide it in URL params, request body, query string, or X-Fam-Id header',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate famId format (should be a valid CUID)
    if (typeof famId !== 'string' || famId.length < 10) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid Fam ID format',
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
      logger.warn(`Access denied: User ${req.user.id} attempted to access Fam ${famId}`);
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied: You are not a member of this Fam',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Establish Fam context
    req.famContext = {
      famId,
      role: membership.role,
      membership: {
        id: membership.id,
        userId: membership.userId,
        famId: membership.famId,
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    };

    logger.debug(`Fam context established: User ${req.user.id} accessing Fam ${famId} as ${membership.role}`);
    next();
  } catch (error) {
    logger.error(`Fam context establishment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to establish Fam context',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware to require admin role within the current Fam context
 */
export const requireFamAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.famContext) {
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Fam context not established',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (req.famContext.role !== Role.ADMIN) {
    logger.warn(`Admin access denied: User ${req.user?.id} with role ${req.famContext.role} in Fam ${req.famContext.famId}`);
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin privileges required for this action',
        timestamp: new Date().toISOString()
      }
    });
  }
  
  next();
};

/**
 * Middleware to ensure data isolation by validating that resources belong to the current Fam
 */
export const enforceDataIsolation = (resourceType: 'asset' | 'account' | 'plan') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.famContext) {
        return res.status(500).json({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Fam context not established',
            timestamp: new Date().toISOString()
          }
        });
      }

      const resourceId = req.params.id || req.params.assetId || req.params.accountId || req.params.planId;
      
      if (!resourceId) {
        // If no resource ID is provided, skip validation (e.g., for create operations)
        return next();
      }

      let resource = null;
      
      switch (resourceType) {
        case 'asset':
          resource = await prisma.asset.findUnique({
            where: { id: resourceId },
            select: { famId: true }
          });
          break;
        case 'account':
          resource = await prisma.account.findUnique({
            where: { id: resourceId },
            select: { famId: true }
          });
          break;
        case 'plan':
          resource = await prisma.plan.findUnique({
            where: { id: resourceId },
            select: { famId: true }
          });
          break;
      }

      if (!resource) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found`,
            timestamp: new Date().toISOString()
          }
        });
      }

      if (resource.famId !== req.famContext.famId) {
        logger.warn(`Data isolation violation: User ${req.user?.id} attempted to access ${resourceType} ${resourceId} from different Fam`);
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Access denied: This ${resourceType} belongs to a different Fam`,
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    } catch (error) {
      logger.error(`Data isolation enforcement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to enforce data isolation',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Utility function to get user's Fam memberships with context switching info
 */
export const getUserFamContexts = async (userId: string) => {
  const memberships = await prisma.famMembership.findMany({
    where: { userId },
    include: {
      fam: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: {
            select: {
              members: true,
              assets: true,
              accounts: true,
              plans: true
            }
          }
        }
      }
    },
    orderBy: [
      { role: 'desc' }, // Admins first
      { joinedAt: 'asc' } // Then by join date
    ]
  });

  return memberships.map(membership => ({
    famId: membership.famId,
    famName: membership.fam.name,
    role: membership.role,
    joinedAt: membership.joinedAt,
    isAdmin: membership.role === Role.ADMIN,
    stats: {
      memberCount: membership.fam._count.members,
      assetCount: membership.fam._count.assets,
      accountCount: membership.fam._count.accounts,
      planCount: membership.fam._count.plans
    }
  }));
};