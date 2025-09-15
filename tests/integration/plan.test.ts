import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { PlanType, PlanStatus } from '../../src/models/types';

describe('Plan API Integration Tests', () => {
  let authToken: string;
  let userId: string;
  let famId: string;
  let planId: string;

  beforeEach(async () => {
    // Clean up database
    await prisma.planTask.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();

    // Create test user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    expect(userResponse.status).toBe(201);
    authToken = userResponse.body.data.accessToken;
    userId = userResponse.body.data.user.id;

    // Create test Fam
    const famResponse = await request(app)
      .post('/api/fams')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Family'
      });

    expect(famResponse.status).toBe(201);
    famId = famResponse.body.data.id;
  });

  afterEach(async () => {
    // Clean up database
    await prisma.planTask.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.famMembership.deleteMany();
    await prisma.fam.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Plan Service Integration', () => {
    it('should create a plan successfully', async () => {
      const planData = {
        type: PlanType.HOLIDAY,
        name: 'Summer Holiday 2024',
        description: 'Family trip to Spain',
        startDate: '2024-07-01T00:00:00.000Z',
        endDate: '2024-07-14T00:00:00.000Z',
        customFields: {
          budget: 2000,
          destination: 'Spain',
          travelers: ['John', 'Jane', 'Kids']
        }
      };

      // Create plan using service directly (since we don't have controllers yet)
      const { planService } = await import('../../src/services/planService');
      
      const plan = await planService.createPlan(famId, userId, {
        ...planData,
        famId,
        startDate: new Date(planData.startDate),
        endDate: new Date(planData.endDate)
      });

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.famId).toBe(famId);
      expect(plan.type).toBe(planData.type);
      expect(plan.name).toBe(planData.name);
      expect(plan.description).toBe(planData.description);
      expect(plan.status).toBe(PlanStatus.PLANNING);
      expect(plan.customFields).toEqual(planData.customFields);
      expect(plan.tasks).toEqual([]);

      planId = plan.id;
    });

    it('should create a plan from template', async () => {
      const { planService } = await import('../../src/services/planService');
      
      const plan = await planService.createPlanFromTemplate(
        famId, 
        userId, 
        'holiday-template', 
        'Summer Holiday',
        { destination: 'Spain', budget: 2000 }
      );

      expect(plan).toBeDefined();
      expect(plan.type).toBe(PlanType.HOLIDAY);
      expect(plan.name).toBe('Summer Holiday');
      expect(plan.description).toBe('Plan and organize family holidays');
      expect(plan.customFields).toEqual({
        destination: 'Spain',
        budget: 2000,
        travelers: [],
        accommodation: '',
        transport: ''
      });

      // Check that suggested tasks were created
      const planWithTasks = await planService.getPlanById(famId, userId, plan.id);
      expect(planWithTasks?.tasks).toHaveLength(6);
      expect(planWithTasks?.tasks?.[0].title).toBe('Research destinations');
    });

    it('should retrieve plan by ID', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // First create a plan
      const createdPlan = await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.PROPERTY_MOVE,
        name: 'House Move 2024',
        description: 'Moving to new house'
      });

      // Then retrieve it
      const retrievedPlan = await planService.getPlanById(famId, userId, createdPlan.id);

      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan?.id).toBe(createdPlan.id);
      expect(retrievedPlan?.name).toBe('House Move 2024');
      expect(retrievedPlan?.type).toBe(PlanType.PROPERTY_MOVE);
    });

    it('should retrieve all plans for a Fam', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create multiple plans
      await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Holiday Plan'
      });

      await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.PROPERTY_MOVE,
        name: 'Moving Plan'
      });

      // Retrieve all plans
      const plans = await planService.getPlans(famId, userId);

      expect(plans).toHaveLength(2);
      expect(plans[0].name).toBe('Moving Plan'); // Most recent first
      expect(plans[1].name).toBe('Holiday Plan');
    });

    it('should update a plan', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a plan
      const createdPlan = await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Original Plan',
        description: 'Original description'
      });

      // Update the plan
      const updatedPlan = await planService.updatePlan(famId, userId, createdPlan.id, {
        name: 'Updated Plan',
        description: 'Updated description',
        status: PlanStatus.IN_PROGRESS,
        customFields: { budget: 3000 }
      });

      expect(updatedPlan.name).toBe('Updated Plan');
      expect(updatedPlan.description).toBe('Updated description');
      expect(updatedPlan.status).toBe(PlanStatus.IN_PROGRESS);
      expect(updatedPlan.customFields).toEqual({ budget: 3000 });
    });

    it('should delete a plan', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a plan
      const createdPlan = await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Plan to Delete'
      });

      // Delete the plan
      await planService.deletePlan(famId, userId, createdPlan.id);

      // Verify it's deleted
      const deletedPlan = await planService.getPlanById(famId, userId, createdPlan.id);
      expect(deletedPlan).toBeNull();
    });

    it('should calculate plan progress correctly', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a plan with template (which creates tasks)
      const plan = await planService.createPlanFromTemplate(
        famId, 
        userId, 
        'holiday-template', 
        'Holiday with Progress'
      );

      // Initially, no tasks should be completed
      let progress = await planService.calculatePlanProgress(famId, userId, plan.id);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(6);
      expect(progress.percentage).toBe(0);

      // Mark some tasks as completed by updating them directly in the database
      const tasks = await prisma.planTask.findMany({
        where: { planId: plan.id }
      });

      await prisma.planTask.update({
        where: { id: tasks[0].id },
        data: { completed: true }
      });

      await prisma.planTask.update({
        where: { id: tasks[1].id },
        data: { completed: true }
      });

      // Check progress again
      progress = await planService.calculatePlanProgress(famId, userId, plan.id);
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(6);
      expect(progress.percentage).toBe(33); // 2/6 = 33.33% rounded to 33%
    });

    it('should enforce Fam membership for all operations', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create another user who is not a member of the Fam
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other@example.com',
          password: 'password123',
          name: 'Other User'
        });

      const otherUserId = otherUserResponse.body.data.user.id;

      // Try to create a plan as non-member
      await expect(planService.createPlan(famId, otherUserId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Unauthorized Plan'
      })).rejects.toThrow();

      // Create a plan as authorized user
      const plan = await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Authorized Plan'
      });

      // Try to access plan as non-member
      await expect(planService.getPlanById(famId, otherUserId, plan.id))
        .rejects.toThrow();

      await expect(planService.updatePlan(famId, otherUserId, plan.id, {
        name: 'Hacked Plan'
      })).rejects.toThrow();

      await expect(planService.deletePlan(famId, otherUserId, plan.id))
        .rejects.toThrow();
    });

    it('should validate plan data correctly', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Test invalid plan name
      await expect(planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: '', // Empty name
        description: 'Test plan'
      })).rejects.toThrow('Validation failed');

      // Test invalid plan type
      await expect(planService.createPlan(famId, userId, {
        famId,
        type: 'INVALID_TYPE' as PlanType,
        name: 'Test Plan',
        description: 'Test plan'
      })).rejects.toThrow('Validation failed');

      // Test invalid date range
      await expect(planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Test Plan',
        startDate: new Date('2024-07-14'),
        endDate: new Date('2024-07-01') // End before start
      })).rejects.toThrow('Validation failed');
    });

    it('should handle template operations correctly', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Get all templates
      const templates = planService.getTemplates();
      expect(templates).toHaveLength(2);
      expect(templates.map(t => t.type)).toContain(PlanType.HOLIDAY);
      expect(templates.map(t => t.type)).toContain(PlanType.PROPERTY_MOVE);

      // Get template by ID
      const holidayTemplate = planService.getTemplateById('holiday-template');
      expect(holidayTemplate).toBeDefined();
      expect(holidayTemplate?.type).toBe(PlanType.HOLIDAY);
      expect(holidayTemplate?.suggestedTasks).toHaveLength(6);

      // Get templates by type
      const holidayTemplates = planService.getTemplatesByType(PlanType.HOLIDAY);
      expect(holidayTemplates).toHaveLength(1);
      expect(holidayTemplates[0].id).toBe('holiday-template');

      // Test invalid template ID
      await expect(planService.createPlanFromTemplate(
        famId, 
        userId, 
        'invalid-template', 
        'Test Plan'
      )).rejects.toThrow('Template with ID invalid-template not found');
    });
  });

  describe('PlanTask Management Integration', () => {
    let testPlanId: string;
    let secondUserId: string;
    let secondUserToken: string;

    beforeEach(async () => {
      // Create a test plan
      const { planService } = await import('../../src/services/planService');
      const plan = await planService.createPlan(famId, userId, {
        famId,
        type: PlanType.HOLIDAY,
        name: 'Task Test Plan',
        description: 'Plan for testing tasks'
      });
      testPlanId = plan.id;

      // Create a second user and add them to the Fam
      const secondUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'second@example.com',
          password: 'password123',
          name: 'Second User'
        });

      secondUserId = secondUserResponse.body.data.user.id;
      secondUserToken = secondUserResponse.body.data.accessToken;

      // Add second user to the Fam
      await prisma.famMembership.create({
        data: {
          userId: secondUserId,
          famId: famId,
          role: 'MEMBER'
        }
      });
    });

    it('should create a plan task successfully', async () => {
      const { planService } = await import('../../src/services/planService');
      
      const taskData = {
        planId: testPlanId,
        title: 'Book flights',
        description: 'Book return flights to Spain',
        assignedToId: secondUserId,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      const task = await planService.createPlanTask(famId, userId, taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.planId).toBe(testPlanId);
      expect(task.title).toBe(taskData.title);
      expect(task.description).toBe(taskData.description);
      expect(task.assignedToId).toBe(secondUserId);
      expect(task.dueDate).toEqual(taskData.dueDate);
      expect(task.completed).toBe(false);
      expect(task.assignedTo).toBeDefined();
      expect(task.assignedTo?.name).toBe('Second User');
    });

    it('should create a task without assignment', async () => {
      const { planService } = await import('../../src/services/planService');
      
      const taskData = {
        planId: testPlanId,
        title: 'Research destinations',
        description: 'Look up holiday destinations'
      };

      const task = await planService.createPlanTask(famId, userId, taskData);

      expect(task.assignedToId).toBeNull();
      expect(task.assignedTo).toBeNull();
      expect(task.title).toBe(taskData.title);
    });

    it('should retrieve a plan task by ID', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a task
      const createdTask = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Test Task',
        description: 'Task for retrieval test'
      });

      // Retrieve the task
      const retrievedTask = await planService.getPlanTask(famId, userId, createdTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask?.id).toBe(createdTask.id);
      expect(retrievedTask?.title).toBe('Test Task');
      expect(retrievedTask?.description).toBe('Task for retrieval test');
    });

    it('should retrieve all tasks for a plan', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create multiple tasks
      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task 1',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task 2',
        assignedToId: secondUserId,
        dueDate: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
      });

      // Mark one task as completed
      const tasks = await planService.getPlanTasks(famId, userId, testPlanId);
      await planService.completeTask(famId, userId, tasks[0].id);

      // Retrieve all tasks
      const allTasks = await planService.getPlanTasks(famId, userId, testPlanId);

      expect(allTasks).toHaveLength(2);
      // Tasks should be ordered by completion status (incomplete first), then by due date
      expect(allTasks[0].completed).toBe(false);
      expect(allTasks[1].completed).toBe(true);
    });

    it('should update a plan task', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a task
      const createdTask = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Original Title',
        description: 'Original description'
      });

      // Update the task
      const updatedTask = await planService.updatePlanTask(famId, userId, createdTask.id, {
        title: 'Updated Title',
        description: 'Updated description',
        assignedToId: secondUserId,
        completed: true
      });

      expect(updatedTask.title).toBe('Updated Title');
      expect(updatedTask.description).toBe('Updated description');
      expect(updatedTask.assignedToId).toBe(secondUserId);
      expect(updatedTask.completed).toBe(true);
      expect(updatedTask.assignedTo?.name).toBe('Second User');
    });

    it('should delete a plan task', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a task
      const createdTask = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task to Delete'
      });

      // Delete the task
      await planService.deletePlanTask(famId, userId, createdTask.id);

      // Verify it's deleted
      const deletedTask = await planService.getPlanTask(famId, userId, createdTask.id);
      expect(deletedTask).toBeNull();
    });

    it('should handle task assignment operations', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create an unassigned task
      const task = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Assignment Test Task'
      });

      expect(task.assignedToId).toBeNull();

      // Assign the task
      const assignedTask = await planService.assignTask(famId, userId, task.id, secondUserId);
      expect(assignedTask.assignedToId).toBe(secondUserId);
      expect(assignedTask.assignedTo?.name).toBe('Second User');

      // Unassign the task
      const unassignedTask = await planService.unassignTask(famId, userId, task.id);
      expect(unassignedTask.assignedToId).toBeNull();
      expect(unassignedTask.assignedTo).toBeNull();
    });

    it('should handle task completion operations', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create a task
      const task = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Completion Test Task'
      });

      expect(task.completed).toBe(false);

      // Complete the task
      const completedTask = await planService.completeTask(famId, userId, task.id);
      expect(completedTask.completed).toBe(true);

      // Uncomplete the task
      const uncompletedTask = await planService.uncompleteTask(famId, userId, task.id);
      expect(uncompletedTask.completed).toBe(false);
    });

    it('should get tasks by assignee', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create tasks assigned to different users
      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task for User 1',
        assignedToId: userId
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task for User 2',
        assignedToId: secondUserId
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Unassigned Task'
      });

      // Get tasks for second user
      const secondUserTasks = await planService.getTasksByAssignee(famId, userId, secondUserId);
      expect(secondUserTasks).toHaveLength(1);
      expect(secondUserTasks[0].title).toBe('Task for User 2');
      expect(secondUserTasks[0].assignedToId).toBe(secondUserId);
      expect(secondUserTasks[0].plan).toBeDefined();
    });

    it('should get overdue tasks', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create tasks with different due dates
      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Overdue Task',
        dueDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Past date
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Future Task',
        dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Future date
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'No Due Date Task'
      });

      // Get overdue tasks
      const overdueTasks = await planService.getOverdueTasks(famId, userId);
      expect(overdueTasks).toHaveLength(1);
      expect(overdueTasks[0].title).toBe('Overdue Task');
      expect(overdueTasks[0].completed).toBe(false);
    });

    it('should get upcoming tasks', async () => {
      const { planService } = await import('../../src/services/planService');
      
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 8);

      // Create tasks with different due dates
      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Tomorrow Task',
        dueDate: tomorrow
      });

      await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Next Week Task',
        dueDate: nextWeek
      });

      // Get upcoming tasks (default 7 days)
      const upcomingTasks = await planService.getUpcomingTasks(famId, userId);
      expect(upcomingTasks).toHaveLength(1);
      expect(upcomingTasks[0].title).toBe('Tomorrow Task');

      // Get upcoming tasks with longer range
      const upcomingTasksLonger = await planService.getUpcomingTasks(famId, userId, 10);
      expect(upcomingTasksLonger).toHaveLength(2);
    });

    it('should enforce Fam membership for task operations', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create another user who is not a member of the Fam
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'outsider@example.com',
          password: 'password123',
          name: 'Outsider User'
        });

      const outsiderUserId = otherUserResponse.body.data.user.id;

      // Create a task as authorized user
      const task = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Protected Task'
      });

      // Try to access task as non-member
      await expect(planService.getPlanTask(famId, outsiderUserId, task.id))
        .rejects.toThrow();

      await expect(planService.updatePlanTask(famId, outsiderUserId, task.id, {
        title: 'Hacked Task'
      })).rejects.toThrow();

      await expect(planService.deletePlanTask(famId, outsiderUserId, task.id))
        .rejects.toThrow();

      // Try to create task as non-member
      await expect(planService.createPlanTask(famId, outsiderUserId, {
        planId: testPlanId,
        title: 'Unauthorized Task'
      })).rejects.toThrow();
    });

    it('should validate task assignment to Fam members only', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create another user who is not a member of the Fam
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'nonmember@example.com',
          password: 'password123',
          name: 'Non Member'
        });

      const nonMemberUserId = otherUserResponse.body.data.user.id;

      // Try to create task assigned to non-member
      await expect(planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Invalid Assignment Task',
        assignedToId: nonMemberUserId
      })).rejects.toThrow('Assigned user is not a member of this Fam');

      // Create a task and try to assign to non-member
      const task = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Valid Task'
      });

      await expect(planService.assignTask(famId, userId, task.id, nonMemberUserId))
        .rejects.toThrow('Assigned user is not a member of this Fam');
    });

    it('should validate task data correctly', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Test invalid task title
      await expect(planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: '', // Empty title
        description: 'Test task'
      })).rejects.toThrow('Validation failed');

      // Test invalid plan ID
      await expect(planService.createPlanTask(famId, userId, {
        planId: 'invalid-plan-id',
        title: 'Test Task'
      })).rejects.toThrow('Plan not found');

      // Test past due date
      await expect(planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Test Task',
        dueDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Past date
      })).rejects.toThrow('Validation failed');
    });

    it('should update plan progress when tasks are completed', async () => {
      const { planService } = await import('../../src/services/planService');
      
      // Create multiple tasks
      const task1 = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task 1'
      });

      const task2 = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task 2'
      });

      const task3 = await planService.createPlanTask(famId, userId, {
        planId: testPlanId,
        title: 'Task 3'
      });

      // Initially no tasks completed
      let progress = await planService.calculatePlanProgress(famId, userId, testPlanId);
      expect(progress.completed).toBe(0);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(0);

      // Complete one task
      await planService.completeTask(famId, userId, task1.id);
      progress = await planService.calculatePlanProgress(famId, userId, testPlanId);
      expect(progress.completed).toBe(1);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(33);

      // Complete another task
      await planService.completeTask(famId, userId, task2.id);
      progress = await planService.calculatePlanProgress(famId, userId, testPlanId);
      expect(progress.completed).toBe(2);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(67);

      // Complete all tasks
      await planService.completeTask(famId, userId, task3.id);
      progress = await planService.calculatePlanProgress(famId, userId, testPlanId);
      expect(progress.completed).toBe(3);
      expect(progress.total).toBe(3);
      expect(progress.percentage).toBe(100);
    });
  });
});