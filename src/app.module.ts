import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ReceiptExtractorModule } from './receipt-extractor/receipt-extractor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available globally
      envFilePath: '.env',
    }),
    ReceiptExtractorModule, // Add our new module
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
