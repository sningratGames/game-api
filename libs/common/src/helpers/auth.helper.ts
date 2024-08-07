import { Injectable, HttpStatus, Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { ResponseService } from "@app/common/response/response.service";
import { IResponseError } from "@app/common/response/response.interface";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { ConfigService } from "@nestjs/config";
import { User } from "../model/schema/users.schema";

@Injectable()
export class AuthHelper {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,

    @Inject(ResponseService) private readonly responseService: ResponseService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    private jwtService: JwtService,
  ) { }

  // Validate token
  public validateToken(token: string) {
    const decoded = this.jwtService.verify(token, { secret: this.configService.get("JWT_SECRET") });
    return decoded;
  }

  // Get User by User ID we get from decode()
  public async validateUser(decoded: any): Promise<User> {
    const user = await this.userModel.findOne({ _id: new Types.ObjectId(decoded._id) });
    return user;
  }

  // Generate JWT Token
  public async generateTokens(
    userId: Types.ObjectId,
    data: { name: string; role: string; email?: string; phoneNumber?: string },
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          _id: userId,
          ...data,
        },
        {
          secret: this.configService.get("JWT_SECRET"),
          expiresIn: "1d",
        },
      ),
      this.jwtService.signAsync(
        {
          _id: userId,
          ...data,
        },
        {
          secret: this.configService.get("JWT_SECRET"),
          expiresIn: "3d",
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  // Validate User's password
  public isPasswordValid(password: string, userPassword: string): boolean {
    return bcrypt.compareSync(password, userPassword);
  }

  // Encode User's password
  public encodePassword(password: string): string {
    const salt: string = bcrypt.genSaltSync(10);

    return bcrypt.hashSync(password, salt);
  }

  // Validate JWT Token, throw forbidden error if JWT Token is invalid
  public async validate(token: string): Promise<any | IResponseError> {
    const decoded: unknown = this.jwtService.verify(token);
    if (!decoded) return this.responseService.error(HttpStatus.UNAUTHORIZED, "User Unauthorized!", { value: "", constraint: "", property: "" });

    const user: User = await this.validateUser(decoded);
    if (!user) return this.responseService.error(HttpStatus.UNAUTHORIZED, "User Unauthorized!", { value: "", constraint: "", property: "" });

    return {
      isValid: true,
      user
    };
  }

  // Logout user
  public async logout(user: User): Promise<any> {
    return await this.userModel.findOneAndUpdate({ _id: user._id }, { $set: { refreshToken: null, isActive: false } });
  }
}
