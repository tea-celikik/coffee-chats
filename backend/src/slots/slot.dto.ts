import { IsDateString, IsIn } from 'class-validator';

export const ALLOWED_DURATIONS = [15, 30, 45, 60];

export class CreateSlotDto {
  @IsDateString() // must be an ISO date string
  startsAt!: string;

  @IsIn(ALLOWED_DURATIONS) // only fixed durations, no 3 minute or 9 hour chats
  durationMinutes!: number;
}