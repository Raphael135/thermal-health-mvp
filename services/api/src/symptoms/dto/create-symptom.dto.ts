import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateSymptomDto {
  @IsString()
  @MinLength(3)
  description!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  severity!: number;

  @IsOptional()
  @IsUUID()
  examinationId?: string;
}
