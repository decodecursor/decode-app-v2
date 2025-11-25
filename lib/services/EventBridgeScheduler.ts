/**
 * EventBridge Scheduler Service
 *
 * Manages AWS EventBridge Scheduler for precise auction closure timing.
 * Creates one-time schedules that trigger at exact auction end_time.
 */

import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  FlexibleTimeWindowMode,
  ActionAfterCompletion,
} from '@aws-sdk/client-scheduler';

interface ScheduleAuctionCloseParams {
  auctionId: string;
  endTime: Date;
}

interface ScheduleResult {
  success: boolean;
  schedulerEventId?: string;
  error?: string;
}

export class EventBridgeScheduler {
  private client: SchedulerClient;
  private scheduleGroup: string;
  private roleArn: string;
  private webhookUrl: string;
  private webhookSecret: string;

  constructor() {
    // Validate required environment variables
    const requiredEnvVars = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'EVENTBRIDGE_SCHEDULE_GROUP',
      'EVENTBRIDGE_ROLE_ARN',
      'EVENTBRIDGE_WEBHOOK_URL',
      'EVENTBRIDGE_WEBHOOK_SECRET',
    ];

    const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for EventBridge: ${missing.join(', ')}`
      );
    }

    this.client = new SchedulerClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.scheduleGroup = process.env.EVENTBRIDGE_SCHEDULE_GROUP!;
    this.roleArn = process.env.EVENTBRIDGE_ROLE_ARN!;
    this.webhookUrl = process.env.EVENTBRIDGE_WEBHOOK_URL!;
    this.webhookSecret = process.env.EVENTBRIDGE_WEBHOOK_SECRET!;
  }

  /**
   * Schedule an auction to close at exact end_time
   *
   * @param auctionId - UUID of the auction
   * @param endTime - Exact time when auction should close
   * @returns schedulerEventId to store in database
   */
  async scheduleAuctionClose({
    auctionId,
    endTime,
  }: ScheduleAuctionCloseParams): Promise<ScheduleResult> {
    try {
      // Generate unique schedule name
      const scheduleName = `auction-close-${auctionId}`;

      // Convert endTime to cron expression in UTC
      const scheduleExpression = this.dateToOneTimeCron(endTime);

      console.log(`[EventBridge] Creating schedule for auction ${auctionId}`, {
        scheduleName,
        scheduleExpression,
        endTime: endTime.toISOString(),
        webhookUrl: this.webhookUrl,
      });

      const command = new CreateScheduleCommand({
        Name: scheduleName,
        GroupName: this.scheduleGroup,

        // One-time schedule at exact endTime
        ScheduleExpression: scheduleExpression,
        ScheduleExpressionTimezone: 'UTC',

        // Flexible time window: OFF (precise scheduling)
        FlexibleTimeWindow: {
          Mode: FlexibleTimeWindowMode.OFF,
        },

        // Target: HTTP endpoint (POST request to Next.js API)
        Target: {
          Arn: this.webhookUrl,
          RoleArn: this.roleArn,
          Input: JSON.stringify({
            auctionId,
            source: 'eventbridge-scheduler',
            scheduledTime: endTime.toISOString(),
          }),
          HttpParameters: {
            HeaderParameters: {
              'Content-Type': 'application/json',
              'X-EventBridge-Source': 'aws.scheduler',
              'X-EventBridge-Secret': this.webhookSecret,
            },
          },
          RetryPolicy: {
            MaximumRetryAttempts: 185, // AWS maximum (retries up to 24 hours)
          },
        },

        // Delete schedule after execution
        ActionAfterCompletion: ActionAfterCompletion.DELETE,

        // Optional: Add description
        Description: `Auto-close auction ${auctionId} at ${endTime.toISOString()}`,
      });

      await this.client.send(command);

      console.log(`[EventBridge] Successfully created schedule ${scheduleName}`);

      return {
        success: true,
        schedulerEventId: scheduleName,
      };
    } catch (error) {
      console.error('[EventBridge] Failed to create schedule:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cancel/delete a scheduled auction close
   *
   * Used when auction is manually cancelled by creator
   *
   * @param schedulerEventId - The schedule name returned from scheduleAuctionClose
   */
  async cancelSchedule(schedulerEventId: string): Promise<ScheduleResult> {
    try {
      if (!schedulerEventId) {
        console.warn('[EventBridge] No schedulerEventId provided for cancellation');
        return { success: true }; // Nothing to cancel
      }

      console.log(`[EventBridge] Deleting schedule ${schedulerEventId}`);

      const command = new DeleteScheduleCommand({
        Name: schedulerEventId,
        GroupName: this.scheduleGroup,
      });

      await this.client.send(command);

      console.log(`[EventBridge] Successfully deleted schedule ${schedulerEventId}`);

      return { success: true };
    } catch (error: any) {
      // If schedule doesn't exist or already deleted, that's fine
      if (error.name === 'ResourceNotFoundException') {
        console.log(`[EventBridge] Schedule ${schedulerEventId} not found (already deleted)`);
        return { success: true };
      }

      console.error('[EventBridge] Failed to delete schedule:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update schedule (for anti-sniping time extensions)
   *
   * Deletes old schedule and creates new one with updated end_time
   *
   * @param auctionId - UUID of the auction
   * @param oldSchedulerId - Current schedule ID to delete
   * @param newEndTime - New extended end time
   */
  async updateSchedule(
    auctionId: string,
    oldSchedulerId: string,
    newEndTime: Date
  ): Promise<ScheduleResult> {
    try {
      console.log(`[EventBridge] Updating schedule for auction ${auctionId}`, {
        oldSchedulerId,
        newEndTime: newEndTime.toISOString(),
      });

      // Delete old schedule
      await this.cancelSchedule(oldSchedulerId);

      // Create new schedule
      const result = await this.scheduleAuctionClose({
        auctionId,
        endTime: newEndTime,
      });

      if (result.success) {
        console.log(`[EventBridge] Successfully updated schedule for auction ${auctionId}`);
      }

      return result;
    } catch (error) {
      console.error('[EventBridge] Failed to update schedule:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert Date to one-time cron expression
   *
   * Cron format: at(YYYY-MM-DDTHH:MM:SS)
   *
   * @param date - The exact time to schedule
   */
  private dateToOneTimeCron(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `at(${year}-${month}-${day}T${hours}:${minutes}:${seconds})`;
  }
}

// Singleton instance
let schedulerInstance: EventBridgeScheduler | null = null;

/**
 * Get EventBridge Scheduler instance
 *
 * @returns EventBridgeScheduler singleton
 */
export function getEventBridgeScheduler(): EventBridgeScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new EventBridgeScheduler();
  }
  return schedulerInstance;
}
