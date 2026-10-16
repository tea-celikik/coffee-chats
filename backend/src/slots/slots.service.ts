import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Slot } from './slot.entity';
import { CreateSlotDto } from './slot.dto';

@Injectable()
export class SlotsService {
  constructor(@InjectRepository(Slot) private readonly slots: Repository<Slot>) {}

  async create(dto: CreateSlotDto): Promise<Slot> {
    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Slot must start in the future');
    }
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);

    // The host can't be in two chats at once, reject overlapping slots.
    // Two ranges overlap if, existing.start < new.end AND existing.end > new.start
    const overlapping = await this.slots
      .createQueryBuilder('s')
      .where('s.startsAt < :endsAt', { endsAt })
      .andWhere(`s.startsAt + s.durationMinutes * interval '1 minute' > :startsAt`, { startsAt })
      .getCount();
    if (overlapping > 0) throw new ConflictException('This slot overlaps an existing one');

    return this.slots.save(this.slots.create({ startsAt, durationMinutes: dto.durationMinutes }));
  }

  // Public view: only whether a slot is taken, never who took it
  async listPublic() {
    const rows = await this.upcomingWithBookings();
    return rows.map((s) => ({
      id: s.id,
      startsAt: s.startsAt,
      durationMinutes: s.durationMinutes,
      isBooked: !!s.booking,
    }));
  }

  // Host view: includes guest details
  listForHost(): Promise<Slot[]> {
    return this.upcomingWithBookings();
  }

  async remove(id: string): Promise<void> {
    const result = await this.slots.delete(id);
    if (!result.affected) throw new NotFoundException('Slot not found');
  }

  private upcomingWithBookings(): Promise<Slot[]> {
    return this.slots
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.booking', 'b') // leftJoin: keep slots that have no booking
      .where('s.startsAt > now()')         // hide past slots
      .orderBy('s.startsAt', 'ASC')
      .getMany();
  }
}