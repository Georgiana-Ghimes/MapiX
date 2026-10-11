// Liste de valori și tonuri de culoare folosite consecvent în toată aplicația.
export const TIP_LOCALITATE = ['Municipiu', 'Oraș', 'Comună', 'Zonă metropolitană', 'Altul'];
export const PRIORITATI = ['P1', 'P2', 'P3'];
export const STATUS_ACOPERIRE = ['Neîncepută', 'În cercetare', 'Parțial acoperită', 'Verificată'];
export const STATUS_REGLEMENTARE = [
  'Taxă confirmată',
  'Autorizație fără taxă confirmată',
  'Fără taxă confirmată',
  'Interdicție confirmată',
  'Proiect',
  'De verificat',
  'Date indisponibile',
];
export const STATUSURI_ACOPERIRE = STATUS_ACOPERIRE;
export const STATUSURI_REGLEMENTARE = STATUS_REGLEMENTARE;
export const CATEGORII_REGULA = ['Taxă de acces', 'Autorizație', 'Restricție', 'Interdicție', 'Exceptare'];
export const TIPURI_MASA = ['MTMA', 'Masă totală', 'Alt criteriu', 'Necunoscut'];
export const TIPURI_TAXA = ['Pe zi', 'Pe lună', 'Pe an', 'Pe tranzit', 'Gratuit', 'Interzis', 'Altul'];
export const MONEDE = ['RON', 'EUR', 'Fără valoare monetară'];
export const UNITATI_TARIFARE = [
  'Per vehicul',
  'Per zi',
  'Per lună',
  'Per an',
  'Per intrare',
  'Per tranzit',
  'Altul',
];
export const NIVELURI_INCREDERE = ['Confirmat', 'De confirmat', 'Proiect', 'Negăsit'];
export const STATUSURI_TAXA = ['Ciornă', 'Activ', 'Expirat', 'Arhivat'];
export const TIPURI_ZONA = ['Taxată', 'Restricționată', 'Interzisă', 'Reglementată', 'Informativă'];
export const STATUSURI_GEOMETRIE = ['Neverificată', 'De verificat', 'Confirmată'];
export const TIPURI_ACT = ['HCL', 'HCGMB', 'Regulament', 'Hotărâre', 'Alt document oficial'];
export const STATUSURI_ACT = ['Actual', 'Expiră', 'Expirat', 'De reverificat', 'Proiect', 'Necunoscut'];
export const TIPURI_ALERTA = [
  'Taxă modificată',
  'Taxă expirată',
  'Act nou',
  'Verificare necesară',
  'Geometrie de reverificat',
  'Informație incompletă',
];
export const SEVERITATI = ['Informativă', 'Medie', 'Ridicată', 'Critică'];
export const STATUSURI_ALERTA = ['Nouă', 'În lucru', 'Rezolvată', 'Ignorată'];
export const STATUSURI_CALCUL_TAXA = ['Calculat', 'Necunoscut', 'De verificat', 'Neaplicabil', 'Exclus'];
export const STATUSURI_CALCUL_CURSA = ['Complet', 'Parțial', 'Necesită verificare', 'Neconcludent'];
export const CATEGORII_VEHICUL = ['Autoutilitară', 'Camion', 'Cap tractor', 'Ansamblu rutier', 'Altul'];
export const TIPURI_VEHICUL_REGULA = ['Autoutilitară', 'Camion', 'Cap tractor', 'Ansamblu rutier', 'Nespecificat'];
export const ZILE_SAPTAMANA = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

export const TONURI = {
  verde: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  chihlimbar: 'border-amber-300 bg-amber-50 text-amber-900',
  rosu: 'border-red-200 bg-red-50 text-red-700',
  albastru: 'border-blue-200 bg-blue-50 text-blue-700',
  gri: 'border-slate-200 bg-slate-100 text-slate-600',
};

const HARTĂ_TONURI = {
  Verificată: 'verde',
  Confirmat: 'verde',
  Confirmată: 'verde',
  Activ: 'verde',
  Actual: 'verde',
  Calculat: 'verde',
  Complet: 'verde',
  Rezolvată: 'verde',

  'În cercetare': 'chihlimbar',
  'Parțial acoperită': 'chihlimbar',
  'Autorizație fără taxă confirmată': 'chihlimbar',
  'De verificat': 'chihlimbar',
  'De confirmat': 'chihlimbar',
  'De reverificat': 'chihlimbar',
  Proiect: 'chihlimbar',
  Expiră: 'chihlimbar',
  'În lucru': 'chihlimbar',
  Medie: 'chihlimbar',
  Ridicată: 'rosu',
  Parțial: 'chihlimbar',
  'Necesită verificare': 'chihlimbar',
  Mixt: 'chihlimbar',
  'De verificat (regulă)': 'chihlimbar',
  Restricționată: 'chihlimbar',
  Restricție: 'chihlimbar',
  Autorizație: 'chihlimbar',
  'Taxă expirată': 'rosu',
  'Informație incompletă': 'chihlimbar',
  'Geometrie de reverificat': 'chihlimbar',
  'Taxă modificată': 'albastru',
  'Act nou': 'albastru',

  'Interdicție confirmată': 'rosu',
  Interdicție: 'rosu',
  Interzisă: 'rosu',
  Negăsit: 'rosu',
  Expirat: 'rosu',
  Critică: 'rosu',
  Necunoscut: 'rosu',
  Neconcludent: 'rosu',

  'Taxă confirmată': 'albastru',
  Taxată: 'albastru',
  'Nouă': 'albastru',
  P1: 'albastru',
  'Taxă de acces': 'albastru',

  Administrator: 'albastru',
  'Operator / Dispecer': 'gri',
  'DEMO': 'chihlimbar',
  'DEMO — DATE FICTIVE': 'chihlimbar',
  Arhivată: 'gri',

  'Neîncepută': 'gri',
  'Fără taxă confirmată': 'gri',
  'Date indisponibile': 'gri',
  Ciornă: 'gri',
  Arhivat: 'gri',
  Ignorată: 'gri',
  Inactiv: 'gri',
  Exceptare: 'gri',
  Reglementată: 'gri',
  Informativă: 'gri',
  Neverificată: 'gri',
  Neaplicabil: 'gri',
  Exclus: 'gri',
  Necalculabil: 'gri',
  P2: 'gri',
  P3: 'gri',
};

export function tonStare(valoare) {
  return HARTĂ_TONURI[valoare] || 'gri';
}