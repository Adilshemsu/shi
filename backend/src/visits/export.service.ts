import { Injectable } from '@nestjs/common';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma.service';
import { ETH_MONTHS_AM, daysInEthMonth, toEthiopian } from '../common/ethiopic';
import { ExportQueryDto } from './visit.dto';
import { VisitsService } from './visits.service';

// The official register form is used as the template, so the export keeps its logo, headers, merges and styling.
const TEMPLATE = path.resolve(__dirname, '..', '..', 'assets', 'SHI_Register_template.xlsx');
const FIRST_ROW = 9, TEMPLATE_ROWS = 143, TEMPLATE_TOTAL_ROW = 152; // rows 9..151 are blank lines, 152 is TOTAL
const COLS = ['R', 'S', 'T', 'U', 'V', 'W', 'X'] as const; // cost columns; Y = total
const COST_KEYS = ['costConsultation', 'costLaboratory', 'costImaging', 'costSurgical', 'costMedicine', 'costFoodBed', 'costOthers'] as const;
const MONEY = '#,##0.00';
// Template cells share style objects: never mutate cell.numFmt/font/alignment directly (it leaks to other cells).
const restyle = (cell: ExcelJS.Cell, patch: Partial<ExcelJS.Style>) => { cell.style = { ...cell.style, ...patch }; };
const r2 = (x: number) => Math.round(x * 100) / 100;
const ethText = (d: Date) => { const e = toEthiopian(d); return `${e.day}/${e.month}/${e.year}`; };
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

