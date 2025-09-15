import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Fam, FamMembership, Role, CreateFamRequest, UpdateFamRequest } from '../models/types';
import crypto from 'crypto';

export interface FamInvitation {
  id: string;
  famId: string;
  inviterUserId: string;
  inviteeEmail: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  used: boolean;
}

export interface CreateInvitationRequest {
  famId: string;
  inviterUserId: string;
  inviteeEmail: string;
}

export interface JoinFamRequest {
  invitationToken: string;
  userId: string;
}

export class FamService {
  private readonly INVITATION_EXPIRY_HOURS = 72; // 3 days

  async createFam(creatorUserId: string, data: CreateFamRequest): Promise<Fam> {
    const { name } = data;

    // Validate input
    if (!name || name.trim().length === 0) {
      throw new Error('Fam name is required');
    }

    if (name.length > 100) {
      throw new Error('Fam name must be 100 characters or less');
    }

    // Create Fam with creator as admin member
    const fam = await prisma.fam.create({
      data: {
        name: name.trim(),
        members: {
          create: {
            userId: creatorUserId,
            role: Role.ADMIN
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    logger.info(`New Fam created: ${name} by user ${creatorUserId}`);

    return fam;
  }

  async getFamById(famId: string, userId: string): Promise<Fam> {
    // Verify user has access to this Fam
    const membership = await this.verifyFamMembership(famId, userId);
    
    const fam = await prisma.fam.findUnique({
      where: { id: famId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        },
        assets: true,
        accounts: true,
        plans: true
      }
    });

    if (!fam) {
      throw new Error('Fam not found');
    }

    return fam;
  }

  async updateFam(famId: string, userId: string, data: UpdateFamRequest): Promise<Fam> {
    // Verify user is admin of this Fam
    await this.verifyFamAdmin(famId, userId);

    const { name } = data;

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new Error('Fam name is required');
      }
      if (name.length > 100) {
        throw new Error('Fam name must be 100 characters or less');
      }
    }

    const fam = await prisma.fam.update({
      where: { id: famId },
      data: {
        ...(name && { name: name.trim() })
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    logger.info(`Fam updated: ${famId} by user ${userId}`);

    return fam;
  }

  async getUserFams(userId: string): Promise<Array<{ fam: Fam; membership: FamMembership }>> {
    const memberships = await prisma.famMembership.findMany({
      where: { userId },
      include: {
        fam: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    return memberships.map(membership => ({
      fam: membership.fam,
      membership: {
        id: membership.id,
        userId: membership.userId,
        famId: membership.famId,
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    }));
  }

  async createInvitation(data: CreateInvitationRequest): Promise<FamInvitation> {
    const { famId, inviterUserId, inviteeEmail } = data;

    // Verify inviter is admin of the Fam
    await this.verifyFamAdmin(famId, inviterUserId);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteeEmail)) {
      throw new Error('Invalid email address');
    }

    // Check if user is already a member
    const existingMembership = await prisma.famMembership.findFirst({
      where: {
        famId,
        user: {
          email: inviteeEmail
        }
      }
    });

    if (existingMembership) {
      throw new Error('User is already a member of this Fam');
    }

    // Check for existing unused invitation
    const existingInvitation = await this.getInvitationByEmail(famId, inviteeEmail);
    if (existingInvitation && !existingInvitation.used && existingInvitation.expiresAt > new Date()) {
      throw new Error('An active invitation already exists for this email');
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.INVITATION_EXPIRY_HOURS);

    // Create invitation record (we'll use a simple table for now)
    // In a real implementation, this would be a proper database table
    const invitation: FamInvitation = {
      id: crypto.randomUUID(),
      famId,
      inviterUserId,
      inviteeEmail,
      token,
      expiresAt,
      createdAt: new Date(),
      used: false
    };

    // Store in memory for now (in production, use database)
    this.storeInvitation(invitation);

    logger.info(`Invitation created for ${inviteeEmail} to join Fam ${famId}`);

    return invitation;
  }

  async joinFam(data: JoinFamRequest): Promise<FamMembership> {
    const { invitationToken, userId } = data;

    // Find and validate invitation
    const invitation = await this.getInvitationByToken(invitationToken);
    
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }

    if (invitation.used) {
      throw new Error('Invitation has already been used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Get user to verify email matches
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.email !== invitation.inviteeEmail) {
      throw new Error('Invitation email does not match user email');
    }

    // Check if user is already a member
    const existingMembership = await prisma.famMembership.findUnique({
      where: {
        userId_famId: {
          userId,
          famId: invitation.famId
        }
      }
    });

    if (existingMembership) {
      throw new Error('User is already a member of this Fam');
    }

    // Create membership
    const membership = await prisma.famMembership.create({
      data: {
        userId,
        famId: invitation.famId,
        role: Role.MEMBER
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        fam: true
      }
    });

    // Mark invitation as used
    invitation.used = true;
    this.storeInvitation(invitation);

    logger.info(`User ${userId} joined Fam ${invitation.famId} via invitation`);

    return membership;
  }

  async removeMember(famId: string, adminUserId: string, memberUserId: string): Promise<void> {
    // Verify admin permissions
    await this.verifyFamAdmin(famId, adminUserId);

    // Cannot remove yourself if you're the only admin
    if (adminUserId === memberUserId) {
      const adminCount = await prisma.famMembership.count({
        where: {
          famId,
          role: Role.ADMIN
        }
      });

      if (adminCount === 1) {
        throw new Error('Cannot remove the only admin from the Fam');
      }
    }

    // Remove membership
    const deleted = await prisma.famMembership.deleteMany({
      where: {
        famId,
        userId: memberUserId
      }
    });

    if (deleted.count === 0) {
      throw new Error('Member not found in this Fam');
    }

    logger.info(`User ${memberUserId} removed from Fam ${famId} by admin ${adminUserId}`);
  }

  async updateMemberRole(famId: string, adminUserId: string, memberUserId: string, newRole: Role): Promise<FamMembership> {
    // Verify admin permissions
    await this.verifyFamAdmin(famId, adminUserId);

    // Cannot demote yourself if you're the only admin
    if (adminUserId === memberUserId && newRole === Role.MEMBER) {
      const adminCount = await prisma.famMembership.count({
        where: {
          famId,
          role: Role.ADMIN
        }
      });

      if (adminCount === 1) {
        throw new Error('Cannot demote the only admin in the Fam');
      }
    }

    const membership = await prisma.famMembership.update({
      where: {
        userId_famId: {
          userId: memberUserId,
          famId
        }
      },
      data: {
        role: newRole
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        fam: true
      }
    });

    logger.info(`User ${memberUserId} role updated to ${newRole} in Fam ${famId} by admin ${adminUserId}`);

    return membership;
  }

  // Helper methods
  async verifyFamMembership(famId: string, userId: string): Promise<FamMembership> {
    const membership = await prisma.famMembership.findUnique({
      where: {
        userId_famId: {
          userId,
          famId
        }
      }
    });

    if (!membership) {
      throw new Error('Access denied: User is not a member of this Fam');
    }

    return membership;
  }

  async verifyFamAdmin(famId: string, userId: string): Promise<FamMembership> {
    const membership = await this.verifyFamMembership(famId, userId);

    if (membership.role !== Role.ADMIN) {
      throw new Error('Access denied: Admin privileges required');
    }

    return membership;
  }

  // Simple in-memory storage for invitations (in production, use database)
  private invitations: Map<string, FamInvitation> = new Map();

  private storeInvitation(invitation: FamInvitation): void {
    this.invitations.set(invitation.token, invitation);
    // Also store by email for lookup
    this.invitations.set(`${invitation.famId}:${invitation.inviteeEmail}`, invitation);
  }

  private async getInvitationByToken(token: string): Promise<FamInvitation | null> {
    return this.invitations.get(token) || null;
  }

  private async getInvitationByEmail(famId: string, email: string): Promise<FamInvitation | null> {
    return this.invitations.get(`${famId}:${email}`) || null;
  }
}

export const famService = new FamService();