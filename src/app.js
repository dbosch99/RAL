import { DEFAULTS, PARAMETERS, calculate, calculateEmployee, calculateFreelance } from './calculator.js?v=ordinario-4';

import { chartData, chartLimit } from './chart.js?v=ordinario-4';

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
    ageGroup: $('ageGroup').value, registration: $('registration').value, months: Number($('months').value),
    fiscalCosts: parseItalian($('fiscalCosts').value,true),
    employeePensionRate: parseItalian($('employeePensionRate').value),
    integrativeCreditRate: parseItalian($('integrativeCreditRate').value),
    employeeCapped: $('employeeCapped').checked,
  };
}

function setInputs(input) {
  for (const key of ['gross', 'employeeRate', 'costs', 'deductible', 'employeePensionRate', 'integrativeCreditRate', 'fiscalCosts'])
    $(key).value = input[key] === null ? '' : numbers.format(input[key]);
  for (const key of ['period', 'reduction', 'months', 'ageGroup', 'registration']) $(key).value = String(input[key]);
  $('employeeCapped').checked = input.employeeCapped;
  syncGrossRange(input,true);
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

const axisNumber = value => Math.abs(value)>=1000000 ? `${numbers.format(value/1000000)} M` : Math.abs(value)>=1000 ? `${numbers.format(value/1000)}k` : numbers.format(value);

function drawChart(input,result) {
  const W=Math.min(800,Math.max(420,$('chart').clientWidth)),H=320,L=76,R=24,T=36,B=62;
  const data=chartData(input),{limit,maxY,points}=data;
  const x=n=>L+(n/limit)*(W-L-R),y=n=>T+(1-n/maxY)*(H-T-B);
  let markup=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-title plot-desc"><title id="plot-title">Netto annuo in funzione del lordo annuo</title><desc id="plot-desc">Asse orizzontale: lordo annuo in euro, da zero a ${numbers.format(limit)}. Asse verticale: netto annuo in euro, da zero. Oltre 85.000 euro la partita IVA passa all'ordinario.</desc><defs><clipPath id="plot-clip"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>`;
  for(let i=0;i<=5;i++){
    const value=maxY*(i/5);
    markup+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(value)}" y2="${y(value)}"/><text class="grid-label" text-anchor="end" x="${L-9}" y="${y(value)+3}">${axisNumber(value)}</text>`;
  }
  markup+=`<line class="axis" x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}"/>`;
  for(const value of data.ticks)markup+=`<text class="grid-label" text-anchor="middle" x="${x(value)}" y="${H-B+20}">${axisNumber(value)}</text>`;
  markup+=`<text class="axis-title" text-anchor="middle" x="${(L+W-R)/2}" y="${H-12}">Lordo annuo (€)</text><text class="axis-title" text-anchor="middle" transform="translate(15 ${(T+H-B)/2}) rotate(-90)">Netto annuo (€)</text>`;
  markup+='<g clip-path="url(#plot-clip)">';
  const path=(key,group)=>{
    let drawing='',started=false;
    for(const point of group){
      if(!Number.isFinite(point[key])){started=false;continue;}
      drawing+=`${started?'L':'M'}${x(point.gross).toFixed(2)},${y(point[key]).toFixed(2)} `;started=true;
    }
    return `<path class="${key}-line" d="${drawing}"/>`;
  };
  markup+=path('employee',points);
  // Le due curve fiscali restano separate al cambio di regime, senza interpolare il salto.
  markup+=path('freelance',points.filter(p=>p.regime==='forfait'))+path('freelance',points.filter(p=>p.regime==='ordinary'));
  markup+='</g>';
  if(PARAMETERS.forfaitLimit<limit){
    const boundary=x(PARAMETERS.forfaitLimit);
    markup+=`<line class="regime-boundary" x1="${boundary}" x2="${boundary}" y1="${T}" y2="${H-B}"/><text class="regime-label" text-anchor="middle" x="${Math.max(L+50,Math.min(W-R-50,boundary))}" y="${T-12}">85k · ordinario</text>`;
  }
  const sx=x(input.gross),lx=Math.max(L+61,Math.min(W-R-61,sx));
  markup+=`<line class="selection" x1="${sx}" x2="${sx}" y1="${T}" y2="${H-B}"/><text class="selection-label" text-anchor="middle" x="${lx}" y="${T-24}">${axisNumber(input.gross)} € lordi</text>`;
  for(const [key,color] of [['employee','#597da3'],['freelance','#21765b']]){
    const value=result[key].net;
    if(Number.isFinite(value)&&value>=0)markup+=`<circle cx="${sx}" cy="${y(value)}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;
  }
  $('chart').innerHTML=markup+'</svg>';
  $('chart-subtitle').textContent=`Da 0 a ${money(limit)}: ${input.gross>0?'cinque volte il lordo inserito':'intervallo iniziale con lordo zero'}.`;
  tableRows('chart-table-body',data.tablePoints.map(gross=>({label:money(gross),employee:calculateEmployee({...input,gross}).net,
    freelance:calculateFreelance({...input,fiscalCosts:Number.isFinite(input.fiscalCosts)?input.fiscalCosts:null,gross}).net,className:gross===input.gross?'total':''})));
}

function render(input,result) {
  const e=result.employee,f=result.freelance,ordinary=f.regime==='ordinary';
  for(const [key,value] of Object.entries({
    'employee-net':e.net,'employee-monthly':e.monthly,'employee-contributions':e.contributions,
    'employee-taxes':e.taxes,'employee-benefits':e.benefits,'employee-pension':e.pensionAnnual,
    'freelance-net':f.net,'freelance-monthly':f.monthly,'freelance-contributions':f.contributions,
    'freelance-taxes':f.taxes,'freelance-costs':f.costs,'freelance-pension':f.pensionAnnual,
  }))$(key).textContent=money(value);
  $('employee-net').classList.toggle('negative',e.net<0);
  $('freelance-net').classList.toggle('negative',f.net<0);
  $('ordinary-note').hidden=!ordinary;
  $('fiscal-costs-field').hidden=!ordinary;
  $('period').disabled=ordinary;
  $('period-help').textContent=ordinary?'Nel regime ordinario si applica l\'IRPEF, indipendentemente dagli anni di attività.':'Il 5% richiede i requisiti di nuova attività. Oltre 85.000 € si applica il regime ordinario.';
  $('tax-tag').textContent=ordinary?'Ordinario · IRPEF':`Forfettario ${percent.format(f.taxRate)}`;
  $('freelance-tax-label').textContent=ordinary?'IRPEF e addizionali':'Imposta sostitutiva';
  document.querySelectorAll('.monthly-description').forEach(node=>node.textContent=`/ mese su ${input.months} mensilità`);
  const description=(value,equal)=>Math.abs(value)<.005?equal:value>0?'In più con la partita IVA':'In più da dipendente';
  $('difference').textContent=money(Math.abs(result.difference));
  $('difference-description').textContent=description(result.difference,'Netti annui equivalenti');
  $('monthly-difference').textContent=money(Math.abs(result.difference)/input.months);
  $('pension-difference').textContent=money(Math.abs(result.pensionDifference));
  $('pension-difference-description').textContent=description(result.pensionDifference,'Contributi pensionistici equivalenti');
  $('active-reduction').textContent=`Inarcassa ${f.reduced?'ridotta':'intera'} · soggettivo ${percent.format(f.pensionRate)}`;
  $('active-deduction').textContent=`Contributi dedotti: ${money(f.deducted)}${ordinary?` · costi dedotti: ${money(f.fiscalCosts)}`:''}`;
  $('active-invoice').textContent=ordinary?`Totale fatture con 4% e IVA: ${money(f.invoiceWithVat)}`:`Totale fatturato con il 4%: ${money(f.invoice)}`;
  renderComposition('employee-composition',[['net',e.net],['contributions',e.contributions],['taxes',e.taxes]]);
  renderComposition('freelance-composition',[['net',f.net],['contributions',f.contributions],['taxes',f.taxes],['costs',f.costs]]);
  tableRows('breakdown-body',[
    {label:'RAL / compensi professionali',employee:e.gross,freelance:input.gross},
    {label:'Integrativo aggiunto in fattura',employee:'—',freelance:f.integrative,className:'secondary-row'},
    {label:'Contributi a tuo carico',employee:-e.contributions,freelance:-f.contributions},
    {label:'Imposte nette',employee:-e.taxes,freelance:-f.taxes},
    {label:'Benefici fiscali aggiunti',employee:e.benefits,freelance:'—'},
    {label:'Costi professionali effettivi',employee:'—',freelance:-f.costs},
    {label:'Netto annuo',employee:e.net,freelance:f.net,className:'total'},
    {label:`Netto medio su ${input.months} mensilità`,employee:e.monthly,freelance:f.monthly},
    {label:'Contributi pensionistici annui stimati',employee:e.pensionAnnual,freelance:f.pensionAnnual,className:'pension-total'},
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
  detailRows('freelance-detail',[
    ['Regime fiscale',ordinary?'Ordinario':'Forfettario'],['Costi fiscalmente dedotti',f.fiscalCosts],
    [ordinary?'Reddito professionale prima dei contributi':'Reddito forfettario, 78% dei compensi',f.income],
    ['Regime contributivo',f.reduced?'Ridotto':'Intero'],['Aliquota soggettivo',percent.format(f.pensionRate)],
    ['Imponibile soggettivo, con massimale',f.pensionBase],['Minimo soggettivo',f.pensionMinimum],['Soggettivo dovuto',f.pension],
    ['Integrativo addebitato, 4%',f.integrative],['Minimo integrativo',f.integrativeMinimum],['Integrativo totale da riversare',f.integrativeDue],
    ['Integrativo rimasto a tuo carico',f.integrativeOwn],['Maternità/paternità, provvisoria',f.maternity],
    ['Contributi complessivi a tuo carico',f.contributions],['Contributi dedotti fiscalmente',f.deducted],['Imponibile fiscale',f.taxable],
    ...(ordinary?[
      ['IRPEF: primo scaglione 23%',f.bracket1],['IRPEF: secondo scaglione 33%',f.bracket2],['IRPEF: terzo scaglione 43%',f.bracket3],
      ['IRPEF lorda',f.grossTax],['Detrazione lavoro autonomo',f.workDeduction],['IRPEF netta',f.netIrpef],
      ['Addizionale provinciale',f.provinceTax],['Addizionale comunale',f.municipalityTax],['IVA in fattura, esclusa dal netto',f.vat],
    ]:[['Aliquota imposta sostitutiva',percent.format(f.taxRate)],['Imposta sostitutiva',f.substituteTax]]),
    ['Totale imposte sul reddito',f.taxes],['Costi effettivi',f.costs],['Quota integrativo destinata al montante',f.integrativeCredited],
    ['Contributi pensionistici annui stimati',f.pensionAnnual],
  ]);
  const warnings=[];
  if(input.costs===0)warnings.push('Costi professionali a zero: il netto della partita IVA è prima delle spese della professione.');
  if(f.net<0)warnings.push('Il netto della partita IVA è negativo: contributi minimi, imposte e costi superano i compensi. Il valore resta indicato anche se il grafico parte da zero.');
  if(input.reduction==='reduced'&&!f.reduced)warnings.push('Riduzione Inarcassa non applicata: servono meno di 35 anni, primi cinque anni solari di iscrizione e reddito professionale entro 49.907 €.');
  if(f.youngEligible&&input.reduction!=='full'&&!f.reduced)warnings.push('Inarcassa intera: il reddito professionale supera il limite di 49.907 € per la riduzione giovani.');
  if(input.deductible!==null&&input.deductible>Math.max(0,f.income))warnings.push('I contributi dedotti superano il reddito professionale: l\'imponibile fiscale è azzerato. Verifica i versamenti inseriti.');
  if(input.employeeCapped&&input.gross>PARAMETERS.employeeCeiling)warnings.push('Massimale INPS applicato: contributi e montante del dipendente stimati su 122.295 €. Le contribuzioni minori sull\'eccedenza non sono simulate separatamente.');
  $('warnings').replaceChildren(...warnings.map(message=>{const node=document.createElement('p');node.className='notice';node.textContent=message;return node;}));
  drawChart(input,result);
}

function syncGrossRange(input,resize=false) {
  const range=$('gross-range');
  if(resize||input.gross>Number(range.max))range.max=String(Math.max(200000,chartLimit(input.gross)));
  range.value=String(input.gross);
  $('range-maximum').textContent=money(Number(range.max));
}

function update() {
  const input = readInput(), result = calculate(input);
  for (const key of ['gross','employeeRate','costs','deductible','employeePensionRate','integrativeCreditRate','fiscalCosts']) {
    const message = result.valid ? undefined : result.errors[key];
    $(key).setAttribute('aria-invalid',String(Boolean(message)));
    $(`error-${key}`).hidden = !message;
    $(`error-${key}`).textContent = message || '';
  }
  $('invalid-notice').hidden = result.valid;
  $('results').hidden = !result.valid;
  $('export').disabled = !result.valid;
  if (!result.valid) { lastResult = null; return; }
  syncGrossRange(input);
  lastInput = input; lastResult = result;
  render(input,result);
  try { localStorage.setItem(storageKey,JSON.stringify(input)); }
  catch { $('save-status').textContent = 'Salvataggio locale non disponibile. I calcoli restano utilizzabili.'; }
}

function exportSummary() {
  if(!lastResult)return;
  const i=lastInput,e=lastResult.employee,f=lastResult.freelance,ordinary=f.regime==='ordinary';
  const numeric=n=>Number.isFinite(n)?n.toFixed(2).replace('.',','):'';
  const rows=[
    ['RAL - confronto annuo 2026','Dipendente','Partita IVA Inarcassa'],
    ['Regime fiscale','IRPEF',ordinary?'Ordinario IRPEF':`Forfettario ${percent.format(f.taxRate)}`],
    ['RAL / compensi prima del 4%',numeric(e.gross),numeric(i.gross)],
    ['Integrativo in fattura','0,00',numeric(f.integrative)],['IVA in fattura, esclusa dal netto','0,00',numeric(f.vat)],
    ['Contributi a tuo carico',numeric(e.contributions),numeric(f.contributions)],['Imposte nette',numeric(e.taxes),numeric(f.taxes)],
    ['Benefici fiscali aggiunti',numeric(e.benefits),'0,00'],['Costi effettivi','0,00',numeric(f.costs)],
    ['Costi fiscalmente dedotti','0,00',numeric(f.fiscalCosts)],['Netto annuo',numeric(e.net),numeric(f.net)],
    [`Media su ${i.months} mensilità`,numeric(e.monthly),numeric(f.monthly)],
    ['Contributi pensionistici annui stimati',numeric(e.pensionAnnual),numeric(f.pensionAnnual)],
    ['Differenza netto partita IVA meno dipendente','',numeric(lastResult.difference)],
    ['Differenza pensione partita IVA meno dipendente','',numeric(lastResult.pensionDifference)],
    [],['IPOTESI'],['Domicilio fiscale','Riva del Garda - Trentino'],['Anno fiscale','2026'],
    ['Fascia di età',i.ageGroup==='under35'?'Meno di 35 anni':'35 anni o più'],
    ['Anzianità Inarcassa',i.registration==='first5'?'Primi 5 anni solari':'Oltre i primi 5 anni'],
    ['Aliquota contributi dipendente',`${numbers.format(i.employeeRate)}%`],
    ['Aliquota pensionistica dipendente',`${numbers.format(i.employeePensionRate)}%`],['Massimale dipendente applicato',i.employeeCapped?'Sì: 122.295 €':'No'],
    ['Contribuzione Inarcassa',f.reduced?'Ridotta':'Intera'],['Quota integrativo per la pensione',`${numbers.format(i.integrativeCreditRate)}%`],
    ['Contributi dedotti fiscalmente',numeric(f.deducted),i.deductible===null?'Annui stimati':'Versati inseriti'],
    ['Quota maternità/paternità provvisoria',numeric(f.maternity)],
    ['Pensione','Incremento stimato del montante nell\'anno; prima di rivalutazioni e integrazioni figurative; non è l\'assegno pensionistico futuro.'],
    ['Ipotesi','Nessun massimo applicativo; forfettario fino a 85.000 € inclusi, ordinario oltre; anno intero a regime; nessun altro reddito; TFR e benefit esclusi.'],
    ['Modello','Formule del file Confronto dipendente e partita IVA.xlsx aggiornato al 26/10/2026.'],
  ];
  const csv='\ufeff'+rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='RAL-confronto-2026.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

let initial = {...DEFAULTS};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if(saved){
    const migrated={...DEFAULTS,...saved,ageGroup:saved.ageGroup??(saved.youngEligible===false?'35plus':'under35'),
      registration:saved.registration??(saved.period==='ordinary'&&saved.reduction!=='reduced'?'later':'first5')};
    if(calculate(migrated).valid)initial=migrated;
  }
} catch { /* Un salvataggio non disponibile o incompatibile usa l'esempio iniziale. */ }
setInputs(initial);
$('calculator').addEventListener('submit',event=>event.preventDefault());
$('calculator').addEventListener('input',event=>{if(event.target.id!=='gross-range')update();});
$('calculator').addEventListener('change',update);
$('gross-range').addEventListener('input',()=>{ $('gross').value=numbers.format(Number($('gross-range').value)); update(); });
for (const key of ['gross','employeeRate','costs','deductible','employeePensionRate','integrativeCreditRate','fiscalCosts']) $(key).addEventListener('blur',()=>{
  const value = parseItalian($(key).value,key==='deductible'||key==='fiscalCosts');
  if (value!==null && Number.isFinite(value)) {
    $(key).value=numbers.format(value);
    if(key==='gross')syncGrossRange(readInput(),true);
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
window.addEventListener('resize',()=>{if(lastResult)drawChart(lastInput,lastResult);});

// Scope relativo: l'installazione resta confinata alla PWA RAL.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .catch(error => console.warn('Supporto offline non disponibile:', error));
  });
}
