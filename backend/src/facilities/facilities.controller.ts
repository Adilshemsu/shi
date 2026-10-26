import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { FacilitiesService } from './facilities.service';

class RenameDto {
  @IsString() @MinLength(2) name: string;
}

@Controller('facilities')
export class FacilitiesController {
  constructor(private svc: FacilitiesService) {}
  @Get() list() { return this.svc.list(); }
  @Patch(':id') rename(@Param('id', ParseIntPipe) id: number, @Body() dto: RenameDto) { return this.svc.rename(id, dto.name); }
}
