import { Worker, Job } from 'bullmq';
import { THERMAL_PROCESSING_QUEUE, ThermalProcessingJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ExaminationsService } from '../examinations/examinations.service';
import { ThermalProcessorClient } from '../thermal-processor-client/thermal-processor.client';

export function createThermalProcessingWorker(deps: {
  prisma: PrismaService;
  storage: StorageService;
  examinations: ExaminationsService;
  processorClient: ThermalProcessorClient;
}): Worker<ThermalProcessingJobData> {
  return new Worker<ThermalProcessingJobData>(
    THERMAL_PROCESSING_QUEUE,
    async (job: Job<ThermalProcessingJobData>) => {
      const { examinationId, thermalCaptureId } = job.data;

      await deps.examinations.markProcessing(examinationId);

      const capture = await deps.prisma.thermalCapture.findUniqueOrThrow({
        where: { id: thermalCaptureId },
      });

      const result = await deps.processorClient.processMatrix({
        width: capture.width,
        height: capture.height,
        unit: capture.unit,
        temperatures: capture.rawTemperatures as number[],
      });

      const imageBuffer = Buffer.from(result.imageBase64, 'base64');
      const storageKey = `exams/${examinationId}/thermal-image.png`;
      const { bucket } = await deps.storage.uploadObject(storageKey, imageBuffer, 'image/png');

      await deps.examinations.markProcessed(examinationId, thermalCaptureId, {
        minTemp: result.minTemp,
        maxTemp: result.maxTemp,
        avgTemp: result.avgTemp,
        storageBucket: bucket,
        storageKey,
      });
    },
    {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    },
  );
}
