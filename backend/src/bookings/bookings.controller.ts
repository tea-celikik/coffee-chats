import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './booking.dto';

// Nested route: a booking always belongs to a slot
@Controller('slots/:slotId/bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  book(@Param('slotId', ParseUUIDPipe) slotId: string, @Body() dto: CreateBookingDto) {
    return this.bookings.book(slotId, dto);
  }
}