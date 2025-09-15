import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { 
  Plan, 
  PlanTask, 
  CreatePlanRequest, 
  UpdatePlanRequest, 
  CreatePlanTaskRequest, 
  UpdatePlanTaskRequest,
  PlanType,
  PlanStatus 
} from '../models/types';
import { validateCreatePlan, validateUpdatePlan, validateCreatePlanTask, validateUpdatePlanTask } from '../models/validation';
import { famService } from './famService';

export interface PlanTemplate {
  id: string;
  type: PlanType;
  name: string;
  description: string;
  defaultFields: Record<string, any>;
  suggestedTasks: string[];
}

export class PlanService {
  // Predefined plan templates for common UK household planning needs
  private readonly planTemplates: PlanTemplate[] = [
    {
      id: 'holiday-template',
      type: PlanType.HOLIDAY,
      name: 'Holiday Planning',
      description: 'Plan and organize family holidays',
      defaultFields: {
        destination: '',
        budget: 0,
        travelers: [],
        accommodation: '',
        transport: ''
      },
      suggestedTasks: [
        'Research destinations',
        'Book flights/transport',
        'Book accommodation',
        'Arrange travel insurance',
        'Plan activities',
        'Pack luggage'
      ]
    },
    {
      id: 'property-move-template',
      type: PlanType.PROPERTY_MOVE,
      name: 'Property Move',
      description: 'Organize moving to a new property',
      defaultFields: {
        currentAddress: '',
        newAddress: '',
        moveDate: null,
        removalsCompany: '',
        budget: 0
      },
      suggestedTasks: [
        'Find removal company',
        'Book removal date',
        'Notify utility companies',
        'Update address with council',
        'Transfer broadband',
        'Update insurance policies',
        'Register with new GP',
        'Update electoral roll'
      ]
    }
  ];

