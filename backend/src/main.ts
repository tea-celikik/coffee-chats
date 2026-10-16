import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the React dev server to call this API from the browser
  app.enableCors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173' });

  // Validate every request body against its DTO class
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip fields not defined in the DTO
      forbidNonWhitelisted: true, // and reject the request if it sends them
      transform: true,            // turn plain JSON into DTO class instances
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();