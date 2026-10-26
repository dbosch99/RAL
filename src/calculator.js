// Trasposizione del foglio Confronto, modello 2026. Importi non arrotondati
// per il dipendente; ROUND(..., 2) per le voci Inarcassa e l'imposta sostitutiva.
export const PARAMETERS = Object.freeze({
  year: 2026, forfaitLimit: 85000, employeeCeiling: 122295,
  pensionCeiling: 147300, integrativePensionCeiling: 193600, vatRate: .22,
  profitability: .78, startupTax: .05, ordinaryTax: .15,
  pensionRate: .145, youngPensionRate: .0725, pensionMinimum: 2785,
  integrativeMinimum: 850, youngIncomeLimit: 49907, minimumDivisor: 3,
  integrativeRate: .04, maternity: 65.5, provinceRate: .0123,
  provinceExemption: 30000, provinceThreshold: 50000, provinceUpperRate: .0173,
  municipalityRate: 0, extraContributionThreshold: 56224, extraContributionRate: .01,
});
export const DEFAULTS = Object.freeze({
  gross: 37000, period: 'startup', reduction: 'auto', ageGroup: 'under35', registration: 'first5',
  fiscalCosts: null,
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
  if (!Number.isFinite(input.gross) || input.gross < 0)
    errors.gross = 'Inserisci un lordo numerico pari o superiore a zero.';
  if (!Number.isFinite(input.employeeRate) || input.employeeRate < 0 || input.employeeRate > 100)
    errors.employeeRate = 'Inserisci un\'aliquota da 0 a 100%.';
  if (!Number.isFinite(input.costs) || input.costs < 0) errors.costs = 'Inserisci costi annui pari o superiori a zero.';
  if (input.deductible !== null && (!Number.isFinite(input.deductible) || input.deductible < 0))
    errors.deductible = 'Inserisci un importo positivo, zero oppure lascia vuoto.';
  if (!['startup', 'ordinary'].includes(input.period)) errors.period = 'Seleziona il periodo di attività.';
  if (!['auto', 'reduced', 'full'].includes(input.reduction)) errors.reduction = 'Seleziona la contribuzione Inarcassa.';
  if (!['under35','35plus'].includes(input.ageGroup)) errors.ageGroup = 'Seleziona la fascia di età.';
  if (!['first5','later'].includes(input.registration)) errors.registration = 'Seleziona l\'anzianità di iscrizione.';
  if (input.gross > PARAMETERS.forfaitLimit && input.fiscalCosts !== null
      && (!Number.isFinite(input.fiscalCosts) || input.fiscalCosts < 0))
    errors.fiscalCosts = 'Inserisci costi deducibili pari o superiori a zero oppure lascia vuoto.';
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
  const p = PARAMETERS, gross = input.gross;
  const regime = gross <= p.forfaitLimit ? 'forfait' : 'ordinary';
  const fiscalCosts = regime === 'ordinary' ? (input.fiscalCosts ?? input.costs) : 0;
  const income = regime === 'forfait' ? gross * p.profitability : gross - fiscalCosts;
  const youngEligible = input.ageGroup === 'under35' && input.registration === 'first5';
  const reduced = youngEligible && income <= p.youngIncomeLimit && input.reduction !== 'full';
  const pensionRate = reduced ? p.youngPensionRate : p.pensionRate;
  const pensionMinimum = roundMoney(reduced ? p.pensionMinimum / p.minimumDivisor : p.pensionMinimum);
  const pensionBase = Math.min(Math.max(0,income),p.pensionCeiling);
  const pension = roundMoney(Math.max(pensionMinimum, pensionBase * pensionRate));
  const integrative = roundMoney(gross * p.integrativeRate);
  const integrativeMinimum = roundMoney(reduced ? p.integrativeMinimum / p.minimumDivisor : p.integrativeMinimum);
  const integrativeDue = Math.max(integrativeMinimum, integrative);
  const integrativeCredited = roundMoney(Math.min(integrativeDue,p.integrativePensionCeiling*p.integrativeRate) * input.integrativeCreditRate / 100);
  const pensionAnnual = roundMoney(pension + integrativeCredited);
  const integrativeOwn = Math.max(0, integrativeDue - integrative);
  const contributions = pension + integrativeOwn + p.maternity;
  const deducted = input.deductible === null ? contributions : input.deductible;
  const taxable = Math.max(0, income - deducted);
  const taxRate = regime === 'forfait' ? (input.period === 'startup' ? p.startupTax : p.ordinaryTax) : 0;
  const bracket1 = regime === 'ordinary' ? Math.min(taxable,28000)*.23 : 0;
  const bracket2 = regime === 'ordinary' ? Math.max(0,Math.min(taxable,50000)-28000)*.33 : 0;
  const bracket3 = regime === 'ordinary' ? Math.max(0,taxable-50000)*.43 : 0;
  const grossTax = bracket1 + bracket2 + bracket3;
  const referenceIncome = Math.max(0,income), trunc4 = value => Math.trunc(value*10000)/10000;
  const workDeduction = regime !== 'ordinary' || referenceIncome <= 0 ? 0
    : (referenceIncome <= 5500 ? 1265 : referenceIncome <= 28000
      ? 500 + 765*trunc4((28000-referenceIncome)/22500)
      : referenceIncome <= 50000 ? 500*trunc4((50000-referenceIncome)/22000) : 0)
      + (referenceIncome > 11000 && referenceIncome <= 17000 ? 50 : 0);
  const netIrpef = Math.max(0,grossTax-workDeduction);
  const provinceTax = regime !== 'ordinary' || netIrpef === 0 || taxable <= p.provinceExemption ? 0
    : Math.min(taxable,p.provinceThreshold)*p.provinceRate+Math.max(0,taxable-p.provinceThreshold)*p.provinceUpperRate;
  const municipalityTax = regime !== 'ordinary' || netIrpef === 0 ? 0 : taxable*p.municipalityRate;
  const substituteTax = regime === 'forfait' ? roundMoney(taxable*taxRate) : 0;
  const taxes = regime === 'forfait' ? substituteTax : netIrpef+provinceTax+municipalityTax;
  const invoice = gross + integrative;
  const vat = regime === 'ordinary' ? roundMoney(invoice*p.vatRate) : 0;
  const net = gross - contributions - taxes - input.costs;
  return { gross, regime, fiscalCosts, income, youngEligible, reduced, pensionBase, pensionRate, pensionMinimum, pension, integrative,
    integrativeMinimum, integrativeDue, integrativeOwn, integrativeCredited, pensionAnnual,
    invoice, vat, invoiceWithVat: invoice+vat,
    maternity: p.maternity, contributions, deducted, taxable, taxRate, taxes,
    bracket1, bracket2, bracket3, grossTax, workDeduction, netIrpef, provinceTax, municipalityTax, substituteTax,
    costs: input.costs, net, monthly: net / input.months };
}

export function calculate(input) {
  input = {...DEFAULTS, ...input};
  const errors = validate(input);
  if (Object.keys(errors).length) return { valid: false, errors };
  const employee = calculateEmployee(input), freelance = calculateFreelance(input);
  if (![employee.net,employee.pensionAnnual,freelance.net,freelance.pensionAnnual,freelance.invoiceWithVat].every(Number.isFinite))
    return {valid:false,errors:{gross:'Importo non rappresentabile numericamente: verifica il valore inserito.'}};
  return { valid: true, employee, freelance,
    difference: freelance.net - employee.net,
    pensionDifference: roundMoney(freelance.pensionAnnual - employee.pensionAnnual) };
}
