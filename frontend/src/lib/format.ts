import { ETH_MONTHS_AM, toEthiopian } from './ethiopic';

export const money = (v: string | number | null | undefined) =>
  Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const utcDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "14 ጥቅምት 2019" for a YYYY-MM-DD (Gregorian) string. */
export function ethLabel(iso: string) {
  if (!iso) return '';
  const e = toEthiopian(utcDate(iso));
  return `${e.day} ${ETH_MONTHS_AM[e.month - 1]} ${e.year}`;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const todayIso = () => {
  const n = new Date();
  return isoDate(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
};
