import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, COST_KEYS, type CostKey, type Visit } from '../api';
import { ethLabel, money } from '../lib/format';

const COST_LABELS: Record<CostKey, [string, string]> = {
  costConsultation: ['Consultation / card', 'ካርድ ወይም ምርመራ'],
  costLaboratory: ['Laboratory', 'ላቦራቶሪ'],
  costImaging: ['Imaging', 'ኢሜጂንግ'],
  costSurgical: ['Surgical procedure', 'የቀዶ ጥገና አገልግሎት'],
  costMedicine: ['Medicine', 'መድኃኒት'],
  costFoodBed: ['Food / Bed', 'ምግበና መኝታ'],
  costOthers: ['Others', 'ሌሎች'],
};

interface Props { woredas: string[]; facilityId: number; visit?: Visit; defaultDate: string; onClose: () => void; onSaved: () => void }

export default function VisitForm({ woredas, facilityId, visit, defaultDate, onClose, onSaved }: Props) {
  const p = visit?.patient;
  const [f, setF] = useState({
    visitDate: visit?.visitDate.slice(0, 10) ?? defaultDate,
    shiId: p?.shiId ?? '', name: p?.name ?? '', sex: p?.sex ?? 'M', ageAtVisit: visit ? String(visit.ageAtVisit) : '',
    membershipStatus: p?.membershipStatus ?? 'MEMBER', woreda: p?.woreda && woredas.includes(p.woreda) ? p.woreda : p?.woreda ? OTHER : '', employer: p?.employer ?? '', phone: p?.phone ?? '',
    medicalRecordId: visit?.medicalRecordId ?? '', serviceType: visit?.serviceType ?? 'OPD', diagnosis: visit?.diagnosis ?? '',
    labServices: visit?.labServices ?? '', imagingServices: visit?.imagingServices ?? '', procedures: visit?.procedures ?? '', medicines: visit?.medicines ?? '',
    ...Object.fromEntries(COST_KEYS.map((k) => [k, visit && Number(visit[k]) ? String(Number(visit[k])) : ''])) as Record<CostKey, string>,
  });
  const [otherWoreda, setOtherWoreda] = useState(p?.woreda && !woredas.includes(p.woreda) ? p.woreda : '');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [autofilled, setAutofilled] = useState(false);

  const total = COST_KEYS.reduce((s, k) => s + Math.round((Number(f[k]) || 0) * 100), 0) / 100;

  // Typing a known SHI/NID ID fills in the patient's details (only if the name is still empty).
  const lookup = async () => {
    if (visit || f.name || !f.shiId.trim()) return;
    const found = await api.lookupPatient(f.shiId).catch(() => null);
    if (found) {
      setF((s) => ({ ...s, name: found.name, sex: found.sex, membershipStatus: found.membershipStatus, woreda: !found.woreda ? '' : woredas.includes(found.woreda) ? found.woreda : OTHER, employer: found.employer ?? '', phone: found.phone ?? '' }));
      if (found.woreda && !woredas.includes(found.woreda)) setOtherWoreda(found.woreda);
      setAutofilled(true);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        facilityId, visitDate: f.visitDate, shiId: f.shiId.trim(), name: f.name.trim(), sex: f.sex, membershipStatus: f.membershipStatus,
        ageAtVisit: Number(f.ageAtVisit), woreda: f.woreda === OTHER ? otherWoreda.trim() : f.woreda, employer: f.employer, phone: f.phone,
        medicalRecordId: f.medicalRecordId, serviceType: f.serviceType, diagnosis: f.diagnosis,
        labServices: f.labServices, imagingServices: f.imagingServices, procedures: f.procedures, medicines: f.medicines,
        ...Object.fromEntries(COST_KEYS.map((k) => [k, Number(f[k]) || 0])),
      };
      return visit ? api.updateVisit(visit.id, body) : api.createVisit(body);
    },
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="my-6 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{visit ? 'Edit visit' : 'New visit'} <span className="font-normal text-slate-500">· {visit ? 'ጉብኝት አስተካክል' : 'አዲስ ጉብኝት'}</span></h2>

        <Section title="Visit · ጉብኝት">
          <Field label="Date of visit" am="የታከመበት ቀን" hint={ethLabel(f.visitDate)}><input required type="date" value={f.visitDate} onChange={set('visitDate')} className={inp} /></Field>
          <Field label="Service type" am="OPD/IPD/EM"><Sel value={f.serviceType} onChange={set('serviceType')} options={[['OPD', 'OPD'], ['IPD', 'IPD'], ['EM', 'EM (Emergency)']]} /></Field>
          <Field label="Medical record ID" am="የህክምና መለያ ቁጥር"><input value={f.medicalRecordId} onChange={set('medicalRecordId')} className={inp} /></Field>
        </Section>

        <Section title="Patient · ታካሚ">
          <Field label="NID / SHI ID / Pension ID" am="መታወቂያ ቁጥር" hint={autofilled ? 'Existing patient — details filled in' : undefined}><input required value={f.shiId} onChange={set('shiId')} onBlur={lookup} className={inp} /></Field>
          <Field label="Name of patient" am="የታካሚው ስም" wide><input required value={f.name} onChange={set('name')} className={inp} /></Field>
          <Field label="Sex" am="ፆታ"><Sel value={f.sex} onChange={set('sex')} options={[['M', 'M · ወንድ'], ['F', 'F · ሴት']]} /></Field>
          <Field label="Age" am="እድሜ" hint="Infants under 1 year: 0"><input required type="number" min={0} max={120} value={f.ageAtVisit} onChange={set('ageAtVisit')} className={inp} /></Field>
          <Field label="Membership" am="የአባልነት ሁኔታ"><Sel value={f.membershipStatus} onChange={set('membershipStatus')} options={[['MEMBER', 'Member · አባል'], ['BENEFICIARY', 'Beneficiary · ተጠቃሚ']]} /></Field>
          <Field label="Woreda" am="ወረዳ">
            <select value={f.woreda} onChange={set('woreda')} className={inp}>
              <option value="">— select woreda —</option>
              {woredas.map((w) => <option key={w} value={w}>{w}</option>)}
              <option value={OTHER}>Other (type it)…</option>
            </select>
            {f.woreda === OTHER && <input required autoFocus value={otherWoreda} onChange={(e) => setOtherWoreda(e.target.value)} placeholder="Woreda name" className={`${inp} mt-1`} />}
          </Field>
          <Field label="Employer" am="የሚሰራበት ተቋም"><input value={f.employer} onChange={set('employer')} className={inp} /></Field>
          <Field label="Phone" am="ስልክ ቁጥር"><input value={f.phone} onChange={set('phone')} className={inp} /></Field>
        </Section>

        <Section title="Services provided · የተሰጠ አገልግሎት">
          <Field label="Diagnosis" wide><input value={f.diagnosis} onChange={set('diagnosis')} className={inp} /></Field>
          <Field label="Lab"><input value={f.labServices} onChange={set('labServices')} className={inp} /></Field>
          <Field label="Imaging"><input value={f.imagingServices} onChange={set('imagingServices')} className={inp} /></Field>
          <Field label="Procedure"><input value={f.procedures} onChange={set('procedures')} className={inp} /></Field>
          <Field label="Medicine"><input value={f.medicines} onChange={set('medicines')} className={inp} /></Field>
        </Section>

        <Section title="Cost by type (ETB) · የህክምና አገልግሎት ወጪ">
          {COST_KEYS.map((k) => (
            <Field key={k} label={COST_LABELS[k][0]} am={COST_LABELS[k][1]}>
              <input type="number" min={0} step="0.01" inputMode="decimal" value={f[k]} onChange={set(k)} placeholder="0.00" className={`${inp} text-right`} />
            </Field>
          ))}
          <div className="flex items-end justify-between rounded-md bg-slate-100 px-3 py-2">
            <span className="text-xs text-slate-600">Total · ጠቅላላ ድምር</span>
            <b className="text-lg tabular-nums">{money(total)}</b>
          </div>
        </Section>

        {save.error && <p className="mt-4 whitespace-pre-line rounded bg-red-50 p-3 text-sm text-red-700">{save.error.message}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">Cancel</button>
          <button disabled={save.isPending} className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

const OTHER = '__other__';
const inp = 'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="mt-5"><legend className="mb-2 text-sm font-semibold text-slate-700">{title}</legend><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{children}</div></fieldset>
);
const Field = ({ label, am, hint, wide, children }: { label: string; am?: string; hint?: string; wide?: boolean; children: React.ReactNode }) => (
  <label className={`block ${wide ? 'col-span-2' : ''}`}>
    <span className="mb-1 block text-xs text-slate-600">{label}{am && <span className="text-slate-400"> · {am}</span>}</span>
    {children}
    {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
  </label>
);
const Sel = ({ value, onChange, options }: { value: string; onChange: React.ChangeEventHandler<HTMLSelectElement>; options: [string, string][] }) => (
  <select value={value} onChange={onChange} className={inp}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
);
