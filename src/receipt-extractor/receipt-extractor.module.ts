import { Module } from '@nestjs/common';
import { ReceiptExtractorService } from './receipt-extractor.service';
import { ReceiptExtractorController } from './receipt-extractor.controller';
// ConfigModule is global, so no need to import if only using ConfigService

@Module({
  controllers: [ReceiptExtractorController],
  providers: [ReceiptExtractorService],
})
export class ReceiptExtractorModule {}
