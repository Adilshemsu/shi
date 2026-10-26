import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { ExportQueryDto, ListQueryDto, VisitDto } from './visit.dto';
import { ExportService } from './export.service';
import { VisitsService } from './visits.service';

@Controller('visits')
export class VisitsController {
  constructor(private svc: VisitsService, private exporter: ExportService) {}
  @Get() list(@Query() q: ListQueryDto) { return this.svc.list(q); }
  @Get('summary') summary(@Query() q: ListQueryDto) { return this.svc.summary(q); }
  @Get('export')
  async export(@Query() q: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    const { buffer, filename } = await this.exporter.build(q);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }
  @Post() create(@Body() dto: VisitDto) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: VisitDto) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}
