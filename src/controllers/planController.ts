import { Request, Response } from 'express';
import { planService } from '../services/planService';
import { logger } from '../utils/logger';
import { CreatePlanRequest, UpdatePlanRequest, CreatePlanTaskRequest, UpdatePlanTaskRequest } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export class PlanController {
  // Plan management endpoints
  async createPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      if (!famId) {
        res.status(400).json({ error: 'Fam ID is required' });
        return;
      }

      const data: CreatePlanRequest = { ...req.body, famId };
      const plan = await planService.createPlan(famId, userId, data);

      res.status(201).json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error creating plan:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create plan'
      });
    }
  }

  async createPlanFromTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      if (!famId) {
        res.status(400).json({ error: 'Fam ID is required' });
        return;
      }

      const { templateId, name, customValues } = req.body;
      
      if (!templateId) {
        res.status(400).json({ error: 'Template ID is required' });
        return;
      }

      if (!name || name.trim().length < 2) {
        res.status(400).json({ error: 'Plan name must be at least 2 characters long' });
        return;
      }

      const plan = await planService.createPlanFromTemplate(famId, userId, templateId, name, customValues);

      res.status(201).json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error creating plan from template:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create plan from template'
      });
    }
  }

  async getPlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      const plan = await planService.getPlanById(famId, userId, planId);

      if (!plan) {
        res.status(404).json({ error: 'Plan not found' });
        return;
      }

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error getting plan:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get plan'
      });
    }
  }

  async getPlans(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const plans = await planService.getPlans(famId, userId);

      res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      logger.error('Error getting plans:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get plans'
      });
    }
  }

  async updatePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      const data: UpdatePlanRequest = req.body;
      const plan = await planService.updatePlan(famId, userId, planId, data);

      res.json({
        success: true,
        data: plan
      });
    } catch (error) {
      logger.error('Error updating plan:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update plan'
      });
    }
  }

  async deletePlan(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      await planService.deletePlan(famId, userId, planId);

      res.json({
        success: true,
        message: 'Plan deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting plan:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to delete plan'
      });
    }
  }

  async getPlanProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      const progress = await planService.calculatePlanProgress(famId, userId, planId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      logger.error('Error getting plan progress:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get plan progress'
      });
    }
  }

  // PlanTask management endpoints
  async createPlanTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      const data: CreatePlanTaskRequest = { ...req.body, planId };
      const task = await planService.createPlanTask(famId, userId, data);

      res.status(201).json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error creating plan task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to create plan task'
      });
    }
  }

  async getPlanTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const task = await planService.getPlanTask(famId, userId, taskId);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error getting plan task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 404;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get plan task'
      });
    }
  }

  async getPlanTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, planId } = req.params;
      const tasks = await planService.getPlanTasks(famId, userId, planId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      logger.error('Error getting plan tasks:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get plan tasks'
      });
    }
  }

  async updatePlanTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const data: UpdatePlanTaskRequest = req.body;
      const task = await planService.updatePlanTask(famId, userId, taskId, data);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error updating plan task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to update plan task'
      });
    }
  }

  async deletePlanTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      await planService.deletePlanTask(famId, userId, taskId);

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting plan task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to delete plan task'
      });
    }
  }

  // Task assignment and status management
  async assignTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const { assignedToId } = req.body;

      if (!assignedToId) {
        res.status(400).json({ error: 'Assigned user ID is required' });
        return;
      }

      const task = await planService.assignTask(famId, userId, taskId, assignedToId);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error assigning task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to assign task'
      });
    }
  }

  async unassignTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const task = await planService.unassignTask(famId, userId, taskId);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error unassigning task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to unassign task'
      });
    }
  }

  async completeTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const task = await planService.completeTask(famId, userId, taskId);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error completing task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to complete task'
      });
    }
  }

  async uncompleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, taskId } = req.params;
      const task = await planService.uncompleteTask(famId, userId, taskId);

      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('Error uncompleting task:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to uncomplete task'
      });
    }
  }

  // Task filtering and reporting endpoints
  async getTasksByAssignee(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId, assigneeId } = req.params;
      const tasks = await planService.getTasksByAssignee(famId, userId, assigneeId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      logger.error('Error getting tasks by assignee:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get tasks by assignee'
      });
    }
  }

  async getOverdueTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const tasks = await planService.getOverdueTasks(famId, userId);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      logger.error('Error getting overdue tasks:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get overdue tasks'
      });
    }
  }

  async getUpcomingTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { famId } = req.params;
      const { days } = req.query;
      const daysAhead = days && typeof days === 'string' ? parseInt(days, 10) : 7;

      if (isNaN(daysAhead) || daysAhead < 1) {
        res.status(400).json({ error: 'Days parameter must be a positive number' });
        return;
      }

      const tasks = await planService.getUpcomingTasks(famId, userId, daysAhead);

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      logger.error('Error getting upcoming tasks:', error);
      const statusCode = error instanceof Error && error.message.includes('Access denied') ? 403 : 400;
      res.status(statusCode).json({
        error: error instanceof Error ? error.message : 'Failed to get upcoming tasks'
      });
    }
  }

  // Template-related endpoints
  async getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { type } = req.query;
      let templates;

      if (type && typeof type === 'string') {
        templates = planService.getTemplatesByType(type as any);
      } else {
        templates = planService.getTemplates();
      }

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get templates'
      });
    }
  }

  async getTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { templateId } = req.params;
      const template = planService.getTemplateById(templateId);

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get template'
      });
    }
  }
}

export const planController = new PlanController();