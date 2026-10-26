import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VisitsController } from './visits/visits.controller';
import { VisitsService } from './visits/visits.service';
import { FacilitiesController } from './facilities/facilities.controller';
import { ExportService } from './visits/export.service';
import { MetaController } from './meta.controller';
import { PatientsController } from './patients.controller';
import { FacilitiesService } from './facilities/facilities.service';

@Module({
  controllers: [VisitsController, FacilitiesController, PatientsController, MetaController],
  providers: [PrismaService, VisitsService, ExportService, FacilitiesService],
})
export class AppModule {}
