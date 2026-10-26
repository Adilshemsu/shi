import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class FacilitiesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // First run: make sure there is at least one facility so the UI has something to work with.
  async onModuleInit() {
    if ((await this.prisma.facility.count()) === 0) {
      await this.prisma.facility.create({ data: { name: process.env.FACILITY_NAME ?? 'My Health Facility' } });
    }
  }

  list() { return this.prisma.facility.findMany({ orderBy: { id: 'asc' } }); }
  rename(id: number, name: string) { return this.prisma.facility.update({ where: { id }, data: { name } }); }
}
