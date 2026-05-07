import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  GenerativeModel,
} from '@google/generative-ai';
import { ExtractedReceiptDataDto } from './dto/extracted-receipt-data.dto'; // Import DTO
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReceiptExtractorService {
  private readonly logger = new Logger(ReceiptExtractorService.name);
  private genAI: GoogleGenerativeAI;
  private model;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const aiModel = this.configService.get<string>('GEMINI_AI_MODEL');
    console.log('ai model:', aiModel);
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not defined in environment variables.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey);

    const generationConfig: GenerationConfig = {
      temperature: 0.2,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };

    this.model = this.genAI.getGenerativeModel({
      model: aiModel ?? '',
      generationConfig,
    });
  }

  private fileToGenerativePart(buffer: Buffer, mimeType: string) {
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };
  }

  async extractDataFromReceipt(
    imageBuffer: Buffer,
    imageMimeType: string,
  ): Promise<ExtractedReceiptDataDto> {
    // Return type is DTO
    if (!imageBuffer || !imageMimeType) {
      throw new BadRequestException('Image buffer and MIME type are required.');
    }
    const supportedMimeTypes = ['image/png', 'image/jpeg'];
    if (!supportedMimeTypes.includes(imageMimeType.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported image MIME type: ${imageMimeType}. Supported types are: ${supportedMimeTypes.join(', ')}`,
      );
    }

    // 1. Generate UUID for this receipt
    const receiptId = uuidv4();

    // 2. Save image to local uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const extension = imageMimeType === 'image/png' ? 'png' : 'jpg';
    const filename = `${receiptId}.${extension}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, imageBuffer);

    // 3. Construct image URL (assuming uploads are served at /uploads)
    const serverUrl = this.configService.get<string>('SERVER_URL')
      ? `${this.configService.get<string>('SERVER_URL')}:${this.configService.get<string>('PORT')}`
      : 'http://localhost:3000';
    const imageUrl = `${serverUrl}/uploads/${filename}`;
    // Return type is DTO
    if (!imageBuffer || !imageMimeType) {
      throw new BadRequestException('Image buffer and MIME type are required.');
    }

    const imagePart = this.fileToGenerativePart(imageBuffer, imageMimeType);
    const prompt = `
      You are an intelligent receipt parser.
      Analyze the provided receipt image and extract the following information:
      - Date (string, in YYYY-MM-DD format if possible, otherwise as it appears) as "date"
      - Currency (3-character currency code, e.g., USD, EUR, GBP) as "currency"
      - Vendor name (string) as "vendorName"
      - Receipt items (array), as "items", where each item has:
        - name (string)
        - cost (number)
      - GST/tax for the entire receipt (number, as "gstOrTax")
      - Total amount (number, as "total")

      If a piece of information is not clearly visible or inferable, use null or omit the field.
      Respond ONLY with a valid JSON object containing these fields. Do not include any explanatory text before or after the JSON.
      Example of desired JSON format:
      {
        "date": "2023-10-26",
        "currency": "USD",
        "vendorName": "Example Store",
        "items": [
          { "name": "Product A", "cost": 50.00 },
          { "name": "Product B", "cost": 75.50 }
        ],
        "gstOrTax": 10.00,
        "total": 125.50
      }
    `;

    const parts = [{ text: prompt }, imagePart];
    this.logger.log('Sending request to Gemini API...');

    try {
      const result = await (this.model as GenerativeModel).generateContent({
        contents: [{ role: 'user', parts }],
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });

      const response = result.response;
      const responseText = response.text();
      this.logger.log('Received response from Gemini API.');

      if (!responseText) {
        this.logger.error('Gemini API returned an empty response.');
        throw new InternalServerErrorException(
          'Failed to extract data: Empty response from AI.',
        );
      }

      let jsonData = responseText.trim();
      if (jsonData.startsWith('```json')) {
        jsonData = jsonData.substring(7);
      }
      if (jsonData.endsWith('```')) {
        jsonData = jsonData.substring(0, jsonData.length - 3);
      }

      try {
        const parsedData = JSON.parse(jsonData) as ExtractedReceiptDataDto;
        const dto: ExtractedReceiptDataDto = {
          id: receiptId,
          date: parsedData.date,
          currency: parsedData.currency,
          vendorName: parsedData.vendorName,
          items: parsedData.items ?? [],
          tax: (parsedData.gstOrTax as number) || undefined,
          total: parsedData.total,
          imageUrl,
        };
        return dto;
      } catch (parseError) {
        this.logger.error(
          `Failed to parse JSON response from Gemini: ${(parseError as Error).message}`,
        );
        this.logger.error(`Raw response was: ${responseText}`);
        throw new InternalServerErrorException(
          'Failed to parse extracted data from AI response.',
        );
      }
    } catch (error) {
      this.logger.error(
        `Error calling Gemini API: ${(error as Error).message}`,
        (error as Error).stack,
      );
      if ((error as Error).message?.includes('SAFETY')) {
        throw new BadRequestException(
          'Content blocked due to safety settings. Please try a different image or adjust settings.',
        );
      }
      throw new InternalServerErrorException(
        'An error occurred while communicating with the AI service.',
      );
    }
  }
}
