import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class ReceiptItemDto {
  @ApiProperty({ example: 'Product A', description: 'Name of the item' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'Cost of the item',
  })
  @IsNumber()
  @IsOptional()
  cost?: number;
}

export class ExtractedReceiptDataDto {
  @ApiPropertyOptional({
    example: '123456',
    description: 'Unique identifier for the receipt',
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({
    example: '2023-10-26',
    description:
      'Date of the receipt (YYYY-MM-DD if possible, otherwise as it appears)',
  })
  @IsString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency code (3-character, e.g., USD, EUR)',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    example: 'Example Vendor',
    description: 'Name of the vendor',
  })
  @IsString()
  @IsOptional()
  vendorName?: string;

  @ApiPropertyOptional({
    type: () => [ReceiptItemDto],
    description: 'List of items on the receipt',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  @IsOptional()
  items?: ReceiptItemDto[];

  @ApiPropertyOptional({
    example: 10.0,
    description: 'GST/tax for the entire receipt',
  })
  @IsNumber()
  @IsOptional()
  tax?: number;

  @ApiPropertyOptional({
    example: 125.5,
    description: 'Total amount of the receipt',
  })
  @IsNumber()
  @IsOptional()
  total?: number;

  @ApiPropertyOptional({
    example: 'https://example.com/receipt.jpg',
    description: 'URL of the receipt image',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  [key: string]: any;
}
