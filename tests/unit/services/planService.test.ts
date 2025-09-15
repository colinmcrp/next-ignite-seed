import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PlanService } from '../../../src/services/planService';
import { prisma } from '../../../src/lib/prisma';
import { famService } from '../../../src/services/famService';
import { PlanType, PlanStatus } from '../../../src/models/types';

// Mock dependencies
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    plan: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    planTask: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    famMembership: {
      findFirst: vi.fn()
    }
  }
}));

vi.mock('../../../src/services/famService', () => ({
  famService: {
    verifyFamMembership: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('PlanService', () => {
  let planService: PlanService;
  const mockUserId = 'user-123';
  const mockFamId = 'fam-123';
  const mockPlanId = 'plan-123';

  beforeEach(() => {
    planService = new PlanService();
    vi.clearAllMocks();
  });

  describe('createPlan', () => {
    const validPlanData = {
      famId: mockFamId,
      type: PlanType.HOLIDAY,
      name: 'Summer Holiday 2024',
      description: 'Family trip to Spain',
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-07-14'),
      customFields: { budget: 2000, destination: 'Spain' }
    };

    it('should create a plan successfully', async () => {
      const mockPlan = {
        id: mockPlanId,
        ...validPlanData,
        status: PlanStatus.PLANNING,
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.create as Mock).mockResolvedValue(mockPlan);

      const result = await planService.createPlan(mockFamId, mockUserId, validPlanData);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          famId: mockFamId,
          type: validPlanData.type,
          name: validPlanData.name,
          description: validPlanData.description,
          startDate: validPlanData.startDate,
          endDate: validPlanData.endDate,
          customFields: validPlanData.customFields
        },
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });
      expect(result).toEqual(mockPlan);
    });

    it('should throw error if user is not a Fam member', async () => {
      (famService.verifyFamMembership as Mock).mockRejectedValue(new Error('User not authorized'));

      await expect(planService.createPlan(mockFamId, mockUserId, validPlanData))
        .rejects.toThrow('User not authorized');

      expect(prisma.plan.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid plan data', async () => {
      const invalidPlanData = {
        famId: mockFamId,
        type: PlanType.HOLIDAY,
        name: '', // Invalid: empty name
        description: 'Test plan'
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);

      await expect(planService.createPlan(mockFamId, mockUserId, invalidPlanData))
        .rejects.toThrow('Validation failed');

      expect(prisma.plan.create).not.toHaveBeenCalled();
    });
  });

  describe('createPlanFromTemplate', () => {
    it('should create a plan from holiday template', async () => {
      const mockPlan = {
        id: mockPlanId,
        famId: mockFamId,
        type: PlanType.HOLIDAY,
        name: 'Summer Holiday',
        description: 'Plan and organize family holidays',
        status: PlanStatus.PLANNING,
        customFields: { destination: 'Spain', budget: 2000 },
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.create as Mock).mockResolvedValue(mockPlan);
      (prisma.planTask.create as Mock).mockResolvedValue({});

      const result = await planService.createPlanFromTemplate(
        mockFamId, 
        mockUserId, 
        'holiday-template', 
        'Summer Holiday',
        { destination: 'Spain', budget: 2000 }
      );

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.create).toHaveBeenCalled();
      expect(prisma.planTask.create).toHaveBeenCalledTimes(6); // Holiday template has 6 suggested tasks
    });

    it('should throw error for invalid template ID', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);

      await expect(planService.createPlanFromTemplate(
        mockFamId, 
        mockUserId, 
        'invalid-template', 
        'Test Plan'
      )).rejects.toThrow('Template with ID invalid-template not found');

      expect(prisma.plan.create).not.toHaveBeenCalled();
    });
  });

  describe('getPlanById', () => {
    it('should return plan by ID', async () => {
      const mockPlan = {
        id: mockPlanId,
        famId: mockFamId,
        type: PlanType.HOLIDAY,
        name: 'Summer Holiday',
        description: 'Family trip',
        status: PlanStatus.PLANNING,
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        tasks: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(mockPlan);

      const result = await planService.getPlanById(mockFamId, mockUserId, mockPlanId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPlanId,
          famId: mockFamId
        },
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });
      expect(result).toEqual(mockPlan);
    });

    it('should return null if plan not found', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(null);

      const result = await planService.getPlanById(mockFamId, mockUserId, mockPlanId);

      expect(result).toBeNull();
    });
  });

  describe('getPlans', () => {
    it('should return all plans for a Fam', async () => {
      const mockPlans = [
        {
          id: 'plan-1',
          famId: mockFamId,
          type: PlanType.HOLIDAY,
          name: 'Holiday Plan',
          status: PlanStatus.PLANNING,
          tasks: []
        },
        {
          id: 'plan-2',
          famId: mockFamId,
          type: PlanType.PROPERTY_MOVE,
          name: 'Moving Plan',
          status: PlanStatus.IN_PROGRESS,
          tasks: []
        }
      ];

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findMany as Mock).mockResolvedValue(mockPlans);

      const result = await planService.getPlans(mockFamId, mockUserId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: {
          famId: mockFamId
        },
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      expect(result).toEqual(mockPlans);
    });
  });

  describe('updatePlan', () => {
    const updateData = {
      name: 'Updated Plan Name',
      status: PlanStatus.IN_PROGRESS,
      customFields: { budget: 3000 }
    };

    it('should update plan successfully', async () => {
      const existingPlan = {
        id: mockPlanId,
        famId: mockFamId,
        type: PlanType.HOLIDAY,
        name: 'Original Plan',
        status: PlanStatus.PLANNING
      };

      const updatedPlan = {
        ...existingPlan,
        ...updateData,
        updatedAt: new Date(),
        tasks: []
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(existingPlan);
      (prisma.plan.update as Mock).mockResolvedValue(updatedPlan);

      const result = await planService.updatePlan(mockFamId, mockUserId, mockPlanId, updateData);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPlanId,
          famId: mockFamId
        }
      });
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: {
          id: mockPlanId
        },
        data: {
          name: updateData.name,
          status: updateData.status,
          customFields: updateData.customFields
        },
        include: {
          tasks: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      });
      expect(result).toEqual(updatedPlan);
    });

    it('should throw error if plan not found', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(null);

      await expect(planService.updatePlan(mockFamId, mockUserId, mockPlanId, updateData))
        .rejects.toThrow('Plan not found');

      expect(prisma.plan.update).not.toHaveBeenCalled();
    });
  });

  describe('deletePlan', () => {
    it('should delete plan successfully', async () => {
      const existingPlan = {
        id: mockPlanId,
        famId: mockFamId,
        type: PlanType.HOLIDAY,
        name: 'Plan to Delete'
      };

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(existingPlan);
      (prisma.plan.delete as Mock).mockResolvedValue(existingPlan);

      await planService.deletePlan(mockFamId, mockUserId, mockPlanId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockPlanId,
          famId: mockFamId
        }
      });
      expect(prisma.plan.delete).toHaveBeenCalledWith({
        where: {
          id: mockPlanId
        }
      });
    });

    it('should throw error if plan not found', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.plan.findFirst as Mock).mockResolvedValue(null);

      await expect(planService.deletePlan(mockFamId, mockUserId, mockPlanId))
        .rejects.toThrow('Plan not found');

      expect(prisma.plan.delete).not.toHaveBeenCalled();
    });
  });

  describe('template methods', () => {
    it('should return all templates', () => {
      const templates = planService.getTemplates();
      
      expect(templates).toHaveLength(2);
      expect(templates[0].type).toBe(PlanType.HOLIDAY);
      expect(templates[1].type).toBe(PlanType.PROPERTY_MOVE);
    });

    it('should return template by ID', () => {
      const template = planService.getTemplateById('holiday-template');
      
      expect(template).toBeDefined();
      expect(template?.type).toBe(PlanType.HOLIDAY);
      expect(template?.name).toBe('Holiday Planning');
    });

    it('should return undefined for invalid template ID', () => {
      const template = planService.getTemplateById('invalid-template');
      
      expect(template).toBeUndefined();
    });

    it('should return templates by type', () => {
      const holidayTemplates = planService.getTemplatesByType(PlanType.HOLIDAY);
      
      expect(holidayTemplates).toHaveLength(1);
      expect(holidayTemplates[0].type).toBe(PlanType.HOLIDAY);
    });
  });

  describe('PlanTask management', () => {
    const mockTaskId = 'task-123';
    const mockAssigneeId = 'assignee-123';

    describe('createPlanTask', () => {
      const validTaskData = {
        planId: mockPlanId,
        title: 'Book flights',
        description: 'Book return flights to Spain',
        assignedToId: mockAssigneeId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      it('should create a plan task successfully', async () => {
        const mockPlan = { id: mockPlanId, famId: mockFamId };
        const mockMembership = { userId: mockAssigneeId, famId: mockFamId };
        const mockTask = {
          id: mockTaskId,
          ...validTaskData,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          assignedTo: {
            id: mockAssigneeId,
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(mockPlan);
        (prisma.famMembership.findFirst as Mock).mockResolvedValue(mockMembership);
        (prisma.planTask.create as Mock).mockResolvedValue(mockTask);

        const result = await planService.createPlanTask(mockFamId, mockUserId, validTaskData);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.plan.findFirst).toHaveBeenCalledWith({
          where: { id: mockPlanId, famId: mockFamId }
        });
        expect(prisma.famMembership.findFirst).toHaveBeenCalledWith({
          where: { userId: mockAssigneeId, famId: mockFamId }
        });
        expect(prisma.planTask.create).toHaveBeenCalledWith({
          data: {
            planId: validTaskData.planId,
            title: validTaskData.title,
            description: validTaskData.description,
            assignedToId: validTaskData.assignedToId,
            dueDate: validTaskData.dueDate,
            completed: false
          },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          }
        });
        expect(result).toEqual(mockTask);
      });

      it('should throw error if plan not found', async () => {
        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(null);

        await expect(planService.createPlanTask(mockFamId, mockUserId, validTaskData))
          .rejects.toThrow('Plan not found');

        expect(prisma.planTask.create).not.toHaveBeenCalled();
      });

      it('should throw error if assigned user is not a Fam member', async () => {
        const mockPlan = { id: mockPlanId, famId: mockFamId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(mockPlan);
        (prisma.famMembership.findFirst as Mock).mockResolvedValue(null);

        await expect(planService.createPlanTask(mockFamId, mockUserId, validTaskData))
          .rejects.toThrow('Assigned user is not a member of this Fam');

        expect(prisma.planTask.create).not.toHaveBeenCalled();
      });

      it('should create task without assignment', async () => {
        const taskDataWithoutAssignment = {
          planId: mockPlanId,
          title: 'Research destinations',
          description: 'Look up holiday destinations'
        };

        const mockPlan = { id: mockPlanId, famId: mockFamId };
        const mockTask = {
          id: mockTaskId,
          ...taskDataWithoutAssignment,
          assignedToId: null,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          assignedTo: null
        };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(mockPlan);
        (prisma.planTask.create as Mock).mockResolvedValue(mockTask);

        const result = await planService.createPlanTask(mockFamId, mockUserId, taskDataWithoutAssignment);

        expect(prisma.famMembership.findFirst).not.toHaveBeenCalled();
        expect(result).toEqual(mockTask);
      });
    });

    describe('getPlanTask', () => {
      it('should return task by ID', async () => {
        const mockTask = {
          id: mockTaskId,
          planId: mockPlanId,
          title: 'Book flights',
          completed: false,
          assignedTo: {
            id: mockAssigneeId,
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(mockTask);

        const result = await planService.getPlanTask(mockFamId, mockUserId, mockTaskId);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.planTask.findFirst).toHaveBeenCalledWith({
          where: {
            id: mockTaskId,
            plan: { famId: mockFamId }
          },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          }
        });
        expect(result).toEqual(mockTask);
      });

      it('should return null if task not found', async () => {
        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(null);

        const result = await planService.getPlanTask(mockFamId, mockUserId, mockTaskId);

        expect(result).toBeNull();
      });
    });

    describe('getPlanTasks', () => {
      it('should return all tasks for a plan', async () => {
        const mockPlan = { id: mockPlanId, famId: mockFamId };
        const mockTasks = [
          {
            id: 'task-1',
            planId: mockPlanId,
            title: 'Task 1',
            completed: false,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            assignedTo: null
          },
          {
            id: 'task-2',
            planId: mockPlanId,
            title: 'Task 2',
            completed: true,
            dueDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
            assignedTo: {
              id: mockAssigneeId,
              name: 'John Doe',
              email: 'john@example.com'
            }
          }
        ];

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(mockPlan);
        (prisma.planTask.findMany as Mock).mockResolvedValue(mockTasks);

        const result = await planService.getPlanTasks(mockFamId, mockUserId, mockPlanId);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.plan.findFirst).toHaveBeenCalledWith({
          where: { id: mockPlanId, famId: mockFamId }
        });
        expect(prisma.planTask.findMany).toHaveBeenCalledWith({
          where: { planId: mockPlanId },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: [
            { completed: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'asc' }
          ]
        });
        expect(result).toEqual(mockTasks);
      });

      it('should throw error if plan not found', async () => {
        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.plan.findFirst as Mock).mockResolvedValue(null);

        await expect(planService.getPlanTasks(mockFamId, mockUserId, mockPlanId))
          .rejects.toThrow('Plan not found');

        expect(prisma.planTask.findMany).not.toHaveBeenCalled();
      });
    });

    describe('updatePlanTask', () => {
      const updateData = {
        title: 'Updated task title',
        completed: true,
        assignedToId: mockAssigneeId
      };

      it('should update task successfully', async () => {
        const existingTask = {
          id: mockTaskId,
          planId: mockPlanId,
          title: 'Original title',
          completed: false
        };

        const updatedTask = {
          ...existingTask,
          ...updateData,
          updatedAt: new Date(),
          assignedTo: {
            id: mockAssigneeId,
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        const mockMembership = { userId: mockAssigneeId, famId: mockFamId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.famMembership.findFirst as Mock).mockResolvedValue(mockMembership);
        (prisma.planTask.update as Mock).mockResolvedValue(updatedTask);

        const result = await planService.updatePlanTask(mockFamId, mockUserId, mockTaskId, updateData);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.planTask.findFirst).toHaveBeenCalledWith({
          where: {
            id: mockTaskId,
            plan: { famId: mockFamId }
          }
        });
        expect(prisma.famMembership.findFirst).toHaveBeenCalledWith({
          where: { userId: mockAssigneeId, famId: mockFamId }
        });
        expect(prisma.planTask.update).toHaveBeenCalledWith({
          where: { id: mockTaskId },
          data: {
            title: updateData.title,
            assignedToId: updateData.assignedToId,
            completed: updateData.completed
          },
          include: {
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          }
        });
        expect(result).toEqual(updatedTask);
      });

      it('should throw error if task not found', async () => {
        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(null);

        await expect(planService.updatePlanTask(mockFamId, mockUserId, mockTaskId, updateData))
          .rejects.toThrow('Task not found');

        expect(prisma.planTask.update).not.toHaveBeenCalled();
      });
    });

    describe('deletePlanTask', () => {
      it('should delete task successfully', async () => {
        const existingTask = {
          id: mockTaskId,
          planId: mockPlanId,
          title: 'Task to delete'
        };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.planTask.delete as Mock).mockResolvedValue(existingTask);

        await planService.deletePlanTask(mockFamId, mockUserId, mockTaskId);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.planTask.findFirst).toHaveBeenCalledWith({
          where: {
            id: mockTaskId,
            plan: { famId: mockFamId }
          }
        });
        expect(prisma.planTask.delete).toHaveBeenCalledWith({
          where: { id: mockTaskId }
        });
      });

      it('should throw error if task not found', async () => {
        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(null);

        await expect(planService.deletePlanTask(mockFamId, mockUserId, mockTaskId))
          .rejects.toThrow('Task not found');

        expect(prisma.planTask.delete).not.toHaveBeenCalled();
      });
    });

    describe('task assignment methods', () => {
      it('should assign task', async () => {
        const mockTask = {
          id: mockTaskId,
          assignedToId: mockAssigneeId,
          assignedTo: {
            id: mockAssigneeId,
            name: 'John Doe',
            email: 'john@example.com'
          }
        };

        const existingTask = { id: mockTaskId, planId: mockPlanId };
        const mockMembership = { userId: mockAssigneeId, famId: mockFamId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.famMembership.findFirst as Mock).mockResolvedValue(mockMembership);
        (prisma.planTask.update as Mock).mockResolvedValue(mockTask);

        const result = await planService.assignTask(mockFamId, mockUserId, mockTaskId, mockAssigneeId);

        expect(result).toEqual(mockTask);
      });

      it('should unassign task', async () => {
        const mockTask = {
          id: mockTaskId,
          assignedToId: null,
          assignedTo: null
        };

        const existingTask = { id: mockTaskId, planId: mockPlanId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.planTask.update as Mock).mockResolvedValue(mockTask);

        const result = await planService.unassignTask(mockFamId, mockUserId, mockTaskId);

        expect(result).toEqual(mockTask);
      });

      it('should complete task', async () => {
        const mockTask = {
          id: mockTaskId,
          completed: true
        };

        const existingTask = { id: mockTaskId, planId: mockPlanId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.planTask.update as Mock).mockResolvedValue(mockTask);

        const result = await planService.completeTask(mockFamId, mockUserId, mockTaskId);

        expect(result).toEqual(mockTask);
      });

      it('should uncomplete task', async () => {
        const mockTask = {
          id: mockTaskId,
          completed: false
        };

        const existingTask = { id: mockTaskId, planId: mockPlanId };

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findFirst as Mock).mockResolvedValue(existingTask);
        (prisma.planTask.update as Mock).mockResolvedValue(mockTask);

        const result = await planService.uncompleteTask(mockFamId, mockUserId, mockTaskId);

        expect(result).toEqual(mockTask);
      });
    });

    describe('task filtering and reporting', () => {
      it('should get tasks by assignee', async () => {
        const mockMembership = { userId: mockAssigneeId, famId: mockFamId };
        const mockTasks = [
          {
            id: 'task-1',
            assignedToId: mockAssigneeId,
            title: 'Task 1',
            completed: false,
            plan: { id: mockPlanId, name: 'Holiday Plan', type: 'HOLIDAY' },
            assignedTo: { id: mockAssigneeId, name: 'John Doe', email: 'john@example.com' }
          }
        ];

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.famMembership.findFirst as Mock).mockResolvedValue(mockMembership);
        (prisma.planTask.findMany as Mock).mockResolvedValue(mockTasks);

        const result = await planService.getTasksByAssignee(mockFamId, mockUserId, mockAssigneeId);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.famMembership.findFirst).toHaveBeenCalledWith({
          where: { userId: mockAssigneeId, famId: mockFamId }
        });
        expect(prisma.planTask.findMany).toHaveBeenCalledWith({
          where: {
            assignedToId: mockAssigneeId,
            plan: { famId: mockFamId }
          },
          include: {
            plan: {
              select: { id: true, name: true, type: true }
            },
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: [
            { completed: 'asc' },
            { dueDate: 'asc' },
            { createdAt: 'asc' }
          ]
        });
        expect(result).toEqual(mockTasks);
      });

      it('should get overdue tasks', async () => {
        const mockTasks = [
          {
            id: 'task-1',
            title: 'Overdue task',
            completed: false,
            dueDate: new Date('2020-01-01'),
            plan: { id: mockPlanId, name: 'Holiday Plan', type: 'HOLIDAY' }
          }
        ];

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findMany as Mock).mockResolvedValue(mockTasks);

        const result = await planService.getOverdueTasks(mockFamId, mockUserId);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.planTask.findMany).toHaveBeenCalledWith({
          where: {
            plan: { famId: mockFamId },
            completed: false,
            dueDate: { lt: expect.any(Date) }
          },
          include: {
            plan: {
              select: { id: true, name: true, type: true }
            },
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { dueDate: 'asc' }
        });
        expect(result).toEqual(mockTasks);
      });

      it('should get upcoming tasks', async () => {
        const mockTasks = [
          {
            id: 'task-1',
            title: 'Upcoming task',
            completed: false,
            dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            plan: { id: mockPlanId, name: 'Holiday Plan', type: 'HOLIDAY' }
          }
        ];

        (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
        (prisma.planTask.findMany as Mock).mockResolvedValue(mockTasks);

        const result = await planService.getUpcomingTasks(mockFamId, mockUserId, 7);

        expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
        expect(prisma.planTask.findMany).toHaveBeenCalledWith({
          where: {
            plan: { famId: mockFamId },
            completed: false,
            dueDate: {
              gte: expect.any(Date),
              lte: expect.any(Date)
            }
          },
          include: {
            plan: {
              select: { id: true, name: true, type: true }
            },
            assignedTo: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { dueDate: 'asc' }
        });
        expect(result).toEqual(mockTasks);
      });
    });
  });

  describe('calculatePlanProgress', () => {
    it('should calculate progress correctly', async () => {
      const mockTasks = [
        { id: 'task-1', completed: true },
        { id: 'task-2', completed: false },
        { id: 'task-3', completed: true },
        { id: 'task-4', completed: false }
      ];

      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.planTask.findMany as Mock).mockResolvedValue(mockTasks);

      const result = await planService.calculatePlanProgress(mockFamId, mockUserId, mockPlanId);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
      expect(prisma.planTask.findMany).toHaveBeenCalledWith({
        where: {
          planId: mockPlanId,
          plan: {
            famId: mockFamId
          }
        }
      });
      expect(result).toEqual({
        completed: 2,
        total: 4,
        percentage: 50
      });
    });

    it('should handle empty task list', async () => {
      (famService.verifyFamMembership as Mock).mockResolvedValue(undefined);
      (prisma.planTask.findMany as Mock).mockResolvedValue([]);

      const result = await planService.calculatePlanProgress(mockFamId, mockUserId, mockPlanId);

      expect(result).toEqual({
        completed: 0,
        total: 0,
        percentage: 0
      });
    });
  });
});