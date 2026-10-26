/**
 * Afar Region woredas shown in the dropdown (form + filters).
 *
 * IMPORTANT: this list was written from general knowledge, not copied from an official source, and Afar's
 * woreda boundaries have been reorganised over the years. Check it against the Afar Regional Health Bureau's
 * current list and edit it here — it is the only place the list lives. The entry form also has an
 * "Other…" option, so a missing woreda never blocks data entry.
 */
export const AFAR_WOREDAS: string[] = [
  // Zone 1
  'Adaar', 'Afambo', 'Asayita', 'Chifra', 'Dubti', 'Elidar', 'Kori', 'Mille',
  // Zone 2
  'Abala', 'Afdera', 'Berahle', 'Bidu', 'Dallol', 'Erebti', 'Koneba', 'Kurri', 'Megale',
  // Zone 3
  'Amibara', 'Awash Fentale', 'Bure Mudaytu', 'Dulecha', 'Gewane', 'Hanruka',
  // Zone 4
  'Aura', 'Ewa', 'Gulina', 'Teru', 'Yalo',
  // Zone 5
  'Dewe', 'Hadelela', 'Simurobi Gele\'alo', 'Telalak',
  // Special woreda and city administrations
  'Argobba Special Woreda', 'Semera City Administration', 'Awash 7 City Administration',
].sort((a, b) => a.localeCompare(b));

/** Match a typed value to the canonical spelling (case/space-insensitive). Returns undefined if not in the list. */
export function canonicalWoreda(input: string | undefined | null): string | undefined {
  const key = (input ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return undefined;
  return AFAR_WOREDAS.find((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '') === key);
}
