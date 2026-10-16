import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

// Protects host-only routes with a shared secret sent in the x-host-key header
@Injectable()
export class HostKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const provided = Buffer.from(req.header('x-host-key') ?? '');
    const expected = Buffer.from(this.config.getOrThrow<string>('HOST_KEY'));

    // Constant time comparison so the key can't be guessed via response timing
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid host key');
    }
    return true;
  }
}