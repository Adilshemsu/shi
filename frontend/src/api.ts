const BASE = import.meta.env.VITE_API_URL ?? '/api';

export type Sex = 'M' | 'F';
export type Membership = 'MEMBER' | 'BENEFICIARY';
export type ServiceType = 'OPD' | 'IPD' | 'EM';

export interface Patient {
  id: number; shiId: string; name: string; sex: Sex; phone: string | null; woreda: string | null;
  employer: string | null; membershipStatus: Membership;
}
export const COST_KEYS = ['costConsultation', 'costLaboratory', 'costImaging', 'costSurgical', 'costMedicine', 'costFoodBed', 'costOthers'] as const;
export type CostKey = (typeof COST_KEYS)[number];

// Decimals come over the wire as strings.
export type Visit = {
  id: number; facilityId: number; visitDate: string; ageAtVisit: number; medicalRecordId: string | null;
  serviceType: ServiceType; diagnosis: string | null; labServices: string | null; imagingServices: string | null;
  procedures: string | null; medicines: string | null; totalCost: string; patient: Patient;
} & Record<CostKey, string>;

export interface Summary {
  visits: number; patients: number; byService: Partial<Record<ServiceType, number>>;
  totals: Record<CostKey | 'totalCost', string | null>;
}
export interface Facility { id: number; name: string }
export type VisitInput = Omit<Visit, 'id' | 'patient' | 'totalCost' | CostKey> & Partial<Record<CostKey, number>> &
  Omit<Patient, 'id'>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { headers: { 'content-type': 'application/json' }, ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(Array.isArray(body?.message) ? body.message.join('\n') : body?.message ?? res.statusText);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const qs = (o: object) =>
  new URLSearchParams(Object.entries(o as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

export interface Filters {
  q?: string; woreda?: string; sex?: Sex; serviceType?: ServiceType; membershipStatus?: Membership; minAge?: number; maxAge?: number;
}
export type ListParams = { facilityId: number; from: string; to: string } & Filters;

export const api = {
  woredas: () => call<string[]>('/meta/woredas'),
  exportXlsx: async (p: ListParams & { calendar: 'ethiopian' | 'gregorian' }) => {
    const res = await fetch(`${BASE}/visits/export?${qs(p)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(Array.isArray(body?.message) ? body.message.join('\n') : body?.message ?? res.statusText);
    }
    const filename = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'SHI_Register.xlsx';
    return { blob: await res.blob(), filename };
  },
  facilities: () => call<Facility[]>('/facilities'),
  renameFacility: (id: number, name: string) => call<Facility>(`/facilities/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  visits: (p: ListParams) => call<{ items: Visit[]; count: number }>(`/visits?${qs(p)}`),
  summary: (p: ListParams) => call<Summary>(`/visits/summary?${qs(p)}`),
  createVisit: (b: unknown) => call<Visit>('/visits', { method: 'POST', body: JSON.stringify(b) }),
  updateVisit: (id: number, b: unknown) => call<Visit>(`/visits/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteVisit: (id: number) => call<{ deleted: true }>(`/visits/${id}`, { method: 'DELETE' }),
  lookupPatient: (shiId: string) => call<Patient | null>(`/patients/lookup?${qs({ shiId })}`),
};
