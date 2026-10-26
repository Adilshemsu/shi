# SHI Patient Register

Web app that replaces the monthly Excel register (`SHI_Register.xlsx`) with a PostgreSQL database.

**Stack:** NestJS + Prisma + PostgreSQL · React + Vite + TypeScript + Tailwind + TanStack Query

## Run it

```bash
docker compose up -d                     # PostgreSQL 16 (or use your own and edit backend/.env)

cd backend
cp .env.example .env
npm install                              # also runs `prisma generate`
npx prisma migrate deploy                # creates the tables
npm run dev                              # API on http://localhost:3000/api

cd ../frontend
npm install
npm run dev                              # UI on http://localhost:5173
```

## Import your existing Excel files

Filled-in sheets that use the same layout as `SHI_Register.xlsx` (data from row 9, columns A–Y, ends at the TOTAL row):

```bash
cd backend
npm run import -- ../old-data/month1.xlsx --ethiopian --dry-run   # check first
npm run import -- ../old-data/month1.xlsx --ethiopian             # then import
```
`--ethiopian` = text dates like `14/02/2019` are Ethiopian calendar (d/m/y). Rows with a bad date/sex/service type/ID are skipped and listed by row number.

## Filters and Excel export

- **Filters:** woreda, sex, service type (OPD/IPD/EM), membership, age range, plus free-text search (name, SHI ID, MRN, diagnosis). The period is an Ethiopian month or the whole Ethiopian year. Visits count, patients, costs and the TOTAL row all follow the active filters.
- **Export Excel** downloads exactly what is on screen (same period + filters). It is built from the official form (`backend/assets/SHI_Register_template.xlsx`), so the logo and layout are preserved, with the TOTAL row as live `SUM` formulas. Row count adjusts automatically (fewer or more than the form's 143 lines). A second **Summary** sheet has visits and cost by woreda, service type and sex. Dates can be written as Ethiopian (`14/2/2019`) or Gregorian, and an exported file can be re-imported with `npm run import`.
- **Woreda list:** `backend/src/common/woredas.ts`. It was written from general knowledge, **not** from an official source — check it against the Afar Regional Health Bureau's list and edit that one file. The entry form also has "Other (type it)…" so a missing woreda never blocks work.

## How the spreadsheet maps to the database

| Spreadsheet | Database |
|---|---|
| Name, sex, woreda, employer, member/beneficiary, NID/SHI ID, phone | `Patient` (one row per person, unique by SHI ID) |
| Date, age, MRN, OPD/IPD/EM, diagnosis, lab/imaging/procedure/medicine, 7 costs | `Visit` (one row per register line) |
| Facility name at top of the sheet | `Facility` |
| S.No | not stored — it is just the row number in the monthly view |
| Total Sum (col Y) and TOTAL row | computed by the server (`Visit.totalCost`, `/visits/summary`) |

Dates are stored as Gregorian `DATE`; the UI shows the Ethiopian equivalent and the month picker uses Ethiopian months (`Tikimt 2019` → 11 Oct – 9 Nov 2026).

## API

`GET /api/visits?facilityId&from&to&q&woreda&sex&serviceType&membershipStatus&minAge&maxAge` · `GET /api/visits/export?…same filters…&calendar=ethiopian|gregorian` · `GET /api/meta/woredas`

Original list endpoint: `GET /api/visits?facilityId&from&to&q` · `GET /api/visits/summary?…` · `POST /api/visits` · `PUT /api/visits/:id` · `DELETE /api/visits/:id` · `GET /api/patients/lookup?shiId=` · `GET|PATCH /api/facilities`

## Before real patient data goes in

- **There is no login yet.** This is health data: add authentication/roles before deploying anywhere other than your own machine.
- Put the database behind HTTPS and set up backups.
