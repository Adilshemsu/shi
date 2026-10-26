-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('MEMBER', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('OPD', 'IPD', 'EM');

-- CreateTable
CREATE TABLE "Facility" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "shiId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sex" "Sex" NOT NULL,
    "phone" TEXT,
    "woreda" TEXT,
    "employer" TEXT,
    "membershipStatus" "MembershipStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "facilityId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "visitDate" DATE NOT NULL,
    "ageAtVisit" INTEGER NOT NULL,
    "medicalRecordId" TEXT,
    "serviceType" "ServiceType" NOT NULL,
    "diagnosis" TEXT,
    "labServices" TEXT,
    "imagingServices" TEXT,
    "procedures" TEXT,
    "medicines" TEXT,
    "costConsultation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costLaboratory" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costImaging" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costSurgical" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costMedicine" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costFoodBed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costOthers" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facility_name_key" ON "Facility"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_shiId_key" ON "Patient"("shiId");

-- CreateIndex
CREATE INDEX "Visit_facilityId_visitDate_idx" ON "Visit"("facilityId", "visitDate");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
