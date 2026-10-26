import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ListQueryDto, VisitDto } from './visit.dto';

const COST_FIELDS = ['costConsultation', 'costLaboratory', 'costImaging', 'costSurgical', 'costMedicine', 'costFoodBed', 'costOthers'] as const;

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  private where(q: ListQueryDto): Prisma.VisitWhereInput {
    const text = q.q?.trim();
    const patient: Prisma.PatientWhereInput = {
      ...(q.woreda && { woreda: q.woreda }),
      ...(q.sex && { sex: q.sex }),
      ...(q.membershipStatus && { membershipStatus: q.membershipStatus }),
    };
    return {
      facilityId: q.facilityId,
      visitDate: { gte: new Date(`${q.from}T00:00:00Z`), lte: new Date(`${q.to}T00:00:00Z`) },
      ...(Object.keys(patient).length && { patient }),
      ...(q.serviceType && { serviceType: q.serviceType }),
      ...((q.minAge != null || q.maxAge != null) && { ageAtVisit: { gte: q.minAge, lte: q.maxAge } }),
      ...(text && {
        OR: [
          { patient: { name: { contains: text, mode: 'insensitive' } } },
          { patient: { shiId: { contains: text, mode: 'insensitive' } } },
          { medicalRecordId: { contains: text, mode: 'insensitive' } },
          { diagnosis: { contains: text, mode: 'insensitive' } },
        ],
      }),
    };
  }

  private build(dto: VisitDto) {
    const costs = Object.fromEntries(COST_FIELDS.map((f) => [f, new Prisma.Decimal(dto[f] ?? 0)])) as Record<(typeof COST_FIELDS)[number], Prisma.Decimal>;
    const totalCost = COST_FIELDS.reduce((sum, f) => sum.plus(costs[f]), new Prisma.Decimal(0));
    const patient = {
      name: dto.name.trim(), sex: dto.sex, membershipStatus: dto.membershipStatus,
      phone: dto.phone || null, woreda: dto.woreda || null, employer: dto.employer || null,
    };
    const visit = {
      facilityId: dto.facilityId,
      visitDate: new Date(`${dto.visitDate.slice(0, 10)}T00:00:00Z`),
      ageAtVisit: dto.ageAtVisit,
      medicalRecordId: dto.medicalRecordId || null,
      serviceType: dto.serviceType,
      diagnosis: dto.diagnosis || null, labServices: dto.labServices || null,
      imagingServices: dto.imagingServices || null, procedures: dto.procedures || null, medicines: dto.medicines || null,
      ...costs, totalCost,
    };
    return { patient, visit, shiId: dto.shiId.trim() };
  }

  async list(q: ListQueryDto) {
    const items = await this.prisma.visit.findMany({
      where: this.where(q),
      include: { patient: true },
      orderBy: [{ visitDate: 'asc' }, { id: 'asc' }],
    });
    return { items, count: items.length };
  }

  async summary(q: ListQueryDto) {
    const where = this.where(q);
    const [sum, byService, patients] = await Promise.all([
      this.prisma.visit.aggregate({
        where, _count: { _all: true },
        _sum: { costConsultation: true, costLaboratory: true, costImaging: true, costSurgical: true, costMedicine: true, costFoodBed: true, costOthers: true, totalCost: true },
      }),
      this.prisma.visit.groupBy({ by: ['serviceType'], where, _count: { _all: true } }),
      this.prisma.visit.findMany({ where, distinct: ['patientId'], select: { patientId: true } }),
    ]);
    return {
      visits: sum._count._all,
      patients: patients.length,
      byService: Object.fromEntries(byService.map((g) => [g.serviceType, g._count._all])),
      totals: sum._sum,
    };
  }

  create(dto: VisitDto) {
    const { patient, visit, shiId } = this.build(dto);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.patient.upsert({ where: { shiId }, create: { shiId, ...patient }, update: patient });
      return tx.visit.create({ data: { ...visit, patientId: p.id }, include: { patient: true } });
    });
  }

  async update(id: number, dto: VisitDto) {
    if (!(await this.prisma.visit.findUnique({ where: { id } }))) throw new NotFoundException('Visit not found');
    const { patient, visit, shiId } = this.build(dto);
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.patient.upsert({ where: { shiId }, create: { shiId, ...patient }, update: patient });
      return tx.visit.update({ where: { id }, data: { ...visit, patientId: p.id }, include: { patient: true } });
    });
  }

  async remove(id: number) {
    try { await this.prisma.visit.delete({ where: { id } }); }
    catch { throw new NotFoundException('Visit not found'); }
    return { deleted: true };
  }
}
