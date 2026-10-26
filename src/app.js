import { DEFAULTS, PARAMETERS, calculate, calculateEmployee, calculateFreelance } from './calculator.js?v=pensione-2';

const $ = id => document.getElementById(id);
const euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numbers = new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 2 });
const money = n => Number.isFinite(n) ? euros.format(Math.abs(n) < .000001 ? 0 : n) : '—';
const storageKey = 'ral-simulation-v1';
let lastResult, lastInput;

// I campi monetari usano la notazione italiana: punto migliaia, virgola decimale.
export function parseItalian(value, optional = false) {
  const raw = value.trim();
  if (!raw) return optional ? null : NaN;
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(raw)) return NaN;
  return Number(raw.replaceAll('.', '').replace(',', '.'));
}

function readInput() {
  return {
    gross: parseItalian($('gross').value), employeeRate: parseItalian($('employeeRate').value),
    costs: parseItalian($('costs').value), deductible: parseItalian($('deductible').value, true),
    period: $('period').value, reduction: $('reduction').value,
    youngEligible: $('youngEligible').checked, months: Number($('months').value),
    employeePensionRate: parseItalian($('employeePensionRate').value),
    integrativeCreditRate: parseItalian($('integrativeCreditRate').value),
    employeeCapped: $('employeeCapped').checked,
  };
}

function setInputs(input) {
  for (const key of ['gross', 'employeeRate', 'costs', 'deductible', 'employeePensionRate', 'integrativeCreditRate'])
    $(key).value = input[key] === null ? '' : numbers.format(input[key]);
  for (const key of ['period', 'reduction', 'months']) $(key).value = String(input[key]);
  $('youngEligible').checked = input.youngEligible;
  $('employeeCapped').checked = input.employeeCapped;
  $('gross-range').value = String(input.gross);
}

function renderComposition(id, values) {
  const container = $(id); container.replaceChildren();
  const total = values.reduce((sum, [,value]) => sum + Math.max(0, value), 0);
  if (!total) return;
  for (const [key, value] of values) {
    const part = document.createElement('span');
    part.className = key; part.style.width = `${Math.max(0, value) / total * 100}%`;
    container.append(part);
  }
}

function detailRows(id, rows) {
  const target = $(id); target.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = typeof value === 'number' ? money(value) : value;
    row.append(dt, dd); target.append(row);
  }
}

function tableRows(targetId, rows) {
  const target = $(targetId); target.replaceChildren();
  for (const { label, employee, freelance, className = '' } of rows) {
    const row = document.createElement('tr'); row.className = className;
    const heading = document.createElement('th'); heading.scope = 'row'; heading.textContent = label;
    row.append(heading);
    for (const value of [employee, freelance]) {
      const cell = document.createElement('td');
      cell.textContent = typeof value === 'number' ? money(value) : value;
      row.append(cell);
    }
    target.append(row);
  }
}

