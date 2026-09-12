import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateObservationDto {
  @IsUUID()
  examinationId!: string;

  @IsString()
  @MinLength(3)
  note!: string;

  @IsOptional()
  @IsBoolean()
  releasedToPatient?: boolean;
}
