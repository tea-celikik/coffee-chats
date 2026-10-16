import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { CreateSlotDto } from './slot.dto';
import { HostKeyGuard } from '../common/host-key.guard';

@Controller()
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get('slots') // public
  listPublic() {
    return this.slots.listPublic();
  }

  @UseGuards(HostKeyGuard)
  @Get('host/slots')
  listForHost() {
    return this.slots.listForHost();
  }

  @UseGuards(HostKeyGuard)
  @Post('host/slots')
  create(@Body() dto: CreateSlotDto) {
    return this.slots.create(dto);
  }

  @UseGuards(HostKeyGuard)
  @Delete('host/slots/:id')
  @HttpCode(204) // success with no response body
  remove(@Param('id', ParseUUIDPipe) id: string) { // rejects non UUID ids with 400
    return this.slots.remove(id);
  }
}