// Formatare și convenții locale pentru România (ro-RO, Europe/Bucharest).
const FUS = 'Europe/Bucharest';

export function esteGol(valoare) {
  return valoare === null || valoare === undefined || valoare === '' || (typeof valoare === 'string' && valoare.trim() === '');
}

export function dataRo(valoare) {
  if (esteGol(valoare)) return '—';
  const d = new Date(valoare);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUS,
  }).format(d);
}

export function dataOraRo(valoare) {
  if (esteGol(valoare)) return '—';
  const d = new Date(valoare);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: FUS,
  }).format(d);
}

export function numarRo(valoare, zecimale = 2) {
  const n = laNumar(valoare);
  if (n === null) return '—';
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: zecimale,
  }).format(n);
}

export function sumaRo(valoare, moneda) {
  const n = laNumar(valoare);
  if (n === null) return '—';
  if (!moneda || moneda === 'Fără valoare monetară') return numarRo(n, 2);
  return `${numarRo(n, 2)} ${moneda}`;
}

export function masaRo(valoare) {
  const n = laNumar(valoare);
  if (n === null) return '—';
  return `${numarRo(n, 2)} t`;
}

export function laNumar(valoare) {
  if (esteGol(valoare)) return null;
  if (typeof valoare === 'number') return isNaN(valoare) ? null : valoare;
  const curatat = String(valoare).replace(/\s/g, '').replace(',', '.');
  const n = Number(curatat);
  return isNaN(n) ? null : n;
}

export function rotunjeste(valoare) {
  const n = Number(valoare);
  if (isNaN(n)) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function azi() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function acumISO() {
  return new Date().toISOString();
}

export function zilePanaLa(dataIso, referintaIso) {
  if (esteGol(dataIso)) return null;
  const a = new Date(dataIso);
  const b = referintaIso ? new Date(referintaIso) : new Date();
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
}

export function luniDeLa(dataIso) {
  if (esteGol(dataIso)) return null;
  const d = new Date(dataIso);
  if (isNaN(d.getTime())) return null;
  const acum = new Date();
  return (acum.getFullYear() - d.getFullYear()) * 12 + (acum.getMonth() - d.getMonth());
}

export function textSau(v, fallback = 'Necompletat') {
  return esteGol(v) ? fallback : v;
}

export function slugDin(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[ăâ]/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}