function drawChart(input, result) {
  const W = 800, H = 265, L = 57, R = 20, T = 17, B = 34;
  const limit = PARAMETERS.limit;
  const samples = new Set(Array.from({length:limit / 500 + 1}, (_,i) => i * 500));
  const rate = input.employeeRate / 100;
  const grossForTaxable = taxable => {
    const cap = PARAMETERS.employeeCeiling;
    const atCap = cap * rate + Math.max(0,cap - PARAMETERS.extraContributionThreshold) * PARAMETERS.extraContributionRate;
    if (input.employeeCapped && taxable > cap - atCap) return taxable + atCap;
    const basic = taxable / (1 - rate);
    return basic <= PARAMETERS.extraContributionThreshold ? basic
      : (taxable - PARAMETERS.extraContributionThreshold * PARAMETERS.extraContributionRate) / (1 - rate - PARAMETERS.extraContributionRate);
  };
  for (const threshold of [8500,15000,20000,25000,28000,30000,32000,35000,40000,50000]) {
    const gross = grossForTaxable(threshold);
    if (Number.isFinite(gross) && gross > 0 && gross < limit) {
      samples.add(gross); samples.add(Math.max(0,gross - .01)); samples.add(Math.min(limit,gross + .01));
    }
  }
  const youngLimit = PARAMETERS.youngIncomeLimit / PARAMETERS.profitability;
  for (const gross of [youngLimit,youngLimit + .01,PARAMETERS.forfaitLimit,PARAMETERS.employeeCeiling,input.gross]) samples.add(gross);
  const points = [...samples].sort((a,b) => a - b).map(gross => {
    const i = {...input,gross};
    return {gross,employee:calculateEmployee(i).net,freelance:calculateFreelance(i)?.net ?? null};
  });
  const values = points.flatMap(p => [p.employee,p.freelance]).filter(Number.isFinite);
  const maxY = Math.max(10000,Math.ceil(Math.max(0,...values) / 10000) * 10000);
  const x = n => L + n / limit * (W - L - R), y = n => T + (maxY - n) / maxY * (H - T - B);
  let markup = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-title plot-desc"><title id="plot-title">Netto annuo in funzione del lordo</title><desc id="plot-desc">Asse verticale da zero. Dipendente da zero a 200.000 euro; partita IVA forfettaria da zero a 85.000 euro. I valori negativi sono consultabili nella tabella.</desc><defs><clipPath id="plot-clip"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>`;
  const step = Math.max(10000,10 ** Math.floor(Math.log10(maxY / 5)) * 2);
  for (let tick = 0; tick <= Math.min(30,Math.floor(maxY / step)); tick++) {
    const value = tick * step;
    markup += `<line class="grid" x1="${L}" x2="${W-R}" y1="${y(value)}" y2="${y(value)}"/><text class="grid-label" text-anchor="end" x="${L-10}" y="${y(value)+3}">${numbers.format(value / 1000)}k €</text>`;
  }
  markup += `<line class="axis" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/>`;
  for (const value of [0,50000,100000,150000,200000]) markup += `<text class="grid-label" text-anchor="middle" x="${x(value)}" y="${H-11}">${numbers.format(value / 1000)}k €</text>`;
  markup += '<g clip-path="url(#plot-clip)">';
  for (const key of ['employee','freelance']) {
    const usable = points.filter(p => Number.isFinite(p[key]));
    const d = usable.map((p,i)=>`${i?'L':'M'}${x(p.gross).toFixed(2)},${y(p[key]).toFixed(2)}`).join(' ');
    markup += `<path class="${key}-line" d="${d}"/>`;
  }
  markup += '</g>';
  const sx = x(input.gross), labelX = Math.max(L+46,Math.min(W-R-46,sx));
  markup += `<line class="selection" x1="${sx}" x2="${sx}" y1="${T}" y2="${H-B}"/><rect x="${labelX-46}" y="${T-7}" width="92" height="17" rx="4" fill="#eef2e9"/><text class="selection-label" text-anchor="middle" x="${labelX}" y="${T+5}">${numbers.format(input.gross)} € lordi</text>`;
  for (const [key,color] of [['employee','#597da3'],['freelance','#21765b']]) {
    const value = result[key]?.net;
    if (Number.isFinite(value) && value >= 0) markup += `<circle cx="${sx}" cy="${y(value)}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  }
  $('chart').innerHTML = markup+'</svg>';
  const tablePoints = [...new Set([0,10000,20000,30000,input.gross,50000,85000,100000,150000,200000])].sort((a,b)=>a-b);
  tableRows('chart-table-body',tablePoints.map(gross=>({label:money(gross),employee:calculateEmployee({...input,gross}).net,
    freelance:calculateFreelance({...input,gross})?.net ?? 'Non calcolato',className:gross===input.gross?'total':''})));
}

function render(input,result) {
  const e=result.employee,f=result.freelance;
  for (const [key,value] of Object.entries({
    'employee-net':e.net,'employee-monthly':e.monthly,'employee-contributions':e.contributions,
    'employee-taxes':e.taxes,'employee-benefits':e.benefits,'employee-pension':e.pensionAnnual,
    'freelance-net':f?.net,'freelance-monthly':f?.monthly,'freelance-contributions':f?.contributions,
    'freelance-taxes':f?.taxes,'freelance-costs':f?.costs,'freelance-pension':f?.pensionAnnual,
  })) $(key).textContent=money(value);
  $('employee-net').classList.toggle('negative',e.net<0);
  $('freelance-net').classList.toggle('negative',Boolean(f&&f.net<0));
  $('freelance-card').classList.toggle('unavailable',!f);
  $('freelance-unavailable').hidden=Boolean(f);
  document.querySelectorAll('.monthly-description').forEach(node=>node.textContent=`/ mese su ${input.months} mensilità`);
  $('tax-tag').textContent=f?`Forfettario ${percent.format(f.taxRate)}`:'Limite forfettario superato';
  const comparisonText=(value,equal)=>value===null?'Non confrontabile oltre 85.000 €':Math.abs(value)<.005?equal:value>0?'In più con la partita IVA':'In più da dipendente';
  $('difference').textContent=money(result.difference===null?null:Math.abs(result.difference));
  $('difference-description').textContent=comparisonText(result.difference,'Netti annui equivalenti');
  $('monthly-difference').textContent=money(result.difference===null?null:Math.abs(result.difference)/input.months);
  $('pension-difference').textContent=money(result.pensionDifference===null?null:Math.abs(result.pensionDifference));
  $('pension-difference-description').textContent=comparisonText(result.pensionDifference,'Contributi pensionistici equivalenti');
  $('active-context').hidden=!f;
  if(f) {
    $('active-reduction').textContent=`Inarcassa ${f.reduced?'ridotta':'intera'} · soggettivo ${percent.format(f.pensionRate)}`;
    $('active-deduction').textContent=input.deductible===null?'Deduzione: contributi annui stimati':`Contributi dedotti: ${money(f.deducted)}`;
    $('active-invoice').textContent=`Totale fatturato con il 4%: ${money(f.invoice)}`;
  }
  renderComposition('employee-composition',[['net',e.net],['contributions',e.contributions],['taxes',e.taxes]]);
  renderComposition('freelance-composition',f?[['net',f.net],['contributions',f.contributions],['taxes',f.taxes],['costs',f.costs]]:[]);
  const fv=key=>f?f[key]:'Non calcolato';
  tableRows('breakdown-body',[
    {label:'RAL / compensi professionali',employee:e.gross,freelance:input.gross},
    {label:'Integrativo aggiunto in fattura',employee:'—',freelance:fv('integrative'),className:'secondary-row'},
    {label:'Contributi a tuo carico',employee:-e.contributions,freelance:f?-f.contributions:'Non calcolato'},
    {label:'Imposte nette',employee:-e.taxes,freelance:f?-f.taxes:'Non calcolato'},
    {label:'Benefici fiscali aggiunti',employee:e.benefits,freelance:'—'},
    {label:'Costi professionali effettivi',employee:'—',freelance:f?-f.costs:'Non calcolato'},
    {label:'Netto annuo',employee:e.net,freelance:fv('net'),className:'total'},
    {label:`Netto medio su ${input.months} mensilità`,employee:e.monthly,freelance:fv('monthly')},
    {label:'Contributi pensionistici annui stimati',employee:e.pensionAnnual,freelance:fv('pensionAnnual'),className:'pension-total'},
  ]);
  detailRows('employee-detail',[
    ['Contributi complessivi',e.contributions],['Di cui contributo aggiuntivo 1%',e.extraContributions],
    ['Imponibile fiscale',e.taxable],['IRPEF: primo scaglione 23%',e.bracket1],['IRPEF: secondo scaglione 33%',e.bracket2],
    ['IRPEF: terzo scaglione 43%',e.bracket3],['IRPEF lorda',e.grossTax],['Detrazione lavoro dipendente',e.workDeduction],
    ['Ulteriore detrazione fiscale',e.extraDeduction],['IRPEF netta',e.netIrpef],['Somma esente fino a 20.000 €',e.exemptBenefit],
    ['Trattamento integrativo',e.integrativeBenefit],['Addizionale provinciale',e.provinceTax],['Addizionale comunale',e.municipalityTax],
    ['Totale imposte',e.taxes],['Imponibile pensionabile stimato',e.pensionBase],['Aliquota pensionistica complessiva',percent.format(e.pensionRate)],
    ['Contributi pensionistici annui stimati',e.pensionAnnual],
  ]);
  detailRows('freelance-detail',f?[
    ['Reddito forfettario, 78% dei compensi',f.income],['Regime contributivo',f.reduced?'Ridotto':'Intero'],
    ['Aliquota soggettivo',percent.format(f.pensionRate)],['Minimo soggettivo',f.pensionMinimum],['Soggettivo dovuto',f.pension],
    ['Integrativo addebitato, 4%',f.integrative],['Minimo integrativo',f.integrativeMinimum],['Integrativo totale da riversare',f.integrativeDue],
    ['Integrativo rimasto a tuo carico',f.integrativeOwn],['Maternità/paternità, provvisoria',f.maternity],
    ['Contributi complessivi a tuo carico',f.contributions],['Contributi dedotti fiscalmente',f.deducted],
    ['Imponibile imposta sostitutiva',f.taxable],['Aliquota imposta sostitutiva',percent.format(f.taxRate)],['Imposta sostitutiva',f.taxes],
    ['Costi effettivi',f.costs],['Quota integrativo destinata al montante',f.integrativeCredited],['Contributi pensionistici annui stimati',f.pensionAnnual],
  ]:[['Regime forfettario','Non simulato oltre 85.000 €']]);
  const warnings=[];
  if(f&&input.costs===0)warnings.push('Costi professionali a zero: il netto della partita IVA è prima delle spese della professione.');
  if(f&&f.net<0)warnings.push('Il netto della partita IVA è negativo: contributi minimi, imposta e costi superano i compensi. Il valore resta indicato anche se il grafico parte da zero.');
  if(f&&input.reduction==='reduced'&&!f.reduced)warnings.push('La riduzione Inarcassa richiesta non è applicata: manca il requisito giovani oppure il reddito professionale supera 49.907 €.');
  if(f&&input.reduction==='auto'&&input.period==='startup'&&input.youngEligible&&!f.reduced)warnings.push('Inarcassa intera: il reddito professionale supera il limite di 49.907 € per la riduzione giovani.');
  if(f&&input.deductible!==null&&input.deductible>f.income)warnings.push('I contributi dedotti superano il reddito forfettario: l\'imponibile sostitutivo è azzerato. Verifica i versamenti inseriti.');
  if(input.employeeCapped&&input.gross>PARAMETERS.employeeCeiling)warnings.push('Massimale INPS applicato: i contributi e il montante del dipendente sono calcolati su 122.295 €. La quota di RAL eccedente resta imponibile fiscalmente.');
  $('warnings').replaceChildren(...warnings.map(message=>{const node=document.createElement('p');node.className='notice';node.textContent=message;return node;}));
  drawChart(input,result);
}

function update() {
  const input = readInput(), result = calculate(input);
  for (const key of ['gross','employeeRate','costs','deductible','employeePensionRate','integrativeCreditRate']) {
    const message = result.valid ? undefined : result.errors[key];
    $(key).setAttribute('aria-invalid',String(Boolean(message)));
    $(`error-${key}`).hidden = !message;
    $(`error-${key}`).textContent = message || '';
  }
  $('invalid-notice').hidden = result.valid;
  $('results').hidden = !result.valid;
  $('export').disabled = !result.valid;
  if (!result.valid) { lastResult = null; return; }
  $('gross-range').value = String(input.gross);
  lastInput = input; lastResult = result;
  render(input,result);
  try { localStorage.setItem(storageKey,JSON.stringify(input)); }
  catch { $('save-status').textContent = 'Salvataggio locale non disponibile. I calcoli restano utilizzabili.'; }
}

function exportSummary() {
  if(!lastResult)return;
  const i=lastInput,e=lastResult.employee,f=lastResult.freelance;
  const numeric=n=>Number.isFinite(n)?n.toFixed(2).replace('.',','):'Non calcolato';
  const rows=[
    ['RAL - confronto annuo 2026','Dipendente','Partita IVA Inarcassa'],
    ['RAL / compensi prima del 4%',numeric(e.gross),numeric(i.gross)],
    ['Integrativo in fattura','0,00',numeric(f?.integrative)],
    ['Contributi a tuo carico',numeric(e.contributions),numeric(f?.contributions)],
    ['Imposte nette',numeric(e.taxes),numeric(f?.taxes)],
    ['Benefici fiscali aggiunti',numeric(e.benefits),'0,00'],['Costi effettivi','0,00',numeric(f?.costs)],
    ['Netto annuo',numeric(e.net),numeric(f?.net)],
    [`Media su ${i.months} mensilità`,numeric(e.monthly),numeric(f?.monthly)],
    ['Contributi pensionistici annui stimati',numeric(e.pensionAnnual),numeric(f?.pensionAnnual)],
    ['Differenza netto partita IVA meno dipendente','',numeric(lastResult.difference)],
    ['Differenza pensione partita IVA meno dipendente','',numeric(lastResult.pensionDifference)],
    [],['IPOTESI'],['Domicilio fiscale','Riva del Garda - Trentino'],['Anno fiscale','2026'],
    ['Aliquota contributi dipendente',`${numbers.format(i.employeeRate)}%`],
    ['Aliquota pensionistica dipendente',`${numbers.format(i.employeePensionRate)}%`],
    ['Massimale dipendente applicato',i.employeeCapped?'Sì: 122.295 €':'No'],
    ['Imposta sostitutiva',f?percent.format(f.taxRate):'Non simulata oltre 85.000 €'],
    ['Contribuzione Inarcassa',f?(f.reduced?'Ridotta':'Intera'):'Non simulata oltre 85.000 €'],
    ['Quota integrativo per la pensione',`${numbers.format(i.integrativeCreditRate)}%`],
    ['Requisito giovani ipotizzato',i.youngEligible?'Sì':'No'],['Modalità riduzione',i.reduction],
    ['Contributi dedotti fiscalmente',numeric(f?.deducted),i.deductible===null?'Annui stimati':'Versati inseriti'],
    ['Quota maternità/paternità provvisoria',numeric(f?.maternity)],
    ['Pensione','Incremento stimato del montante nell\'anno; prima di rivalutazioni e integrazioni figurative; non è l\'assegno pensionistico futuro.'],
    ['Limiti','Dipendente fino a 200.000 €; forfettario fino a 85.000 €; anno intero; nessun altro reddito; TFR e benefit esclusi.'],
    ['Modello','Formule del file Confronto dipendente e partita IVA.xlsx; parametri dichiarati al 21/10/2026.'],
  ];
  const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='RAL-confronto-2026.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

let initial = {...DEFAULTS};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && calculate({...DEFAULTS,...saved}).valid) initial = {...DEFAULTS,...saved};
} catch { /* Un salvataggio non disponibile o incompatibile usa l'esempio iniziale. */ }
setInputs(initial);
$('calculator').addEventListener('submit',event=>event.preventDefault());
$('calculator').addEventListener('input',update);
$('calculator').addEventListener('change',update);
$('gross-range').addEventListener('input',()=>{ $('gross').value=numbers.format(Number($('gross-range').value)); update(); });
for (const key of ['gross','employeeRate','costs','deductible','employeePensionRate','integrativeCreditRate']) $(key).addEventListener('blur',()=>{
  const value = parseItalian($(key).value,key==='deductible');
  if (value!==null && Number.isFinite(value)) {
    $(key).value=numbers.format(value);
    update();
  }
});
$('reset').addEventListener('click',()=>{ setInputs(DEFAULTS); update(); });
$('export').addEventListener('click',exportSummary);
const dialog = $('method-dialog');
for (const key of ['open-method','footer-method']) $(key).addEventListener('click',()=>dialog.showModal());
for (const key of ['close-method','done-method']) $(key).addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{ if (event.target===dialog) {
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close();
}});
update();

// Scope relativo: l'installazione resta confinata alla PWA RAL.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(error => console.warn('Supporto offline non disponibile:', error));
  });
}
