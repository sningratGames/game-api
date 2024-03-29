import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { PartialType } from "@nestjs/swagger";
import { SearchDTO } from "./search.dto";

export class DefineGameDTO {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  author: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  category: string;

  @IsNotEmpty()
  @IsNumber()
  maxLevel: number;

  @IsNotEmpty()
  @IsNumber()
  maxRetry: number;

  @IsNotEmpty()
  @IsNumber()
  maxTime: number;
}

export class ListGameDTO extends PartialType(SearchDTO) {
  @IsOptional()
  @IsString()
  author?: string;
}

export class EditGameDTO extends PartialType(DefineGameDTO) {
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}

export class ListGameByAuthorDTO {
  @IsNotEmpty()
  @IsString()
  author: string;
}

export class ByGameIdDTO {
  @IsNotEmpty()
  @IsMongoId()
  gameId: string;
}