import { Router } from 'express';
import { planController } from '../controllers/planController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All Plan routes require authentication
router.use(authenticate);

// Template routes (should come before parameterized routes)
router.get('/templates', planController.getTemplates.bind(planController));
router.get('/templates/:templateId', planController.getTemplate.bind(planController));

// Plan management routes
router.post('/fam/:famId', planController.createPlan.bind(planController));
router.post('/fam/:famId/from-template', planController.createPlanFromTemplate.bind(planController));
router.get('/fam/:famId', planController.getPlans.bind(planController));
router.get('/fam/:famId/:planId', planController.getPlan.bind(planController));
router.put('/fam/:famId/:planId', planController.updatePlan.bind(planController));
router.delete('/fam/:famId/:planId', planController.deletePlan.bind(planController));

// Plan progress routes
router.get('/fam/:famId/:planId/progress', planController.getPlanProgress.bind(planController));

// PlanTask management routes
router.post('/fam/:famId/:planId/tasks', planController.createPlanTask.bind(planController));
router.get('/fam/:famId/:planId/tasks', planController.getPlanTasks.bind(planController));
router.get('/fam/:famId/tasks/:taskId', planController.getPlanTask.bind(planController));
router.put('/fam/:famId/tasks/:taskId', planController.updatePlanTask.bind(planController));
router.delete('/fam/:famId/tasks/:taskId', planController.deletePlanTask.bind(planController));

// Task assignment and status management routes
router.post('/fam/:famId/tasks/:taskId/assign', planController.assignTask.bind(planController));
router.post('/fam/:famId/tasks/:taskId/unassign', planController.unassignTask.bind(planController));
router.post('/fam/:famId/tasks/:taskId/complete', planController.completeTask.bind(planController));
router.post('/fam/:famId/tasks/:taskId/uncomplete', planController.uncompleteTask.bind(planController));

// Task filtering and reporting routes
router.get('/fam/:famId/tasks/assignee/:assigneeId', planController.getTasksByAssignee.bind(planController));
router.get('/fam/:famId/tasks/overdue', planController.getOverdueTasks.bind(planController));
router.get('/fam/:famId/tasks/upcoming', planController.getUpcomingTasks.bind(planController));

export default router;