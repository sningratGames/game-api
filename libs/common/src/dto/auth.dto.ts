import { IsNotEmpty, IsString, ValidateIf } from "class-validator";

export class LoginUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class LoginAdminDto {
  @ValidateIf((e) => !!e)
  @IsNotEmpty()
  @IsString()
  email: string;

  @ValidateIf((e) => !!e)
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  password: string;
}

export class ReauthDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
