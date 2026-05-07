import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.enableCors(); // Optional: Enable CORS if your frontend is on a different domain

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger (OpenAPI) Setup
  const config = new DocumentBuilder()
    .setTitle('Receipt Extractor API')
    .setDescription(
      'API for extracting data from receipt images using Google Gemini AI. Upload an image to get structured data.',
    )
    .setVersion('1.0')
    .addTag('Receipts', 'Operations related to receipt extraction')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'Receipt Extractor API Docs',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger UI available at ${await app.getUrl()}/api-docs`);
}
bootstrap();
