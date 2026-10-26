// Ethiopian <-> Gregorian calendar conversion (JDN based). Dates are handled as UTC day numbers.
const ETH_EPOCH = 1723856;
const UNIX_EPOCH_JDN = 2440588;

export const ETH_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት',
  'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
];

const toJdn = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000) + UNIX_EPOCH_JDN;
const fromJdn = (jdn: number) => new Date((jdn - UNIX_EPOCH_JDN) * 86400000);

export function ethToJdn(y: number, m: number, d: number) {
  return ETH_EPOCH + 365 + 365 * (y - 1) + Math.floor(y / 4) + 30 * m + d - 31;
}

/** Gregorian Date (UTC day) -> Ethiopian {year, month 1-13, day} */
export function toEthiopian(date: Date) {
  const jdn = toJdn(date);
  const r = (jdn - ETH_EPOCH) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - ETH_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

/** Ethiopian y/m/d -> Gregorian Date at UTC midnight */
export function fromEthiopian(y: number, m: number, d: number) {
  return fromJdn(ethToJdn(y, m, d));
}

export const daysInEthMonth = (y: number, m: number) => (m < 13 ? 30 : y % 4 === 3 ? 6 : 5);
