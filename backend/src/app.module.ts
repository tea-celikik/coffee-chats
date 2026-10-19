import { SlotsController } from './slots/slots.controller';
import { SlotsService } from './slots/slots.service';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Slot } from './slots/slot.entity';
import { Booking } from './bookings/booking.entity';
import { BookingsController } from './bookings/bookings.controller';
import { BookingsService } from './bookings/bookings.service';
import { AiService } from './ai/ai.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // loads .env, available in every module
    // Async so the DB config is read from .env at startup, not hardcoded
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'), // fail fast if missing
        entities: [Slot, Booking],
        synchronize: true, // auto-creates tables from entities, dev only, use migrations in prod
      }),
    }),
    TypeOrmModule.forFeature([Slot, Booking]), // makes Repository<Slot> injectable
  ],
  controllers: [AppController, SlotsController, BookingsController],
  providers: [AppService, SlotsService, BookingsService, AiService],
})
export class AppModule {}