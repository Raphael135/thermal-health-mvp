import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateThermalCaptureDto {
  @IsUUID()
  patientId!: string;

  @IsInt()
  @Min(1)
  width!: number;

  @IsInt()
  @Min(1)
  height!: number;

  @IsIn(['celsius', 'fahrenheit'])
  unit!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  temperatures!: number[];

  // Opcional: o aparelho só manda se conseguiu acertar o relógio (SNTP). Sem isso, vale a hora de
  // recebimento no servidor.
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}
