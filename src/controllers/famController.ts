import { Request, Response } from 'express';
import { famService } from '../services/famService';
import { logger } from '../utils/logger';
import { CreateFamRequest, UpdateFamRequest, Role } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export class FamController {
  async createFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const data: CreateFamRequest = req.body;
      const fam = await famService.createFam(userId, data);

      res.status(201).json({
        success: true,
        data: fam
      });
    } catch (error) {
      logger.error('Error creating Fam:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to create Fam'
      });
    }
  }

  async getFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const fam = await famService.getFamById(famId, userId);

      res.json({
        success: true,
        data: fam
      });
    } catch (error) {
      logger.error('Error getting Fam:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get Fam'
      });
    }
  }

  async updateFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const data: UpdateFamRequest = req.body;
      const fam = await famService.updateFam(famId, userId, data);

      res.json({
        success: true,
        data: fam
      });
    } catch (error) {
      logger.error('Error updating Fam:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update Fam'
      });
    }
  }

  async getUserFams(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const fams = await famService.getUserFams(userId);

      res.json({
        success: true,
        data: fams
      });
    } catch (error) {
      logger.error('Error getting user Fams:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get user Fams'
      });
    }
  }

  async createInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { inviteeEmail } = req.body;

      if (!inviteeEmail) {
        res.status(400).json({ error: 'Invitee email is required' });
        return;
      }

      const invitation = await famService.createInvitation({
        famId,
        inviterUserId: userId,
        inviteeEmail
      });

      res.status(201).json({
        success: true,
        data: {
          id: invitation.id,
          token: invitation.token,
          inviteeEmail: invitation.inviteeEmail,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error) {
      logger.error('Error creating invitation:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create invitation'
      });
    }
  }

  async joinFam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { invitationToken } = req.body;

      if (!invitationToken) {
        res.status(400).json({ error: 'Invitation token is required' });
        return;
      }

      const membership = await famService.joinFam({
        invitationToken,
        userId
      });

      res.status(201).json({
        success: true,
        data: membership
      });
    } catch (error) {
      logger.error('Error joining Fam:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Failed to join Fam'
      });
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, memberId } = req.params;

      await famService.removeMember(famId, userId, memberId);

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      logger.error('Error removing member:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to remove member'
      });
    }
  }

  async updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, memberId } = req.params;
      const { role } = req.body;

      if (!role || !Object.values(Role).includes(role)) {
        res.status(400).json({ error: 'Valid role is required (ADMIN or MEMBER)' });
        return;
      }

      const membership = await famService.updateMemberRole(famId, userId, memberId, role);

      res.json({
        success: true,
        data: membership
      });
    } catch (error) {
      logger.error('Error updating member role:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update member role'
      });
    }
  }

  async getFamContexts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { getUserFamContexts } = await import('../middleware/famContext');
      const contexts = await getUserFamContexts(userId);

      res.json({
        success: true,
        data: {
          contexts,
          totalFams: contexts.length,
          adminFams: contexts.filter(c => c.isAdmin).length
        }
      });
    } catch (error) {
      logger.error('Error getting Fam contexts:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get Fam contexts'
      });
    }
  }

  async switchFamContext(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.body;

      if (!famId) {
        res.status(400).json({ error: 'Fam ID is required' });
        return;
      }

      // Verify user has access to this Fam
      const membership = await famService.verifyFamMembership(famId, userId);
      const fam = await famService.getFamById(famId, userId);

      res.json({
        success: true,
        data: {
          famId,
          famName: fam.name,
          role: membership.role,
          message: `Successfully switched to Fam: ${fam.name}`
        }
      });
    } catch (error) {
      logger.error('Error switching Fam context:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to switch Fam context'
      });
    }
  }

  async getCurrentFamContext(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get famId from headers or query
      const famId = req.headers['x-fam-id'] as string || req.query.famId as string;

      if (!famId) {
        res.status(400).json({ 
          error: 'Fam ID is required. Provide it via X-Fam-Id header or famId query parameter' 
        });
        return;
      }

      const membership = await famService.verifyFamMembership(famId, userId);
      const fam = await famService.getFamById(famId, userId);

      res.json({
        success: true,
        data: {
          famId,
          famName: fam.name,
          role: membership.role,
          memberCount: fam.members?.length || 0,
          assetCount: fam.assets?.length || 0,
          accountCount: fam.accounts?.length || 0,
          planCount: fam.plans?.length || 0
        }
      });
    } catch (error) {
      logger.error('Error getting current Fam context:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get current Fam context'
      });
    }
  }
}

export const famController = new FamController();