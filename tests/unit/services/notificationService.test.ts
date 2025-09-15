import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { notificationService, NotificationService } from '../../../src/services/notificationService';
import { prisma } from '../../../src/lib/prisma';
import { famService } from '../../../src/services/famService';
import { AccountType } from '../../../src/models/types';
import { Decimal } from '@prisma/client/runtime/library';

// Mock dependencies
vi.mock('../../../src/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('../../../src/services/famService', () => ({
  famService: {
    verifyFamMembership: vi.fn()
  }
}));

describe('NotificationService', () => {
  const mockUserId = 'user-123';
  const mockFamId = 'fam-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
    (famService.verifyFamMembership as Mock).mockResolvedValue(true);
  });

  describe('getUpcomingObligations', () => {
    it('should return upcoming payment obligations', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          name: 'Council Tax',
          type: AccountType.COUNCIL_TAX,
          provider: 'Glasgow City Council',
          dueDate: new Date('2024-01-15'),
          amount: new Decimal('150.00'),
          expiryDate: null,
          accountHolder: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com'
          },
          asset: {
            id: 'asset-1',
            name: 'Main Home',
            type: 'HOME'
          }
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      // Mock current date to be 2024-01-10 (5 days before due date)
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const obligations = await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(obligations).toHaveLength(1);
      expect(obligations[0]).toMatchObject({
        accountId: 'account-1',
        accountName: 'Council Tax',
        accountType: AccountType.COUNCIL_TAX,
        provider: 'Glasgow City Council',
        obligationType: 'payment',
        dueDate: new Date('2024-01-15'),
        amount: 150.00,
        daysUntilDue: 5,
        urgencyLevel: 'low'
      });

      vi.useRealTimers();
    });

    it('should return upcoming renewal obligations', async () => {
      const mockAccounts = [
        {
          id: 'account-2',
          name: 'Home Insurance',
          type: AccountType.HOME_INSURANCE,
          provider: 'Direct Line',
          dueDate: null,
          amount: new Decimal('300.00'),
          expiryDate: new Date('2024-01-12'),
          accountHolder: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com'
          },
          asset: {
            id: 'asset-1',
            name: 'Main Home',
            type: 'HOME'
          }
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      // Mock current date to be 2024-01-10 (2 days before expiry)
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const obligations = await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(obligations).toHaveLength(1);
      expect(obligations[0]).toMatchObject({
        accountId: 'account-2',
        accountName: 'Home Insurance',
        accountType: AccountType.HOME_INSURANCE,
        provider: 'Direct Line',
        obligationType: 'renewal',
        dueDate: new Date('2024-01-12'),
        amount: 300.00,
        daysUntilDue: 2,
        urgencyLevel: 'high'
      });

      vi.useRealTimers();
    });

    it('should mark overdue obligations correctly', async () => {
      const mockAccounts = [
        {
          id: 'account-3',
          name: 'Energy Bill',
          type: AccountType.ENERGY_BILL,
          provider: 'British Gas',
          dueDate: new Date('2024-01-05'),
          amount: new Decimal('120.00'),
          expiryDate: null,
          accountHolder: {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com'
          },
          asset: null
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      // Mock current date to be 2024-01-10 (5 days after due date)
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const obligations = await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(obligations).toHaveLength(1);
      expect(obligations[0]).toMatchObject({
        accountId: 'account-3',
        accountName: 'Energy Bill',
        obligationType: 'payment',
        daysUntilDue: -5,
        urgencyLevel: 'overdue'
      });

      vi.useRealTimers();
    });

    it('should sort obligations by urgency and due date', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          name: 'Low Priority',
          type: AccountType.TV_PACKAGE,
          provider: 'Sky',
          dueDate: new Date('2024-01-20'),
          amount: new Decimal('50.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        },
        {
          id: 'account-2',
          name: 'Overdue',
          type: AccountType.COUNCIL_TAX,
          provider: 'Council',
          dueDate: new Date('2024-01-05'),
          amount: new Decimal('150.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        },
        {
          id: 'account-3',
          name: 'High Priority',
          type: AccountType.ENERGY_BILL,
          provider: 'British Gas',
          dueDate: new Date('2024-01-11'),
          amount: new Decimal('120.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const obligations = await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(obligations).toHaveLength(3);
      // Should be sorted: overdue first, then high priority, then low priority
      expect(obligations[0].urgencyLevel).toBe('overdue');
      expect(obligations[1].urgencyLevel).toBe('high');
      expect(obligations[2].urgencyLevel).toBe('low');

      vi.useRealTimers();
    });

    it('should verify fam membership', async () => {
      (prisma.account.findMany as Mock).mockResolvedValue([]);

      await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(famService.verifyFamMembership).toHaveBeenCalledWith(mockFamId, mockUserId);
    });

    it('should filter accounts by user access', async () => {
      await notificationService.getUpcomingObligations(mockFamId, mockUserId, 30);

      expect(prisma.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            famId: mockFamId,
            OR: [
              { userId: null }, // Shared accounts
              { userId: mockUserId } // User's personal accounts
            ]
          })
        })
      );
    });
  });

  describe('getNotificationSummary', () => {
    it('should return correct summary counts', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          name: 'Overdue Payment',
          type: AccountType.COUNCIL_TAX,
          provider: 'Council',
          dueDate: new Date('2024-01-05'),
          amount: new Decimal('150.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        },
        {
          id: 'account-2',
          name: 'High Priority Payment',
          type: AccountType.ENERGY_BILL,
          provider: 'British Gas',
          dueDate: new Date('2024-01-11'),
          amount: new Decimal('120.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        },
        {
          id: 'account-3',
          name: 'Renewal Due',
          type: AccountType.HOME_INSURANCE,
          provider: 'Direct Line',
          dueDate: null,
          amount: new Decimal('300.00'),
          expiryDate: new Date('2024-01-12'),
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const summary = await notificationService.getNotificationSummary(mockFamId, mockUserId, 30);

      expect(summary).toMatchObject({
        totalObligations: 3,
        overdueCount: 1,
        highUrgencyCount: 2,
        mediumUrgencyCount: 0,
        lowUrgencyCount: 0
      });

      expect(summary.upcomingPayments).toHaveLength(2);
      expect(summary.upcomingRenewals).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  describe('getOverdueObligations', () => {
    it('should return only overdue obligations', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          name: 'Overdue Payment',
          type: AccountType.COUNCIL_TAX,
          provider: 'Council',
          dueDate: new Date('2024-01-05'),
          amount: new Decimal('150.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        },
        {
          id: 'account-2',
          name: 'Future Payment',
          type: AccountType.ENERGY_BILL,
          provider: 'British Gas',
          dueDate: new Date('2024-01-15'),
          amount: new Decimal('120.00'),
          expiryDate: null,
          accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          asset: null
        }
      ];

      (prisma.account.findMany as Mock).mockResolvedValue(mockAccounts);

      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const overdueObligations = await notificationService.getOverdueObligations(mockFamId, mockUserId);

      expect(overdueObligations).toHaveLength(1);
      expect(overdueObligations[0].urgencyLevel).toBe('overdue');
      expect(overdueObligations[0].accountName).toBe('Overdue Payment');

      vi.useRealTimers();
    });
  });

  describe('calculateDaysUntilDate', () => {
    it('should calculate days correctly for future dates', () => {
      const service = new NotificationService();
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      // Access private method through any cast for testing
      const daysUntil = (service as any).calculateDaysUntilDate(new Date('2024-01-15'));
      expect(daysUntil).toBe(5);

      vi.useRealTimers();
    });

    it('should calculate days correctly for past dates', () => {
      const service = new NotificationService();
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const daysUntil = (service as any).calculateDaysUntilDate(new Date('2024-01-05'));
      expect(daysUntil).toBe(-5);

      vi.useRealTimers();
    });

    it('should return 0 for today', () => {
      const service = new NotificationService();
      const mockDate = new Date('2024-01-10');
      vi.setSystemTime(mockDate);

      const daysUntil = (service as any).calculateDaysUntilDate(new Date('2024-01-10'));
      expect(daysUntil).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('calculateUrgencyLevel', () => {
    const service = new NotificationService();

    describe('payment obligations', () => {
      it('should return overdue for negative days', () => {
        const urgency = (service as any).calculateUrgencyLevel(-1, 'payment');
        expect(urgency).toBe('overdue');
      });

      it('should return high for 0-1 days', () => {
        expect((service as any).calculateUrgencyLevel(0, 'payment')).toBe('high');
        expect((service as any).calculateUrgencyLevel(1, 'payment')).toBe('high');
      });

      it('should return medium for 2-3 days', () => {
        expect((service as any).calculateUrgencyLevel(2, 'payment')).toBe('medium');
        expect((service as any).calculateUrgencyLevel(3, 'payment')).toBe('medium');
      });

      it('should return low for 4+ days', () => {
        expect((service as any).calculateUrgencyLevel(4, 'payment')).toBe('low');
        expect((service as any).calculateUrgencyLevel(10, 'payment')).toBe('low');
      });
    });

    describe('renewal obligations', () => {
      it('should return overdue for negative days', () => {
        const urgency = (service as any).calculateUrgencyLevel(-1, 'renewal');
        expect(urgency).toBe('overdue');
      });

      it('should return high for 0-7 days', () => {
        expect((service as any).calculateUrgencyLevel(0, 'renewal')).toBe('high');
        expect((service as any).calculateUrgencyLevel(7, 'renewal')).toBe('high');
      });

      it('should return medium for 8-30 days', () => {
        expect((service as any).calculateUrgencyLevel(8, 'renewal')).toBe('medium');
        expect((service as any).calculateUrgencyLevel(30, 'renewal')).toBe('medium');
      });

      it('should return low for 31+ days', () => {
        expect((service as any).calculateUrgencyLevel(31, 'renewal')).toBe('low');
        expect((service as any).calculateUrgencyLevel(60, 'renewal')).toBe('low');
      });
    });
  });

  describe('shouldSendNotification', () => {
    const service = new NotificationService();

    it('should return true for payment reminders on configured days', () => {
      const preferences = {
        enablePaymentReminders: true,
        enableRenewalReminders: true,
        paymentReminderDays: [1, 3, 7],
        renewalReminderDays: [7, 30],
        emailNotifications: true,
        pushNotifications: false
      };

      expect(service.shouldSendNotification(1, 'payment', preferences)).toBe(true);
      expect(service.shouldSendNotification(3, 'payment', preferences)).toBe(true);
      expect(service.shouldSendNotification(7, 'payment', preferences)).toBe(true);
      expect(service.shouldSendNotification(2, 'payment', preferences)).toBe(false);
    });

    it('should return false when payment reminders are disabled', () => {
      const preferences = {
        enablePaymentReminders: false,
        enableRenewalReminders: true,
        paymentReminderDays: [1, 3, 7],
        renewalReminderDays: [7, 30],
        emailNotifications: true,
        pushNotifications: false
      };

      expect(service.shouldSendNotification(1, 'payment', preferences)).toBe(false);
    });

    it('should return true for renewal reminders on configured days', () => {
      const preferences = {
        enablePaymentReminders: true,
        enableRenewalReminders: true,
        paymentReminderDays: [1, 3, 7],
        renewalReminderDays: [7, 30],
        emailNotifications: true,
        pushNotifications: false
      };

      expect(service.shouldSendNotification(7, 'renewal', preferences)).toBe(true);
      expect(service.shouldSendNotification(30, 'renewal', preferences)).toBe(true);
      expect(service.shouldSendNotification(14, 'renewal', preferences)).toBe(false);
    });
  });

  describe('formatObligationMessage', () => {
    const service = new NotificationService();

    it('should format payment messages correctly', () => {
      const obligation = {
        id: 'payment-1',
        accountId: 'account-1',
        accountName: 'Council Tax',
        accountType: AccountType.COUNCIL_TAX,
        provider: 'Glasgow City Council',
        accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        obligationType: 'payment' as const,
        dueDate: new Date('2024-01-15'),
        amount: 150.00,
        daysUntilDue: 5,
        urgencyLevel: 'low' as const
      };

      const message = service.formatObligationMessage(obligation);
      expect(message).toBe('Council Tax (Glasgow City Council) payment of £150.00 is due in 5 days');
    });

    it('should format renewal messages correctly', () => {
      const obligation = {
        id: 'renewal-1',
        accountId: 'account-1',
        accountName: 'Home Insurance',
        accountType: AccountType.HOME_INSURANCE,
        provider: 'Direct Line',
        accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        obligationType: 'renewal' as const,
        dueDate: new Date('2024-01-15'),
        daysUntilDue: 1,
        urgencyLevel: 'high' as const
      };

      const message = service.formatObligationMessage(obligation);
      expect(message).toBe('Home Insurance (Direct Line) renewal is due tomorrow');
    });

    it('should format overdue messages correctly', () => {
      const obligation = {
        id: 'payment-1',
        accountId: 'account-1',
        accountName: 'Energy Bill',
        accountType: AccountType.ENERGY_BILL,
        provider: 'British Gas',
        accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        obligationType: 'payment' as const,
        dueDate: new Date('2024-01-05'),
        amount: 120.00,
        daysUntilDue: -3,
        urgencyLevel: 'overdue' as const
      };

      const message = service.formatObligationMessage(obligation);
      expect(message).toBe('Energy Bill (British Gas) payment of £120.00 was due 3 days ago');
    });

    it('should format today messages correctly', () => {
      const obligation = {
        id: 'payment-1',
        accountId: 'account-1',
        accountName: 'Mobile Contract',
        accountType: AccountType.MOBILE_CONTRACT,
        provider: 'EE',
        accountHolder: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
        obligationType: 'payment' as const,
        dueDate: new Date('2024-01-10'),
        amount: 45.00,
        daysUntilDue: 0,
        urgencyLevel: 'high' as const
      };

      const message = service.formatObligationMessage(obligation);
      expect(message).toBe('Mobile Contract (EE) payment of £45.00 is due today');
    });
  });

  describe('getDefaultPreferences', () => {
    it('should return default notification preferences', () => {
      const service = new NotificationService();
      const preferences = service.getDefaultPreferences();

      expect(preferences).toMatchObject({
        enablePaymentReminders: true,
        enableRenewalReminders: true,
        paymentReminderDays: [1, 3, 7, 14],
        renewalReminderDays: [7, 30, 60],
        emailNotifications: true,
        pushNotifications: false
      });
    });
  });
});