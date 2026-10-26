import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('patients')
export class PatientsController {
  constructor(private prisma: PrismaService) {}

  // Used by the entry form: type an SHI/NID ID and the patient's details autofill.
  @Get('lookup')
  lookup(@Query('shiId') shiId = '') {
    return this.prisma.patient.findUnique({ where: { shiId: shiId.trim() } });
  }
}
