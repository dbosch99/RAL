// Trasposizione del foglio Confronto, modello 2026. Importi non arrotondati
// per il dipendente; ROUND(..., 2) per le voci Inarcassa e l'imposta sostitutiva.
export const PARAMETERS = Object.freeze({
  year: 2026, limit: 200000, forfaitLimit: 85000, employeeCeiling: 122295,
  profitability: .78, startupTax: .05, ordinaryTax: .15,
  pensionRate: .145, youngPensionRate: .0725, pensionMinimum: 2785,
  integrativeMinimum: 850, youngIncomeLimit: 49907, minimumDivisor: 3,
  integrativeRate: .04, maternity: 65.5, provinceRate: .0123,
  provinceExemption: 30000, provinceThreshold: 50000, provinceUpperRate: .0173,
  municipalityRate: 0, extraContributionThreshold: 56224, extraContributionRate: .01,
});
export const DEFAULTS = Object.freeze({
  gross: 37000, period: 'startup', reduction: 'auto', youngEligible: true,
  employeeRate: 9.19, costs: 0, deductible: 0, months: 12,
  employeePensionRate: 33, integrativeCreditRate: 50, employeeCapped: true,
});
export const roundMoney = value => {
  // Precisione Excel e arrotondamento decimale dei mezzi centesimi.
  const normalized = Number(value.toPrecision(15));
  return Math.round((normalized + Number.EPSILON * Math.max(1, Math.abs(normalized))) * 100) / 100;
};

export function validate(input) {
  input = {...DEFAULTS, ...input};
  const errors = {};
  if (!Number.isFinite(input.gross) || input.gross < 0 || input.gross > PARAMETERS.limit)
    errors.gross = 'Inserisci un lordo da 0 a 200.000 €.';
  if (!Number.isFinite(input.employeeRate) || input.employeeRate < 0 || input.employeeRate > 100)
    errors.employeeRate = 'Inserisci un\'aliquota da 0 a 100%.';
  if (!Number.isFinite(input.costs) || input.costs < 0) errors.costs = 'Inserisci costi annui pari o superiori a zero.';
  if (input.deductible !== null && (!Number.isFinite(input.deductible) || input.deductible < 0))
    errors.deductible = 'Inserisci un importo positivo, zero oppure lascia vuoto.';
  if (!['startup', 'ordinary'].includes(input.period)) errors.period = 'Seleziona il periodo di attività.';
  if (!['auto', 'reduced', 'full'].includes(input.reduction)) errors.reduction = 'Seleziona la contribuzione Inarcassa.';
  if (typeof input.youngEligible !== 'boolean') errors.youngEligible = 'Indica il requisito giovani.';
  if (![12, 13, 14].includes(input.months)) errors.months = 'Seleziona 12, 13 o 14 mensilità.';
  for (const key of ['employeePensionRate','integrativeCreditRate'])
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > 100)
      errors[key] = 'Inserisci un\'aliquota da 0 a 100%.';
  if (typeof input.employeeCapped !== 'boolean') errors.employeeCapped = 'Indica se si applica il massimale INPS.';
  return errors;
}