  async createPlan(famId: string, userId: string, data: CreatePlanRequest): Promise<Plan> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate input data
    const validation = validateCreatePlan(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create plan
    const plan = await prisma.plan.create({
      data: {
        famId,
        type: data.type,
        name: data.name.trim(),
        description: data.description?.trim(),
        startDate: data.startDate,
        endDate: data.endDate,
        customFields: data.customFields || {}
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

    logger.info(`Plan created: ${data.name} in Fam ${famId} by user ${userId}`);

    return plan;
  }

  async createPlanFromTemplate(famId: string, userId: string, templateId: string, name: string, customValues?: Record<string, any>): Promise<Plan> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Get template
    const template = this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} not found`);
    }

    // Apply template with custom values
    const customFields = { ...template.defaultFields, ...customValues };

    // Create plan using template
    const plan = await prisma.plan.create({
      data: {
        famId,
        type: template.type,
        name: name.trim(),
        description: template.description,
        customFields
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

    // Create suggested tasks if template has them
    if (template.suggestedTasks.length > 0) {
      const taskPromises = template.suggestedTasks.map(taskTitle =>
        prisma.planTask.create({
          data: {
            planId: plan.id,
            title: taskTitle,
            completed: false
          }
        })
      );

      await Promise.all(taskPromises);

      // Refetch plan with tasks
      const planWithTasks = await this.getPlanById(famId, userId, plan.id);
      if (planWithTasks) {
        return planWithTasks;
      }
    }

    logger.info(`Plan created from template ${templateId}: ${name} in Fam ${famId} by user ${userId}`);

    return plan;
  }

  async getPlanById(famId: string, userId: string, planId: string): Promise<Plan | null> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        famId
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

    return plan;
  }

  async getPlans(famId: string, userId: string): Promise<Plan[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const plans = await prisma.plan.findMany({
      where: {
        famId
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

    return plans;
  }

  async updatePlan(famId: string, userId: string, planId: string, data: UpdatePlanRequest): Promise<Plan> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate input data
    const validation = validateUpdatePlan(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check if plan exists and belongs to the Fam
    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: planId,
        famId
      }
    });

    if (!existingPlan) {
      throw new Error('Plan not found');
    }

    // Update plan
    const plan = await prisma.plan.update({
      where: {
        id: planId
      },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.name && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.status && { status: data.status }),
        ...(data.customFields && { customFields: data.customFields })
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

    logger.info(`Plan updated: ${planId} in Fam ${famId} by user ${userId}`);

    return plan;
  }

  async deletePlan(famId: string, userId: string, planId: string): Promise<void> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Check if plan exists and belongs to the Fam
    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: planId,
        famId
      }
    });

    if (!existingPlan) {
      throw new Error('Plan not found');
    }

    // Delete plan (cascade will delete tasks)
    await prisma.plan.delete({
      where: {
        id: planId
      }
    });

    logger.info(`Plan deleted: ${planId} in Fam ${famId} by user ${userId}`);
  }

  // Template methods
  getTemplates(): PlanTemplate[] {
    return this.planTemplates;
  }

  getTemplateById(templateId: string): PlanTemplate | undefined {
    return this.planTemplates.find(template => template.id === templateId);
  }

  getTemplatesByType(type: PlanType): PlanTemplate[] {
    return this.planTemplates.filter(template => template.type === type);
  }

  // PlanTask management methods
  async createPlanTask(famId: string, userId: string, data: CreatePlanTaskRequest): Promise<PlanTask> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate input data
    const validation = validateCreatePlanTask(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Verify plan exists and belongs to the Fam
    const plan = await prisma.plan.findFirst({
      where: {
        id: data.planId,
        famId
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // If assignedToId is provided, verify the user is a member of the Fam
    if (data.assignedToId) {
      const membership = await prisma.famMembership.findFirst({
        where: {
          userId: data.assignedToId,
          famId
        }
      });

      if (!membership) {
        throw new Error('Assigned user is not a member of this Fam');
      }
    }

    // Create task
    const task = await prisma.planTask.create({
      data: {
        planId: data.planId,
        title: data.title.trim(),
        description: data.description?.trim(),
        assignedToId: data.assignedToId,
        dueDate: data.dueDate,
        completed: false
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info(`Plan task created: ${data.title} for plan ${data.planId} by user ${userId}`);

    return task;
  }

  async getPlanTask(famId: string, userId: string, taskId: string): Promise<PlanTask | null> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const task = await prisma.planTask.findFirst({
      where: {
        id: taskId,
        plan: {
          famId
        }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return task;
  }

  async getPlanTasks(famId: string, userId: string, planId: string): Promise<PlanTask[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Verify plan exists and belongs to the Fam
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        famId
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    const tasks = await prisma.planTask.findMany({
      where: {
        planId
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { completed: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return tasks;
  }

  async updatePlanTask(famId: string, userId: string, taskId: string, data: UpdatePlanTaskRequest): Promise<PlanTask> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Validate input data
    const validation = validateUpdatePlanTask(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Check if task exists and belongs to a plan in the Fam
    const existingTask = await prisma.planTask.findFirst({
      where: {
        id: taskId,
        plan: {
          famId
        }
      }
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // If assignedToId is being updated, verify the user is a member of the Fam
    if (data.assignedToId !== undefined) {
      if (data.assignedToId) {
        const membership = await prisma.famMembership.findFirst({
          where: {
            userId: data.assignedToId,
            famId
          }
        });

        if (!membership) {
          throw new Error('Assigned user is not a member of this Fam');
        }
      }
    }

    // Update task
    const task = await prisma.planTask.update({
      where: {
        id: taskId
      },
      data: {
        ...(data.title && { title: data.title.trim() }),
        ...(data.description !== undefined && { description: data.description?.trim() }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.completed !== undefined && { completed: data.completed })
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info(`Plan task updated: ${taskId} by user ${userId}`);

    return task;
  }

  async deletePlanTask(famId: string, userId: string, taskId: string): Promise<void> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Check if task exists and belongs to a plan in the Fam
    const existingTask = await prisma.planTask.findFirst({
      where: {
        id: taskId,
        plan: {
          famId
        }
      }
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // Delete task
    await prisma.planTask.delete({
      where: {
        id: taskId
      }
    });

    logger.info(`Plan task deleted: ${taskId} by user ${userId}`);
  }

  async assignTask(famId: string, userId: string, taskId: string, assignedToId: string): Promise<PlanTask> {
    return this.updatePlanTask(famId, userId, taskId, { assignedToId });
  }

  async unassignTask(famId: string, userId: string, taskId: string): Promise<PlanTask> {
    return this.updatePlanTask(famId, userId, taskId, { assignedToId: null });
  }

  async completeTask(famId: string, userId: string, taskId: string): Promise<PlanTask> {
    return this.updatePlanTask(famId, userId, taskId, { completed: true });
  }

  async uncompleteTask(famId: string, userId: string, taskId: string): Promise<PlanTask> {
    return this.updatePlanTask(famId, userId, taskId, { completed: false });
  }

  // Progress calculation methods
  async calculatePlanProgress(famId: string, userId: string, planId: string): Promise<{ completed: number; total: number; percentage: number }> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const tasks = await prisma.planTask.findMany({
      where: {
        planId,
        plan: {
          famId
        }
      }
    });

    const completed = tasks.filter(task => task.completed).length;
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  // Milestone and progress tracking methods
  async getTasksByAssignee(famId: string, userId: string, assigneeId: string): Promise<PlanTask[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    // Verify assignee is a member of the Fam
    const membership = await prisma.famMembership.findFirst({
      where: {
        userId: assigneeId,
        famId
      }
    });

    if (!membership) {
      throw new Error('Assignee is not a member of this Fam');
    }

    const tasks = await prisma.planTask.findMany({
      where: {
        assignedToId: assigneeId,
        plan: {
          famId
        }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { completed: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    return tasks;
  }

  async getOverdueTasks(famId: string, userId: string): Promise<PlanTask[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const now = new Date();
    const tasks = await prisma.planTask.findMany({
      where: {
        plan: {
          famId
        },
        completed: false,
        dueDate: {
          lt: now
        }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    return tasks;
  }

  async getUpcomingTasks(famId: string, userId: string, daysAhead: number = 7): Promise<PlanTask[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const tasks = await prisma.planTask.findMany({
      where: {
        plan: {
          famId
        },
        completed: false,
        dueDate: {
          gte: now,
          lte: futureDate
        }
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    return tasks;
  }
}

// Create singleton instance
export const planService = new PlanService();