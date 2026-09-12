import { Injectable } from '@nestjs/common';

export interface ProcessThermalMatrixRequest {
  width: number;
  height: number;
  unit: string;
  temperatures: number[];
}

export interface ProcessThermalMatrixResponse {
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  imageWidth: number;
  imageHeight: number;
  /** PNG do heatmap, codificado em base64 — o worker decodifica e salva no storage. */
  imageBase64: string;
}

/** Cliente HTTP para services/thermal-processor (FastAPI). Chamado apenas pelo worker. */
@Injectable()
export class ThermalProcessorClient {
  private readonly baseUrl = process.env.THERMAL_PROCESSOR_URL ?? 'http://localhost:8000';

  async processMatrix(payload: ProcessThermalMatrixRequest): Promise<ProcessThermalMatrixResponse> {
    const response = await fetch(`${this.baseUrl}/process-thermal-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Falha ao processar matriz térmica (${response.status}): ${text}`);
    }

    return response.json() as Promise<ProcessThermalMatrixResponse>;
  }
}
