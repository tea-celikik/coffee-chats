import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../bookings/booking.entity';

@Entity('slots') // maps this class to the slots table
export class Slot {
  @PrimaryGeneratedColumn('uuid') // random, non-guessable ID
  id!: string;

  @Column({ type: 'timestamptz' }) // stored in UTC, shown in local time by the browser
  startsAt!: Date;

  @Column({ type: 'int' })
  durationMinutes!: number;

  @CreateDateColumn({ type: 'timestamptz' }) // set automatically on insert
  createdAt!: Date;

  // Inverse side of the 1:1 relation, no column is created here
  @OneToOne(() => Booking, (booking) => booking.slot)
  booking?: Booking | null;
}