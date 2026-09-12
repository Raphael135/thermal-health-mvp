import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ExaminationsService } from '../examinations/examinations.service';
import { ThermalProcessorClient } from '../thermal-processor-client/thermal-processor.client';
import { createThermalProcessingWorker } from './thermal-processing.worker';

/**
 * Processo separado do servidor HTTP (services/api).
 * Rodar com: npm run worker  (ou worker:dev)
 */
async function bootstrapWorker() {
  const appContext = await NestFactory.createApplicationContext(AppModule);

  const prisma = appContext.get(PrismaService);
  const storage = appContext.get(StorageService);
  const examinations = appContext.get(ExaminationsService);
  const processorClient = new ThermalProcessorClient();

  const worker = createThermalProcessingWorker({ prisma, storage, examinations, processorClient });

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[worker] job ${job.id} concluído (exame ${job.data.examinationId})`);
  });

  worker.on('failed', async (job, error) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} falhou:`, error);
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await examinations.markFailed(job.data.examinationId, error.message);
    }
  });

  // eslint-disable-next-line no-console
  console.log('[worker] thermal-processing worker rodando');
}

bootstrapWorker();