export function calculateEmployee(input) {
  input = {...DEFAULTS, ...input};
  const p = PARAMETERS, gross = input.gross;
  const pensionBase = input.employeeCapped ? Math.min(gross, p.employeeCeiling) : gross;
  const extraContributions = Math.max(0, pensionBase - p.extraContributionThreshold) * p.extraContributionRate;
  const contributions = pensionBase * (input.employeeRate / 100) + extraContributions;
  const pensionRate = input.employeePensionRate / 100;
  const pensionAnnual = roundMoney(pensionBase * pensionRate);
  const taxable = Math.max(0, gross - contributions);
  const bracket1 = Math.min(taxable, 28000) * .23;
  const bracket2 = Math.max(0, Math.min(taxable, 50000) - 28000) * .33;
  const bracket3 = Math.max(0, taxable - 50000) * .43;
  const grossTax = bracket1 + bracket2 + bracket3;
  const workDeduction = (taxable <= 0 ? 0 : taxable <= 15000 ? 1955 : taxable <= 28000
    ? 1910 + 1190 * (28000 - taxable) / 13000 : taxable <= 50000 ? 1910 * (50000 - taxable) / 22000 : 0)
    + (taxable > 25000 && taxable <= 35000 ? 65 : 0);
  const extraDeduction = taxable > 20000 && taxable <= 32000 ? 1000
    : taxable > 32000 && taxable <= 40000 ? 1000 * (40000 - taxable) / 8000 : 0;
  const netIrpef = Math.max(0, grossTax - workDeduction - extraDeduction);
  const exemptBenefit = taxable > 0 && taxable <= 20000
    ? taxable * (taxable <= 8500 ? .071 : taxable <= 15000 ? .053 : .048) : 0;
  const integrativeBenefit = taxable > 0 && taxable <= 15000 && grossTax > workDeduction - 75 ? 1200 : 0;
  const provinceTax = netIrpef === 0 || taxable <= p.provinceExemption ? 0
    : Math.min(taxable, p.provinceThreshold) * p.provinceRate + Math.max(0, taxable - p.provinceThreshold) * p.provinceUpperRate;
  const municipalityTax = netIrpef === 0 ? 0 : taxable * p.municipalityRate;
  const taxes = netIrpef + provinceTax + municipalityTax;
  const benefits = exemptBenefit + integrativeBenefit;
  const net = gross - contributions - taxes + benefits;
  return { gross, contributions, extraContributions, pensionBase, pensionRate, pensionAnnual,
    taxable, bracket1, bracket2, bracket3,
    grossTax, workDeduction, extraDeduction, netIrpef, exemptBenefit, integrativeBenefit,
    provinceTax, municipalityTax, taxes, benefits, costs: 0, net, monthly: net / input.months };
}

export function calculateFreelance(input) {
  input = {...DEFAULTS, ...input};
  if (input.gross > PARAMETERS.forfaitLimit) return null;
  const p = PARAMETERS, gross = input.gross, income = gross * p.profitability;
  const reduced = input.youngEligible && income <= p.youngIncomeLimit
    && (input.reduction === 'reduced' || (input.reduction === 'auto' && input.period === 'startup'));
  const pensionRate = reduced ? p.youngPensionRate : p.pensionRate;
  const pensionMinimum = roundMoney(reduced ? p.pensionMinimum / p.minimumDivisor : p.pensionMinimum);
  const pension = roundMoney(Math.max(pensionMinimum, income * pensionRate));
  const integrative = roundMoney(gross * p.integrativeRate);
  const integrativeMinimum = roundMoney(reduced ? p.integrativeMinimum / p.minimumDivisor : p.integrativeMinimum);
  const integrativeDue = Math.max(integrativeMinimum, integrative);
  const integrativeCredited = roundMoney(integrativeDue * input.integrativeCreditRate / 100);
  const pensionAnnual = roundMoney(pension + integrativeCredited);
  const integrativeOwn = Math.max(0, integrativeDue - integrative);
  const contributions = pension + integrativeOwn + p.maternity;
  const deducted = input.deductible === null ? contributions : input.deductible;
  const taxable = Math.max(0, income - deducted);
  const taxRate = input.period === 'startup' ? p.startupTax : p.ordinaryTax;
  const taxes = roundMoney(taxable * taxRate);
  const net = gross - contributions - taxes - input.costs;
  return { gross, income, reduced, pensionRate, pensionMinimum, pension, integrative,
    integrativeMinimum, integrativeDue, integrativeOwn, integrativeCredited, pensionAnnual,
    invoice: gross + integrative,
    maternity: p.maternity, contributions, deducted, taxable, taxRate, taxes,
    costs: input.costs, net, monthly: net / input.months };
}

export function calculate(input) {
  input = {...DEFAULTS, ...input};
  const errors = validate(input);
  if (Object.keys(errors).length) return { valid: false, errors };
  const employee = calculateEmployee(input), freelance = calculateFreelance(input);
  return { valid: true, employee, freelance,
    difference: freelance ? freelance.net - employee.net : null,
    pensionDifference: freelance ? roundMoney(freelance.pensionAnnual - employee.pensionAnnual) : null };
}