function periodLabel(from: string, to: string) {
  const a = toEthiopian(utc(from)), b = toEthiopian(utc(to));
  if (a.year === b.year && a.month === b.month && a.day === 1 && b.day === daysInEthMonth(b.year, b.month))
    return `ወር፡ ${ETH_MONTHS_AM[a.month - 1]} / ${a.year} ዓ.ም`;
  if (a.year === b.year && a.month === 1 && a.day === 1 && b.month === 13 && b.day === daysInEthMonth(b.year, 13))
    return `ሙሉ ዓመት፡ ${a.year} ዓ.ም`;
  return `ከ ${ethText(utc(from))} እስከ ${ethText(utc(to))}`;
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService, private visits: VisitsService) {}

  async build(q: ExportQueryDto) {
    const [{ items }, facility] = await Promise.all([
      this.visits.list(q),
      this.prisma.facility.findUniqueOrThrow({ where: { id: q.facilityId } }),
    ]);
    const ethiopian = (q.calendar ?? 'ethiopian') === 'ethiopian';

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE);
    [2, 1].forEach((i) => wb.removeWorksheet(wb.worksheets[i].id)); // template has 2 spare sheets
    const ws = wb.worksheets[0];
    ws.name = 'Register';

    // header: facility + period
    const fit = (addr: string, text: string) => {
      const c = ws.getCell(addr); c.value = text; restyle(c, { alignment: { ...c.alignment, shrinkToFit: true } });
    };
    fit('E2', `የተቋሙ ስም፡ ${facility.name}`);
    fit('L2', periodLabel(q.from, q.to));
    const active = [
      q.woreda && `Woreda: ${q.woreda}`, q.sex && `Sex: ${q.sex}`, q.serviceType && `Service: ${q.serviceType}`,
      q.membershipStatus && `Membership: ${q.membershipStatus === 'MEMBER' ? 'Member' : 'Beneficiary'}`,
      (q.minAge != null || q.maxAge != null) && `Age: ${q.minAge ?? 0}–${q.maxAge ?? '∞'}`, q.q && `Search: "${q.q}"`,
    ].filter(Boolean);
    if (active.length) { const c = ws.getCell('A3'); c.value = `Filtered — ${active.join(' · ')}`; restyle(c, { font: { italic: true, size: 9 } }); }

    // make the number of blank lines match the data
    const n = items.length;
    if (n > TEMPLATE_ROWS) for (let i = 0; i < n - TEMPLATE_ROWS; i++) ws.insertRow(TEMPLATE_TOTAL_ROW + i, [], 'i');
    // exceljs' spliceRows(start, count) leaves the extra rows behind, so remove the unused blank lines one by one
    else for (let i = 0; i < TEMPLATE_ROWS - n; i++) ws.spliceRows(FIRST_ROW + n, 1);
    const last = FIRST_ROW + n - 1, totalRow = FIRST_ROW + n;

    const sums = new Array(8).fill(0);
    items.forEach((v, i) => {
      const r = FIRST_ROW + i, row = ws.getRow(r);
      const costs = COST_KEYS.map((k) => Number(v[k]));
      const total = Number(v.totalCost);
      costs.forEach((c, j) => (sums[j] += c)); sums[7] += total;
      const values: (string | number | Date | null | { formula: string; result: number })[] = [
        i + 1,
        ethiopian ? ethText(v.visitDate) : v.visitDate,
        v.patient.name, v.patient.sex, v.ageAtVisit, v.patient.woreda, v.patient.employer,
        v.patient.membershipStatus === 'MEMBER' ? 'አባል' : 'ተጠቃሚ',
        v.patient.shiId, v.patient.phone, v.medicalRecordId, v.serviceType, v.diagnosis,
        v.labServices, v.imagingServices, v.procedures, v.medicines,
        ...costs, { formula: `SUM(R${r}:X${r})`, result: r2(total) },
      ];
      values.forEach((val, c) => { row.getCell(c + 1).value = val; });
      if (!ethiopian) restyle(row.getCell(2), { numFmt: 'dd/mm/yyyy' });
      // keep long text on one line (shrink to fit) so the form's column widths and logo stay as designed
      for (let c = 3; c <= 17; c++) { const cell = row.getCell(c); restyle(cell, { alignment: { ...cell.alignment, shrinkToFit: true, wrapText: false } }); }
      for (let c = 18; c <= 25; c++) restyle(row.getCell(c), { numFmt: MONEY });
    });

    // TOTAL row (the template already labels column C)
    const tr = ws.getRow(totalRow);
    [...COLS, 'Y'].forEach((col, j) => {
      const cell = tr.getCell(col);
      cell.value = n ? { formula: `SUM(${col}${FIRST_ROW}:${col}${last})`, result: r2(sums[j]) } : 0;
      restyle(cell, { numFmt: MONEY, font: { ...cell.font, bold: true } });
    });


    // print setup: A4 landscape, one page wide, header rows repeat on every page
    ws.pageSetup = { ...ws.pageSetup, orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:8' };

    if (n) this.addSummary(wb, items, last);

    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), filename: `SHI_Register_${q.from}_to_${q.to}.xlsx` };
  }

  /** Summary sheet; counts and sums are live formulas over the Register sheet. */
  private addSummary(wb: ExcelJS.Workbook, items: Awaited<ReturnType<VisitsService['list']>>['items'], last: number) {
    const s = wb.addWorksheet('Summary');
    s.columns = [{ width: 32 }, { width: 12 }, { width: 18 }];
    const rng = (col: string) => `Register!$${col}$${FIRST_ROW}:$${col}$${last}`;
    const font = { name: 'Arial', size: 10 };
    let r = 1;

    const table = (title: string, header: string, keyCol: string, keys: { label: string; match: string; count: number; total: number }[], blank?: { count: number; total: number }) => {
      s.getCell(r, 1).value = title; s.getCell(r, 1).font = { ...font, bold: true, size: 11 }; r++;
      ['', 'Visits', 'Total cost (ETB)'].forEach((h, i) => {
        const c = s.getCell(r, i + 1); c.value = h || header; c.font = { ...font, bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      });
      r++;
      const start = r;
      const line = (label: string, cnt: ExcelJS.CellValue, tot: ExcelJS.CellValue) => {
        s.getCell(r, 1).value = label; s.getCell(r, 2).value = cnt; s.getCell(r, 3).value = tot; s.getCell(r, 3).numFmt = MONEY;
        [1, 2, 3].forEach((c) => (s.getCell(r, c).font = font)); r++;
      };
      keys.forEach((k) => line(k.label,
        { formula: `COUNTIF(${rng(keyCol)},"${k.match}")`, result: k.count },
        { formula: `SUMIF(${rng(keyCol)},"${k.match}",${rng('Y')})`, result: r2(k.total) }));
      if (blank?.count) line('(not specified)',
        { formula: `COUNTBLANK(${rng(keyCol)})`, result: blank.count },
        { formula: `SUMIF(${rng(keyCol)},"",${rng('Y')})`, result: r2(blank.total) });
      const end = r - 1;
      s.getCell(r, 1).value = 'Total';
      s.getCell(r, 2).value = { formula: `SUM(B${start}:B${end})`, result: keys.reduce((a, k) => a + k.count, 0) + (blank?.count ?? 0) };
      s.getCell(r, 3).value = { formula: `SUM(C${start}:C${end})`, result: r2(keys.reduce((a, k) => a + k.total, 0) + (blank?.total ?? 0)) };
      s.getCell(r, 3).numFmt = MONEY;
      [1, 2, 3].forEach((c) => (s.getCell(r, c).font = { ...font, bold: true }));
      r += 2;
    };

    const group = (pick: (v: (typeof items)[number]) => string | null) => {
      const m = new Map<string, { count: number; total: number }>();
      for (const v of items) { const k = pick(v) ?? ''; const g = m.get(k) ?? { count: 0, total: 0 }; g.count++; g.total += Number(v.totalCost); m.set(k, g); }
      return m;
    };
    const toKeys = (m: Map<string, { count: number; total: number }>) =>
      [...m.entries()].filter(([k]) => k).sort(([a], [b]) => a.localeCompare(b)).map(([k, g]) => ({ label: k, match: k.replace(/"/g, '""'), ...g }));

    const byWoreda = group((v) => v.patient.woreda);
    table('Visits by woreda', 'Woreda', 'F', toKeys(byWoreda), byWoreda.get(''));
    table('Visits by service type', 'Service type', 'L', toKeys(group((v) => v.serviceType)));
    table('Visits by sex', 'Sex', 'D', toKeys(group((v) => v.patient.sex)));
  }
}
