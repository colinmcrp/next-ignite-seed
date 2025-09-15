import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FamService } from '../../../src/services/famService';
import { Role } from '../../../src/models/types';
import { prisma } from '../../../src/lib/prisma';

// Mock Prisma
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    fam: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    famMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('FamService', () => {
  let famService: FamService;
  const mockUserId = 'user-123';
  const mockFamId = 'fam-123';
  const mockEmail = 'test@example.com';

  beforeEach(() => {
    famService = new FamService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createFam', () => {
    it('should create a new Fam with creator as admin', async () => {
      const mockFam = {
        id: mockFamId,
        name: 'Test Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [{
          id: 'membership-123',
          userId: mockUserId,
          famId: mockFamId,
          role: Role.ADMIN,
          joinedAt: new Date(),
          user: {
            id: mockUserId,
            email: mockEmail,
            name: 'Test User'
          }
        }]
      };

      (prisma.fam.create as any).mockResolvedValue(mockFam);

      const result = await famService.createFam(mockUserId, { name: 'Test Family' });

      expect(prisma.fam.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Family',
          members: {
            create: {
              userId: mockUserId,
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

      expect(result).toEqual(mockFam);
    });

    it('should throw error for empty name', async () => {
      await expect(famService.createFam(mockUserId, { name: '' }))
        .rejects.toThrow('Fam name is required');
    });

    it('should throw error for name too long', async () => {
      const longName = 'a'.repeat(101);
      await expect(famService.createFam(mockUserId, { name: longName }))
        .rejects.toThrow('Fam name must be 100 characters or less');
    });

    it('should trim whitespace from name', async () => {
      const mockFam = {
        id: mockFamId,
        name: 'Test Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: []
      };

      (prisma.fam.create as any).mockResolvedValue(mockFam);

      await famService.createFam(mockUserId, { name: '  Test Family  ' });

      expect(prisma.fam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Family'
          })
        })
      );
    });
  });

  describe('getFamById', () => {
    it('should return Fam details for authorized user', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.MEMBER,
        joinedAt: new Date()
      };

      const mockFam = {
        id: mockFamId,
        name: 'Test Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [mockMembership],
        assets: [],
        accounts: [],
        plans: []
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);
      (prisma.fam.findUnique as any).mockResolvedValue(mockFam);

      const result = await famService.getFamById(mockFamId, mockUserId);

      expect(result).toEqual(mockFam);
    });

    it('should throw error for non-member', async () => {
      (prisma.famMembership.findUnique as any).mockResolvedValue(null);

      await expect(famService.getFamById(mockFamId, mockUserId))
        .rejects.toThrow('Access denied: User is not a member of this Fam');
    });

    it('should throw error if Fam not found', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.MEMBER,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);
      (prisma.fam.findUnique as any).mockResolvedValue(null);

      await expect(famService.getFamById(mockFamId, mockUserId))
        .rejects.toThrow('Fam not found');
    });
  });

  describe('updateFam', () => {
    it('should update Fam for admin user', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      const mockUpdatedFam = {
        id: mockFamId,
        name: 'Updated Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [mockMembership]
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);
      (prisma.fam.update as any).mockResolvedValue(mockUpdatedFam);

      const result = await famService.updateFam(mockFamId, mockUserId, { name: 'Updated Family' });

      expect(prisma.fam.update).toHaveBeenCalledWith({
        where: { id: mockFamId },
        data: { name: 'Updated Family' },
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

      expect(result).toEqual(mockUpdatedFam);
    });

    it('should throw error for non-admin user', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.MEMBER,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await expect(famService.updateFam(mockFamId, mockUserId, { name: 'Updated Family' }))
        .rejects.toThrow('Access denied: Admin privileges required');
    });
  });

  describe('getUserFams', () => {
    it('should return user\'s Fams with memberships', async () => {
      const mockMemberships = [
        {
          id: 'membership-123',
          userId: mockUserId,
          famId: mockFamId,
          role: Role.ADMIN,
          joinedAt: new Date(),
          fam: {
            id: mockFamId,
            name: 'Test Family',
            createdAt: new Date(),
            updatedAt: new Date(),
            members: []
          }
        }
      ];

      (prisma.famMembership.findMany as any).mockResolvedValue(mockMemberships);

      const result = await famService.getUserFams(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].fam.name).toBe('Test Family');
      expect(result[0].membership.role).toBe(Role.ADMIN);
    });
  });

  describe('createInvitation', () => {
    it('should create invitation for admin user', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);
      (prisma.famMembership.findFirst as any).mockResolvedValue(null); // No existing membership

      const result = await famService.createInvitation({
        famId: mockFamId,
        inviterUserId: mockUserId,
        inviteeEmail: 'invitee@example.com'
      });

      expect(result.famId).toBe(mockFamId);
      expect(result.inviteeEmail).toBe('invitee@example.com');
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid email', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);

      await expect(famService.createInvitation({
        famId: mockFamId,
        inviterUserId: mockUserId,
        inviteeEmail: 'invalid-email'
      })).rejects.toThrow('Invalid email address');
    });

    it('should throw error if user is already a member', async () => {
      const mockMembership = {
        id: 'membership-123',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      const mockExistingMembership = {
        id: 'existing-membership',
        userId: 'other-user',
        famId: mockFamId,
        role: Role.MEMBER,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockMembership);
      (prisma.famMembership.findFirst as any).mockResolvedValue(mockExistingMembership);

      await expect(famService.createInvitation({
        famId: mockFamId,
        inviterUserId: mockUserId,
        inviteeEmail: 'existing@example.com'
      })).rejects.toThrow('User is already a member of this Fam');
    });
  });

  describe('joinFam', () => {
    it('should allow user to join Fam with valid invitation', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockEmail,
        name: 'Test User'
      };

      const mockAdminMembership = {
        id: 'admin-membership',
        userId: 'admin-user',
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      const mockMembership = {
        id: 'new-membership',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.MEMBER,
        joinedAt: new Date(),
        user: mockUser,
        fam: {
          id: mockFamId,
          name: 'Test Family'
        }
      };

      // Mock admin membership for invitation creation
      (prisma.famMembership.findUnique as any).mockResolvedValue(mockAdminMembership);
      (prisma.famMembership.findFirst as any).mockResolvedValue(null); // No existing membership

      // Create a valid invitation first
      const invitation = await famService.createInvitation({
        famId: mockFamId,
        inviterUserId: 'admin-user',
        inviteeEmail: mockEmail
      });

      // Mock for joining
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.famMembership.findUnique as any).mockResolvedValue(null); // No existing membership
      (prisma.famMembership.create as any).mockResolvedValue(mockMembership);

      const result = await famService.joinFam({
        invitationToken: invitation.token,
        userId: mockUserId
      });

      expect(result).toEqual(mockMembership);
    });

    it('should throw error for invalid invitation token', async () => {
      await expect(famService.joinFam({
        invitationToken: 'invalid-token',
        userId: mockUserId
      })).rejects.toThrow('Invalid invitation token');
    });
  });

  describe('removeMember', () => {
    it('should allow admin to remove member', async () => {
      const mockAdminMembership = {
        id: 'admin-membership',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockAdminMembership);
      (prisma.famMembership.deleteMany as any).mockResolvedValue({ count: 1 });

      await famService.removeMember(mockFamId, mockUserId, 'member-to-remove');

      expect(prisma.famMembership.deleteMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId,
          userId: 'member-to-remove'
        }
      });
    });

    it('should prevent removing the only admin', async () => {
      const mockAdminMembership = {
        id: 'admin-membership',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockAdminMembership);
      (prisma.famMembership.count as any).mockResolvedValue(1); // Only one admin

      await expect(famService.removeMember(mockFamId, mockUserId, mockUserId))
        .rejects.toThrow('Cannot remove the only admin from the Fam');
    });
  });

  describe('updateMemberRole', () => {
    it('should allow admin to update member role', async () => {
      const mockAdminMembership = {
        id: 'admin-membership',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      const mockUpdatedMembership = {
        id: 'member-membership',
        userId: 'member-user',
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date(),
        user: {
          id: 'member-user',
          email: 'member@example.com',
          name: 'Member User'
        },
        fam: {
          id: mockFamId,
          name: 'Test Family'
        }
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockAdminMembership);
      (prisma.famMembership.update as any).mockResolvedValue(mockUpdatedMembership);

      const result = await famService.updateMemberRole(mockFamId, mockUserId, 'member-user', Role.ADMIN);

      expect(result).toEqual(mockUpdatedMembership);
    });

    it('should prevent demoting the only admin', async () => {
      const mockAdminMembership = {
        id: 'admin-membership',
        userId: mockUserId,
        famId: mockFamId,
        role: Role.ADMIN,
        joinedAt: new Date()
      };

      (prisma.famMembership.findUnique as any).mockResolvedValue(mockAdminMembership);
      (prisma.famMembership.count as any).mockResolvedValue(1); // Only one admin

      await expect(famService.updateMemberRole(mockFamId, mockUserId, mockUserId, Role.MEMBER))
        .rejects.toThrow('Cannot demote the only admin in the Fam');
    });
  });
});