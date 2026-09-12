import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { THERMAL_PROCESSING_QUEUE, ThermalProcessingJobData } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleDestroy {
  readonly thermalProcessingQueue: Queue<ThermalProcessingJobData>;

  constructor() {
    this.thermalProcessingQueue = new Queue<ThermalProcessingJobData>(THERMAL_PROCESSING_QUEUE, {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  async enqueueThermalProcessing(data: ThermalProcessingJobData) {
    return this.thermalProcessingQueue.add('process', data);
  }

  async onModuleDestroy() {
    await this.thermalProcessingQueue.close();
  }
}
