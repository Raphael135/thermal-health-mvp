import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDoctorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  crm!: string;

  @IsOptional()
  @IsString()
  specialty?: string;
}
