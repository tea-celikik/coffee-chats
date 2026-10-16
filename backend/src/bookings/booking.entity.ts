import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Slot } from '../slots/slot.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Owning side of the 1:1 relation, creates slotId with a UNIQUE constraint,
  // so the database itself rejects a second booking for the same slot
  @OneToOne(() => Slot, (slot) => slot.booking, { onDelete: 'CASCADE' }) // deleting a slot deletes its booking
  @JoinColumn({ name: 'slotId' })
  slot!: Slot;

  @Column() // same column as above, exposed for easy reads/writes
  slotId!: string;

  @Column({ length: 100 }) // length limits are enforced by the DB too
  name!: string;

  @Column({ length: 254 }) // 254 = max valid email length
  email!: string;

  @Column({ type: 'varchar', length: 300, nullable: true }) // optional chat topic
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}