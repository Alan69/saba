import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

const PHONE_RE = /^\+?[0-9]{10,15}$/;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @Matches(PHONE_RE, { message: 'Неверный формат телефона' })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Пароль минимум 8 символов' })
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginDto {
  @Matches(PHONE_RE, { message: 'Неверный формат телефона' })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;
}

export class PinLoginDto {
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @IsString()
  @MinLength(4)
  pin!: string;
}
