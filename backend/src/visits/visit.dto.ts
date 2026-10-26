import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export enum Sex { M = 'M', F = 'F' }
export enum MembershipStatus { MEMBER = 'MEMBER', BENEFICIARY = 'BENEFICIARY' }
export enum ServiceType { OPD = 'OPD', IPD = 'IPD', EM = 'EM' }

const money = () => [IsOptional(), IsNumber({ maxDecimalPlaces: 2 }), Min(0), Max(9_999_999_999)];
const apply = (decs: PropertyDecorator[]) => (t: object, k: string) => decs.forEach((d) => d(t, k));

export class VisitDto {
  @IsInt() facilityId: number;
  @IsDateString({ strict: true }) visitDate: string; // YYYY-MM-DD (Gregorian)
  @IsInt() @Min(0) @Max(120) ageAtVisit: number;

  // patient (upserted by shiId)
  @IsString() @MinLength(1) @MaxLength(40) shiId: string;
  @IsString() @MinLength(2) @MaxLength(200) name: string;
  @IsEnum(Sex) sex: Sex;
  @IsEnum(MembershipStatus) membershipStatus: MembershipStatus;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) woreda?: string;
  @IsOptional() @IsString() @MaxLength(200) employer?: string;

  // visit
  @IsOptional() @IsString() @MaxLength(60) medicalRecordId?: string;
  @IsEnum(ServiceType) serviceType: ServiceType;
  @IsOptional() @IsString() @MaxLength(500) diagnosis?: string;
  @IsOptional() @IsString() @MaxLength(500) labServices?: string;
  @IsOptional() @IsString() @MaxLength(500) imagingServices?: string;
  @IsOptional() @IsString() @MaxLength(500) procedures?: string;
  @IsOptional() @IsString() @MaxLength(500) medicines?: string;

  @apply(money()) costConsultation?: number;
  @apply(money()) costLaboratory?: number;
  @apply(money()) costImaging?: number;
  @apply(money()) costSurgical?: number;
  @apply(money()) costMedicine?: number;
  @apply(money()) costFoodBed?: number;
  @apply(money()) costOthers?: number;
}

export class ListQueryDto {
  @Type(() => Number) @IsInt() facilityId: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from: string; // inclusive
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to: string;   // inclusive
  @IsOptional() @IsString() q?: string;

  // optional filters
  @IsOptional() @IsString() @MaxLength(100) woreda?: string;
  @IsOptional() @IsEnum(Sex) sex?: Sex;
  @IsOptional() @IsEnum(ServiceType) serviceType?: ServiceType;
  @IsOptional() @IsEnum(MembershipStatus) membershipStatus?: MembershipStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) minAge?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) maxAge?: number;
}

export class ExportQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['ethiopian', 'gregorian']) calendar?: 'ethiopian' | 'gregorian';
}
