import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, COST_KEYS, type Filters, type ListParams, type Visit } from './api';
import { ETH_MONTHS_AM, daysInEthMonth, fromEthiopian, toEthiopian } from './lib/ethiopic';
import { ethLabel, isoDate, money, todayIso } from './lib/format';
import VisitForm from './components/VisitForm';

const useDebounced = <T,>(v: T, ms = 300) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

export default function App() {
  const qc = useQueryClient();
  const today = toEthiopian(new Date(`${todayIso()}T00:00:00Z`));
  const [period, setPeriod] = useState({ y: today.year, m: today.month }); // Ethiopian year / month
  // filter inputs are strings ('' = no filter); they are converted to API params by toFilters()
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const dFilters = useDebounced(filters);
  const [range, setRange] = useState({ from: todayIso(), to: todayIso() }); // used when period is "Custom dates"
  const [calendar, setCalendar] = useState<'ethiopian' | 'gregorian'>('ethiopian');
  const setF = (k: keyof FilterState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const activeCount = Object.values(filters).filter((v) => v !== '').length;
  const [editing, setEditing] = useState<Visit | 'new' | null>(null);

  const facilities = useQuery({ queryKey: ['facilities'], queryFn: api.facilities });
  const facility = facilities.data?.[0];
  const woredas = useQuery({ queryKey: ['woredas'], queryFn: api.woredas, staleTime: Infinity });

  // month 0 = the whole Ethiopian year (Meskerem 1 – last day of Pagume)
  const custom = period.m === -1; // -1 = custom date range
  const from = custom ? range.from : isoDate(fromEthiopian(period.y, period.m || 1, 1));
  const to = custom ? range.to : isoDate(fromEthiopian(period.y, period.m || 13, daysInEthMonth(period.y, period.m || 13)));
  const params: ListParams | null = facility && from && to && from <= to ? { facilityId: facility.id, from, to, ...toFilters(dFilters) } : null;

  const visits = useQuery({ queryKey: ['visits', params], queryFn: () => api.visits(params!), enabled: !!params });
  const summary = useQuery({ queryKey: ['summary', params], queryFn: () => api.summary(params!), enabled: !!params });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['visits'] }); qc.invalidateQueries({ queryKey: ['summary'] }); };
  const del = useMutation({ mutationFn: api.deleteVisit, onSuccess: refresh });
  const rename = useMutation({ mutationFn: (name: string) => api.renameFacility(facility!.id, name), onSuccess: () => qc.invalidateQueries({ queryKey: ['facilities'] }) });

  const exp = useMutation({
    mutationFn: () => api.exportXlsx({ facilityId: facility!.id, from, to, ...toFilters(filters), calendar }),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    },
  });

  const step = (delta: number) => setPeriod(({ y, m }) => {
    if (m === -1) return { y, m };
    if (m === 0) return { y: y + delta, m };
    let nm = m + delta, ny = y;
    if (nm > 13) { nm = 1; ny++; } else if (nm < 1) { nm = 13; ny--; }
    return { y: ny, m: nm };
  });
  const years = useMemo(() => Array.from({ length: 9 }, (_, i) => today.year - 7 + i), [today.year]);
  const defaultDate = todayIso() >= from && todayIso() <= to ? todayIso() : from;
  const t = summary.data?.totals;

  return (
    <div className="mx-auto max-w-[1600px] p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">SHI Patient Register <span className="text-slate-500 font-normal">· የማህበራዊ ጤና መድን የታካሚ መመዝገቢያ</span></h1>
          <p className="text-sm text-slate-600">
            የተቋሙ ስም: <b>{facility?.name ?? '…'}</b>{' '}
            {facility && <button className="text-blue-600 hover:underline" onClick={() => { const n = prompt('Facility name', facility.name)?.trim(); if (n && n !== facility.name) rename.mutate(n); }}>edit</button>}
          </p>
        </div>
        <button disabled={!facility} onClick={() => setEditing('new')} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50">+ New visit</button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <button onClick={() => step(-1)} disabled={custom} className="rounded border px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-30" aria-label="Previous month">‹</button>
        <select value={period.m} onChange={(e) => setPeriod({ ...period, m: +e.target.value })} className="rounded border px-2 py-1.5">
          <option value={0}>ሙሉ ዓመት · Whole year</option>
          <option value={-1}>Custom dates · የተወሰነ ጊዜ</option>
          {ETH_MONTHS_AM.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
        {custom ? (
          <div className="flex items-center gap-1">
            <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="rounded border px-2 py-1.5" />
            <span className="text-slate-400">–</span>
            <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="rounded border px-2 py-1.5" />
          </div>
        ) : (
          <select value={period.y} onChange={(e) => setPeriod({ ...period, y: +e.target.value })} className="rounded border px-2 py-1.5">
            {years.map((y) => <option key={y} value={y}>{y} ዓ.ም</option>)}
          </select>
        )}
        <button onClick={() => step(1)} disabled={custom} className="rounded border px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-30" aria-label="Next month">›</button>
        <span className="text-xs text-slate-500">{custom && from && to ? `${ethLabel(from)} → ${ethLabel(to)}` : `${from} → ${to}`}</span>
        {custom && from > to && <span className="text-xs text-red-600">“From” is after “to”</span>}
        <input value={filters.q} onChange={setF('q')} placeholder="Search name, SHI ID, MRN, diagnosis…" className="ml-auto w-full rounded border px-3 py-1.5 text-sm md:w-80" />
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <Pick label="Woreda · ወረዳ" value={filters.woreda} onChange={setF('woreda')} options={[['', 'All woredas'], ...(woredas.data ?? []).map((w): [string, string] => [w, w])]} />
        <Pick label="Sex · ፆታ" value={filters.sex} onChange={setF('sex')} options={[['', 'All'], ['M', 'Male · ወንድ'], ['F', 'Female · ሴት']]} />
        <Pick label="Service · አገልግሎት" value={filters.serviceType} onChange={setF('serviceType')} options={[['', 'All'], ['OPD', 'OPD'], ['IPD', 'IPD'], ['EM', 'EM']]} />
        <Pick label="Membership · አባልነት" value={filters.membershipStatus} onChange={setF('membershipStatus')} options={[['', 'All'], ['MEMBER', 'Member · አባል'], ['BENEFICIARY', 'Beneficiary · ተጠቃሚ']]} />
        <label className="block"><span className="mb-1 block text-xs text-slate-500">Age · እድሜ</span>
          <span className="flex items-center gap-1">
            <input type="number" min={0} max={120} placeholder="from" value={filters.minAge} onChange={setF('minAge')} className="w-16 rounded border px-2 py-1.5" />
            <span className="text-slate-400">–</span>
            <input type="number" min={0} max={120} placeholder="to" value={filters.maxAge} onChange={setF('maxAge')} className="w-16 rounded border px-2 py-1.5" />
          </span>
        </label>
        {activeCount > 0 && <button onClick={() => setFilters(NO_FILTERS)} className="rounded border px-3 py-1.5 text-slate-600 hover:bg-slate-50">Clear filters ({activeCount})</button>}
        <div className="ml-auto flex items-end gap-2">
          <Pick label="Dates in file" value={calendar} onChange={(e) => setCalendar(e.target.value as 'ethiopian' | 'gregorian')} options={[['ethiopian', 'Ethiopian · ዓ.ም'], ['gregorian', 'Gregorian']]} />
          <button disabled={!facility || exp.isPending} onClick={() => exp.mutate()} className="rounded-md bg-emerald-600 px-4 py-1.5 font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
            {exp.isPending ? 'Preparing…' : '⬇ Export Excel'}
          </button>
        </div>
      </div>
      {exp.error && <p className="mt-2 rounded bg-red-50 p-3 text-sm text-red-700">Export failed: {exp.error.message}</p>}

      <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Visits · ጉብኝት" value={summary.data?.visits ?? '–'} />
        <Stat label="Patients · ታካሚዎች" value={summary.data?.patients ?? '–'} />
        <Stat label="OPD / IPD / EM" value={summary.data ? `${summary.data.byService.OPD ?? 0} / ${summary.data.byService.IPD ?? 0} / ${summary.data.byService.EM ?? 0}` : '–'} />
        <Stat label="Total cost · ጠቅላላ ድምር (ETB)" value={t ? money(t.totalCost) : '–'} />
      </section>

      {(visits.error || summary.error) && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">Could not load data: {(visits.error ?? summary.error)?.message}. Is the API running?</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1400px] text-[13px]">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              {['ተ.ቁ\nS.No', 'ቀን\nDate', 'የታካሚው ስም\nPatient', 'ፆታ\nSex', 'እድሜ\nAge', 'ወረዳ\nWoreda', 'የሚሰራበት ተቋም\nEmployer', 'አባልነት\nStatus', 'NID/SHI ID', 'ስልክ\nPhone', 'MRN', 'Service', 'Diagnosis'].map((h) => <Th key={h}>{h}</Th>)}
              {['ካርድ/ምርመራ\nConsult.', 'ላቦራቶሪ\nLab', 'ኢሜጂንግ\nImaging', 'ቀዶ ጥገና\nSurgery', 'መድኃኒት\nMedicine', 'ምግብና መኝታ\nFood/Bed', 'ሌሎች\nOthers', 'ጠቅላላ ድምር\nTotal'].map((h) => <Th key={h} right>{h}</Th>)}
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visits.data?.items.map((v, i) => (
              <tr key={v.id} className="hover:bg-slate-50">
                <Td>{i + 1}</Td>
                <Td nowrap><div>{v.visitDate.slice(0, 10)}</div><div className="text-xs text-slate-500">{ethLabel(v.visitDate)}</div></Td>
                <Td><span className="font-medium">{v.patient.name}</span></Td>
                <Td>{v.patient.sex}</Td>
                <Td>{v.ageAtVisit}</Td>
                <Td>{v.patient.woreda}</Td>
                <Td>{v.patient.employer}</Td>
                <Td>{v.patient.membershipStatus === 'MEMBER' ? 'አባል' : 'ተጠቃሚ'}</Td>
                <Td nowrap>{v.patient.shiId}</Td>
                <Td nowrap>{v.patient.phone}</Td>
                <Td nowrap>{v.medicalRecordId}</Td>
                <Td>{v.serviceType}</Td>
                <Td>{v.diagnosis}</Td>
                {COST_KEYS.map((k) => <Td key={k} right>{Number(v[k]) ? money(v[k]) : <span className="text-slate-300">–</span>}</Td>)}
                <Td right><b>{money(v.totalCost)}</b></Td>
                <Td nowrap>
                  <button className="mr-2 text-blue-600 hover:underline" onClick={() => setEditing(v)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => confirm(`Delete visit for ${v.patient.name} on ${v.visitDate.slice(0, 10)}?`) && del.mutate(v.id)}>Delete</button>
                </Td>
              </tr>
            ))}
            {visits.data?.items.length === 0 && <tr><td colSpan={22} className="p-8 text-center text-slate-500">No visits recorded for this period.</td></tr>}
          </tbody>
          {t && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
              <tr>
                <td colSpan={13} className="px-3 py-2 text-right">TOTAL · ጠቅላላ{activeCount > 0 && <span className="ml-1 font-normal text-slate-500">(filtered)</span>}</td>
                {COST_KEYS.map((k) => <td key={k} className="px-2.5 py-2 text-right tabular-nums">{money(t[k])}</td>)}
                <td className="px-2.5 py-2 text-right tabular-nums">{money(t.totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editing && facility && (
        <VisitForm woredas={woredas.data ?? []} facilityId={facility.id} visit={editing === 'new' ? undefined : editing} defaultDate={defaultDate} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

interface FilterState { q: string; woreda: string; sex: string; serviceType: string; membershipStatus: string; minAge: string; maxAge: string }
const NO_FILTERS: FilterState = { q: '', woreda: '', sex: '', serviceType: '', membershipStatus: '', minAge: '', maxAge: '' };
function toFilters(f: FilterState): Filters {
  return {
    q: f.q.trim() || undefined, woreda: f.woreda || undefined, sex: (f.sex || undefined) as Filters['sex'],
    serviceType: (f.serviceType || undefined) as Filters['serviceType'], membershipStatus: (f.membershipStatus || undefined) as Filters['membershipStatus'],
    minAge: f.minAge === '' ? undefined : Number(f.minAge), maxAge: f.maxAge === '' ? undefined : Number(f.maxAge),
  };
}
const Pick = ({ label, value, onChange, options }: { label: string; value: string; onChange: React.ChangeEventHandler<HTMLSelectElement>; options: [string, string][] }) => (
  <label className="block"><span className="mb-1 block text-xs text-slate-500">{label}</span>
    <select value={value} onChange={onChange} className="rounded border px-2 py-1.5">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  </label>
);
const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
  </div>
);
const Th = ({ children, right }: { children: string; right?: boolean }) => (
  <th className={`whitespace-pre-line px-2.5 py-2 font-medium ${right ? 'text-right' : ''}`}>{children}</th>
);
const Td = ({ children, right, nowrap }: { children?: React.ReactNode; right?: boolean; nowrap?: boolean }) => (
  <td className={`px-2.5 py-2 align-top ${right ? 'text-right tabular-nums' : ''} ${nowrap ? 'whitespace-nowrap' : ''}`}>{children}</td>
);
