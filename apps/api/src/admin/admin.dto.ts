import { IsBoolean, IsDateString, IsIn, IsOptional } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsIn(['active', 'read_only', 'frozen'])
  mode?: 'active' | 'read_only' | 'frozen';

  @IsOptional()
  @IsIn(['light', 'business'])
  plan?: 'light' | 'business';

  @IsOptional()
  @IsBoolean()
  isTrial?: boolean;

  @IsOptional()
  @IsDateString()
  planExpiresAt?: string;
}
