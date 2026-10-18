import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Trim whitespace before validating, so " " counts as empty
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateBookingDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // same limit as the DB column
  name!: string;

  // Normalize email so "Ana@Mail.com" and "ana@mail.com" are the same
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsOptional() // topic is not required
  @IsString()
  @MaxLength(300)
  note?: string;
}