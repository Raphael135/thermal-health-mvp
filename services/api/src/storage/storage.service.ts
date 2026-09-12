import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class StorageService {
  private readonly s3: AWS.S3;
  private readonly signingS3: AWS.S3;
  private readonly bucket: string;

  constructor() {
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const endpoint = `${useSSL ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`;

    this.s3 = new AWS.S3({
      endpoint,
      accessKeyId: process.env.MINIO_ROOT_USER,
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    // As URLs assinadas são abertas pelo navegador do médico (fora da rede Docker),
    // então precisam de um host alcançável de fora — diferente do endpoint interno
    // usado pela própria API para falar com o MinIO (ex.: "minio:9000").
    const publicEndpoint = process.env.MINIO_PUBLIC_URL ?? endpoint;
    this.signingS3 = new AWS.S3({
      endpoint: publicEndpoint,
      accessKeyId: process.env.MINIO_ROOT_USER,
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    this.bucket = process.env.MINIO_BUCKET ?? 'thermal-exams';
  }

  /** Salva o PNG do heatmap. Nunca torna o objeto público. */
  async uploadObject(key: string, body: Buffer, contentType: string): Promise<{ bucket: string; key: string }> {
    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
      .promise();

    return { bucket: this.bucket, key };
  }

  /** URL assinada de curta duração — única forma de um cliente acessar a imagem. */
  getSignedUrl(key: string, expiresInSeconds?: number): string {
    const expires = expiresInSeconds ?? Number(process.env.SIGNED_URL_EXPIRES_IN_SECONDS ?? 300);
    return this.signingS3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expires,
    });
  }
}
