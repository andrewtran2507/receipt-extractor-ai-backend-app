import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptExtractorService } from './receipt-extractor.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs');

describe('ReceiptExtractorService', () => {
  let service: ReceiptExtractorService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptExtractorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'fake-api-key';
              if (key === 'SERVER_URL') return 'http://localhost';
              if (key === 'PORT') return '3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ReceiptExtractorService>(ReceiptExtractorService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock the generative model
    (service as any).model = {
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              date: '2023-10-26',
              currency: 'USD',
              vendorName: 'Test Store',
              items: [{ name: 'Item 1', cost: 10 }],
              gstOrTax: 1.5,
              total: 11.5,
            }),
        },
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should throw BadRequestException if imageBuffer or imageMimeType is missing', async () => {
    await expect(
      service.extractDataFromReceipt(null as any, 'image/png'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.extractDataFromReceipt(Buffer.from(''), null as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for unsupported mime types', async () => {
    await expect(
      service.extractDataFromReceipt(Buffer.from('test'), 'image/gif'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return parsed DTO for valid input', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    const buffer = Buffer.from('test');
    const result = await service.extractDataFromReceipt(buffer, 'image/png');
    expect(result).toHaveProperty('date', '2023-10-26');
    expect(result).toHaveProperty('currency', 'USD');
    expect(result).toHaveProperty('vendorName', 'Test Store');
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('tax', 1.5);
    expect(result).toHaveProperty('total', 11.5);
    expect(result).toHaveProperty('imageUrl');
  });

  it('should throw InternalServerErrorException if Gemini returns invalid JSON', async () => {
    (service as any).model.generateContent.mockResolvedValueOnce({
      response: {
        text: () => 'not a json',
      },
    });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    await expect(
      service.extractDataFromReceipt(Buffer.from('test'), 'image/png'),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
