/**
 * Import visits from a filled-in SHI register spreadsheet (same layout as SHI_Register.xlsx:
 * data starts on row 9, columns A–Y, stops at the "TOTAL" row).
 *
 *   npm run import -- ./march.xlsx --facility 1 --ethiopian --dry-run
 *
 *   --sheet <name>   sheet to read (default: first sheet)
 *   --facility <id>  facility id (default: first facility)
 *   --ethiopian      text dates like 12/02/2018 are Ethiopian calendar (d/m/y)
 *   --dry-run        parse and report, write nothing
 */
import 'dotenv/config';
import 'reflect-metadata';
import ExcelJS from 'exceljs';
import { PrismaService } from '../src/prisma.service';
import { VisitsService } from '../src/visits/visits.service';
import { MembershipStatus, ServiceType, Sex, VisitDto } from '../src/visits/visit.dto';
import { fromEthiopian } from '../src/common/ethiopic';
import { canonicalWoreda } from '../src/common/woredas';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && /\.xlsx?$/i.test(a));
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n: string) => args.includes(`--${n}`);
if (!file) { console.error('Usage: npm run import -- <file.xlsx> [--sheet name] [--facility id] [--ethiopian] [--dry-run]'); process.exit(1); }

const raw = (c: ExcelJS.Cell): unknown => {
  const v = c.value as any;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;                      // formula cell
    if ('richText' in v) return v.richText.map((r: any) => r.text).join('');
    if ('text' in v) return v.text;
  }
  return v;
};
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

function parseDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  const m = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/);
  if (!m) return null;
  let [a, b, c] = [+m[1], +m[2], +m[3]];
  let y: number, mo: number, d: number;
  if (a > 31) { y = a; mo = b; d = c; } else { d = a; mo = b; y = c < 100 ? 2000 + c : c; }
  if (flag('ethiopian')) { if (mo < 1 || mo > 13) return null; return fromEthiopian(y, mo, d).toISOString().slice(0, 10); }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const parseAge = (v: unknown) => {
  const s = str(v).toLowerCase();
  if (/month|day|ወር|ቀን/.test(s)) return 0; // infants recorded as "8 months"
  const n = parseInt(s, 10); return Number.isFinite(n) ? n : null;
};
const parseSex = (v: unknown): Sex | null => {
  const s = str(v).toLowerCase();
  if (['m', 'male', 'ወ', 'ወንድ'].includes(s)) return Sex.M;
  if (['f', 'female', 'ሴ', 'ሴት'].includes(s)) return Sex.F;
  return null;
};
const parseMember = (v: unknown): MembershipStatus => (/ተጠቃሚ|benef/i.test(str(v)) ? MembershipStatus.BENEFICIARY : MembershipStatus.MEMBER);
const parseService = (v: unknown): ServiceType | null => {
  const s = str(v).toUpperCase().replace(/[^A-Z]/g, '');
  return s === 'OPD' || s === 'IPD' || s === 'EM' ? (s as ServiceType) : s === 'ER' || s === 'EMERGENCY' ? ServiceType.EM : null;
};

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = opt('sheet') ? wb.getWorksheet(opt('sheet')!) : wb.worksheets[0];
  if (!ws) throw new Error('Sheet not found');

  const prisma = new PrismaService();
  const svc = new VisitsService(prisma);
  const facilityId = opt('facility') ? +opt('facility')! : (await prisma.facility.findFirstOrThrow({ orderBy: { id: 'asc' } })).id;

  let ok = 0; const problems: string[] = []; const unknownWoredas = new Set<string>();
  for (let r = 9; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const g = (col: number) => raw(row.getCell(col));
    if (str(g(3)).toUpperCase() === 'TOTAL') break;
    if (!str(g(3)) && !str(g(9))) continue; // empty row

    const date = parseDate(g(2)), age = parseAge(g(5)), sex = parseSex(g(4)), service = parseService(g(12));
    const why = [!date && 'date', age == null && 'age', !sex && 'sex', !service && 'service type', !str(g(9)) && 'SHI/NID ID', !str(g(3)) && 'name'].filter(Boolean);
    if (why.length) { problems.push(`row ${r}: bad/missing ${why.join(', ')}`); continue; }

    const rawWoreda = str(g(6)), woreda = canonicalWoreda(rawWoreda) ?? rawWoreda;
    if (rawWoreda && !canonicalWoreda(rawWoreda)) unknownWoredas.add(rawWoreda);
    const dto: VisitDto = {
      facilityId, visitDate: date!, ageAtVisit: age!, shiId: str(g(9)), name: str(g(3)), sex: sex!,
      membershipStatus: parseMember(g(8)), phone: str(g(10)) || undefined, woreda: woreda || undefined, employer: str(g(7)) || undefined,
      medicalRecordId: str(g(11)) || undefined, serviceType: service!, diagnosis: str(g(13)) || undefined,
      labServices: str(g(14)) || undefined, imagingServices: str(g(15)) || undefined, procedures: str(g(16)) || undefined, medicines: str(g(17)) || undefined,
      costConsultation: num(g(18)), costLaboratory: num(g(19)), costImaging: num(g(20)), costSurgical: num(g(21)),
      costMedicine: num(g(22)), costFoodBed: num(g(23)), costOthers: num(g(24)),
    };
    if (!flag('dry-run')) await svc.create(dto);
    ok++;
  }
  console.log(`${flag('dry-run') ? '[dry run] would import' : 'Imported'} ${ok} visits into facility ${facilityId}.`);
  if (problems.length) console.log(`Skipped ${problems.length} rows:\n  ` + problems.join('\n  '));
  if (unknownWoredas.size) console.log(`Woredas not in the Afar list (imported as typed): ${[...unknownWoredas].join(', ')}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
