import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Booking } from './booking.entity';
import { Slot } from '../slots/slot.entity';
import { CreateBookingDto } from './booking.dto';
import { AiService } from '../ai/ai.service';

const PG_UNIQUE_VIOLATION = '23505'; // Postgres error code for a UNIQUE constraint violation

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Slot) private readonly slots: Repository<Slot>,
    private readonly ai: AiService,
  ) {}

  async book(slotId: string, dto: CreateBookingDto) {
    const slot = await this.slots.findOne({ where: { id: slotId }, relations: { booking: true } });
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.startsAt.getTime() <= Date.now()) throw new BadRequestException('This slot is in the past');

    // Fast path: friendly error in the common case, and no paid AI call for nothing.
    // NOT enough on its own (race condition) - the UNIQUE constraint is the real guard
    if (slot.booking) throw new ConflictException('This slot is already booked');

    // Generated before the insert so it's saved with the booking. Never throws (has a fallback)
    const confirmationMessage = await this.ai.confirmationMessage({
      name: dto.name,
      note: dto.note,
      startsAt: slot.startsAt,
      durationMinutes: slot.durationMinutes,
    });

    try {
      const booking = await this.bookings.save(
        this.bookings.create({
          slotId,
          name: dto.name,
          email: dto.email,
          note: dto.note || null,
          confirmationMessage,
        }),
      );
      // Return only what the guest needs, not the whole entity
      return {
        id: booking.id,
        slotId,
        name: booking.name,
        startsAt: slot.startsAt,
        durationMinutes: slot.durationMinutes,
        confirmationMessage,
      };
    } catch (err) {
      // Someone booked between our check and our insert: the UNIQUE constraint caught it
      if (err instanceof QueryFailedError && (err as any).driverError?.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('This slot is already booked');
      }
      throw err; // anything else is a real error -> 500
    }
  }
}
