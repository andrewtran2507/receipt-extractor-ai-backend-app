import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException, // Added for explicit file check
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReceiptExtractorService } from './receipt-extractor.service';
import { ExtractedReceiptDataDto } from './dto/extracted-receipt-data.dto'; // Import the DTO
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

@ApiTags('Receipts') // Group endpoints under this tag in Swagger UI
@Controller('receipt-extractor')
export class ReceiptExtractorController {
  private readonly logger = new Logger(ReceiptExtractorController.name);

  constructor(
    private readonly receiptExtractorService: ReceiptExtractorService,
  ) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Extract data from a receipt image',
    description:
      'Upload a receipt image (JPG, JPEG, PNG) to extract structured data like merchant name, date, total amount, and items.',
  })
  @ApiConsumes('multipart/form-data') // Specify content type for file upload
  @ApiBody({
    description:
      'Receipt image file. Max size 10MB. Allowed types: jpg, jpeg, png.',
    schema: {
      type: 'object',
      properties: {
        receiptImage: {
          // This 'receiptImage' must match the FileInterceptor key
          type: 'string',
          format: 'binary', // Indicates a file upload
        },
      },
      required: ['receiptImage'], // Make the file field required in Swagger
    },
  })
  @ApiOkResponse({
    description: 'Successfully extracted data from the receipt.',
    type: ExtractedReceiptDataDto, // Use the DTO for the response schema
  })
  @ApiBadRequestResponse({
    description:
      'Bad Request - Invalid file, unsupported MIME type, or AI safety block.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Internal Server Error - AI service communication or parsing error.',
  })
  @UseInterceptors(FileInterceptor('receiptImage')) // 'receiptImage' is the field name in FormData
  async extractReceiptData(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB limit
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png)$/i,
          }),
        ],
        // Making file optional at pipe level and handling it manually
        // because ParseFilePipe throws if file is not present
        // and we want to show a clear message in Swagger.
        // Or, keep it non-optional and let the pipe handle the 400.
        // For simplicity, we'll let the pipe handle it if the field is missing.
      }),
    )
    file: Express.Multer.File,
  ): Promise<ExtractedReceiptDataDto> {
    // The ParseFilePipe should already handle the case where `file` is undefined.
    // If `file` is truly optional, you'd add `fileIsRequired: false` to ParseFilePipe
    // and then check here:
    if (!file) {
      // This would typically be caught by ParseFilePipe if `receiptImage` is missing from the form.
      // This check is more of a safeguard if pipe settings were different.
      throw new BadRequestException(
        'No file uploaded. The "receiptImage" field is required.',
      );
    }

    this.logger.log(
      `Received file: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`,
    );

    return this.receiptExtractorService.extractDataFromReceipt(
      file.buffer,
      file.mimetype,
    );
  }
}
