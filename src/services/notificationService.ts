import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { Account, AccountType } from '../models/types';
import { famService } from './famService';

export interface UpcomingObligation {
  id: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  provider: string;
  accountHolder: {
    id: string;
    name: string;
    email: string;
  };
  asset?: {
    id: string;
    name: string;
    type: string;
  };
  obligationType: 'payment' | 'renewal';
  dueDate: Date;
  amount?: number;
  daysUntilDue: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'overdue';
}

export interface NotificationPreferences {
  enablePaymentReminders: boolean;
  enableRenewalReminders: boolean;
  paymentReminderDays: number[];
  renewalReminderDays: number[];
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface NotificationSummary {
  totalObligations: number;
  overdueCount: number;
  highUrgencyCount: number;
  mediumUrgencyCount: number;
  lowUrgencyCount: number;
  upcomingPayments: UpcomingObligation[];
  upcomingRenewals: UpcomingObligation[];
}

export class NotificationService {
  private readonly DEFAULT_PAYMENT_REMINDER_DAYS = [1, 3, 7, 14];
  private readonly DEFAULT_RENEWAL_REMINDER_DAYS = [7, 30, 60];

  /**
   * Get upcoming obligations for a specific Fam
   */
  async getUpcomingObligations(
    famId: string, 
    userId: string, 
    daysAhead: number = 30
  ): Promise<UpcomingObligation[]> {
    // Verify user has access to this Fam
    await famService.verifyFamMembership(famId, userId);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Get accounts with due dates or expiry dates within the specified period
    const accounts = await prisma.account.findMany({
      where: {
        famId,
        OR: [
          { userId: null }, // Shared accounts
          { userId: userId } // User's personal accounts
        ],
        AND: {
          OR: [
            {
              dueDate: {
                lte: cutoffDate
              }
            },
            {
              expiryDate: {
                lte: cutoffDate
              }
            }
          ]
        }
      },
      include: {
        accountHolder: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        asset: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' },
        { expiryDate: 'asc' }
      ]
    });

    const obligations: UpcomingObligation[] = [];
    const now = new Date();

    for (const account of accounts) {
      // Process payment obligations (due dates)
      if (account.dueDate) {
        const daysUntilDue = this.calculateDaysUntilDate(account.dueDate);
        
        obligations.push({
          id: `payment-${account.id}`,
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          provider: account.provider,
          accountHolder: account.accountHolder,
          asset: account.asset,
          obligationType: 'payment',
          dueDate: account.dueDate,
          amount: account.amount ? parseFloat(account.amount.toString()) : undefined,
          daysUntilDue,
          urgencyLevel: this.calculateUrgencyLevel(daysUntilDue, 'payment')
        });
      }

      // Process renewal obligations (expiry dates)
      if (account.expiryDate) {
        const daysUntilDue = this.calculateDaysUntilDate(account.expiryDate);
        
        obligations.push({
          id: `renewal-${account.id}`,
          accountId: account.id,
          accountName: account.name,
          accountType: account.type,
          provider: account.provider,
          accountHolder: account.accountHolder,
          asset: account.asset,
          obligationType: 'renewal',
          dueDate: account.expiryDate,
          amount: account.amount ? parseFloat(account.amount.toString()) : undefined,
          daysUntilDue,
          urgencyLevel: this.calculateUrgencyLevel(daysUntilDue, 'renewal')
        });
      }
    }

    // Sort by urgency and then by due date
    return obligations.sort((a, b) => {
      const urgencyOrder = { 'overdue': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const urgencyDiff = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
      
      if (urgencyDiff !== 0) {
        return urgencyDiff;
      }
      
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }

  /**
   * Get a summary of upcoming obligations
   */
  async getNotificationSummary(
    famId: string, 
    userId: string, 
    daysAhead: number = 30
  ): Promise<NotificationSummary> {
    const obligations = await this.getUpcomingObligations(famId, userId, daysAhead);

    const summary: NotificationSummary = {
      totalObligations: obligations.length,
      overdueCount: 0,
      highUrgencyCount: 0,
      mediumUrgencyCount: 0,
      lowUrgencyCount: 0,
      upcomingPayments: obligations.filter(o => o.obligationType === 'payment'),
      upcomingRenewals: obligations.filter(o => o.obligationType === 'renewal')
    };

    // Count by urgency level
    for (const obligation of obligations) {
      switch (obligation.urgencyLevel) {
        case 'overdue':
          summary.overdueCount++;
          break;
        case 'high':
          summary.highUrgencyCount++;
          break;
        case 'medium':
          summary.mediumUrgencyCount++;
          break;
        case 'low':
          summary.lowUrgencyCount++;
          break;
      }
    }

    return summary;
  }

  /**
   * Get overdue obligations
   */
  async getOverdueObligations(famId: string, userId: string): Promise<UpcomingObligation[]> {
    const obligations = await this.getUpcomingObligations(famId, userId, 0);
    return obligations.filter(o => o.urgencyLevel === 'overdue');
  }

  /**
   * Get obligations due within a specific number of days
   */
  async getObligationsDueWithin(
    famId: string, 
    userId: string, 
    days: number
  ): Promise<UpcomingObligation[]> {
    const obligations = await this.getUpcomingObligations(famId, userId, days);
    return obligations.filter(o => o.daysUntilDue <= days && o.daysUntilDue >= 0);
  }

  /**
   * Get obligations by urgency level
   */
  async getObligationsByUrgency(
    famId: string, 
    userId: string, 
    urgencyLevel: 'low' | 'medium' | 'high' | 'overdue'
  ): Promise<UpcomingObligation[]> {
    const obligations = await this.getUpcomingObligations(famId, userId);
    return obligations.filter(o => o.urgencyLevel === urgencyLevel);
  }

  /**
   * Calculate days until a specific date
   */
  private calculateDaysUntilDate(targetDate: Date): number {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate urgency level based on days until due and obligation type
   */
  private calculateUrgencyLevel(
    daysUntilDue: number, 
    obligationType: 'payment' | 'renewal'
  ): 'low' | 'medium' | 'high' | 'overdue' {
    if (daysUntilDue < 0) {
      return 'overdue';
    }

    if (obligationType === 'payment') {
      if (daysUntilDue <= 1) return 'high';
      if (daysUntilDue <= 3) return 'medium';
      return 'low';
    } else { // renewal
      if (daysUntilDue <= 7) return 'high';
      if (daysUntilDue <= 30) return 'medium';
      return 'low';
    }
  }

  /**
   * Check if a notification should be sent based on reminder preferences
   */
  shouldSendNotification(
    daysUntilDue: number,
    obligationType: 'payment' | 'renewal',
    preferences: NotificationPreferences = this.getDefaultPreferences()
  ): boolean {
    if (obligationType === 'payment' && !preferences.enablePaymentReminders) {
      return false;
    }

    if (obligationType === 'renewal' && !preferences.enableRenewalReminders) {
      return false;
    }

    const reminderDays = obligationType === 'payment' 
      ? preferences.paymentReminderDays 
      : preferences.renewalReminderDays;

    return reminderDays.includes(daysUntilDue);
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences(): NotificationPreferences {
    return {
      enablePaymentReminders: true,
      enableRenewalReminders: true,
      paymentReminderDays: this.DEFAULT_PAYMENT_REMINDER_DAYS,
      renewalReminderDays: this.DEFAULT_RENEWAL_REMINDER_DAYS,
      emailNotifications: true,
      pushNotifications: false
    };
  }

  /**
   * Format obligation for display
   */
  formatObligationMessage(obligation: UpcomingObligation): string {
    const { accountName, provider, obligationType, daysUntilDue, amount } = obligation;
    
    let message = `${accountName} (${provider})`;
    
    if (obligationType === 'payment') {
      message += ' payment';
      if (amount) {
        message += ` of £${amount.toFixed(2)}`;
      }
    } else {
      message += ' renewal';
    }

    if (daysUntilDue < 0) {
      message += ` was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} ago`;
    } else if (daysUntilDue === 0) {
      message += ' is due today';
    } else if (daysUntilDue === 1) {
      message += ' is due tomorrow';
    } else {
      message += ` is due in ${daysUntilDue} days`;
    }

    return message;
  }

  /**
   * Get accounts that need attention (overdue or due soon)
   */
  async getAccountsNeedingAttention(
    famId: string, 
    userId: string
  ): Promise<{
    overdue: UpcomingObligation[];
    dueSoon: UpcomingObligation[];
    renewingSoon: UpcomingObligation[];
  }> {
    const obligations = await this.getUpcomingObligations(famId, userId, 30);

    return {
      overdue: obligations.filter(o => o.urgencyLevel === 'overdue'),
      dueSoon: obligations.filter(o => 
        o.obligationType === 'payment' && 
        o.urgencyLevel === 'high' && 
        o.daysUntilDue >= 0
      ),
      renewingSoon: obligations.filter(o => 
        o.obligationType === 'renewal' && 
        o.urgencyLevel === 'high' && 
        o.daysUntilDue >= 0
      )
    };
  }
}

export const notificationService = new NotificationService();