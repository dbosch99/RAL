import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, DEFAULTS } from '../src/calculator.js';

test('Vuoto e zero nei contributi deducibili restano distinti',()=>{
  const zero=calculate({...DEFAULTS,deductible:0});
  const blank=calculate({...DEFAULTS,deductible:null});
  assert.equal(zero.freelance.deducted,0);
  assert.equal(blank.freelance.deducted,blank.freelance.contributions);
  assert.equal(zero.freelance.contributions,blank.freelance.contributions);
  assert.ok(blank.freelance.net>zero.freelance.net);
});
test('Aliquota fiscale e riduzione Inarcassa indipendenti',()=>{
  assert.equal(calculate({...DEFAULTS,period:'ordinary',reduction:'reduced'}).freelance.reduced,true);
  assert.equal(calculate({...DEFAULTS,period:'startup',reduction:'full'}).freelance.reduced,false);
  assert.equal(calculate({...DEFAULTS,reduction:'reduced',ageGroup:'35plus'}).freelance.reduced,false);
  assert.equal(calculate({...DEFAULTS,registration:'later'}).freelance.reduced,false);
  assert.equal(calculate({...DEFAULTS,period:'ordinary',registration:'first5'}).freelance.reduced,true);
  assert.equal(calculate({...DEFAULTS,gross:65000,reduction:'reduced'}).freelance.reduced,false);
});
test('Costi e integrativo non vengono sottratti due volte',()=>{
  const a=calculate({...DEFAULTS}),b=calculate({...DEFAULTS,costs:1234});
  assert.equal(a.freelance.taxes,b.freelance.taxes);
  assert.ok(Math.abs(a.freelance.net-b.freelance.net-1234)<1e-7);
  assert.equal(a.freelance.integrative,1480);
  assert.equal(a.freelance.integrativeOwn,0);
  assert.equal(a.freelance.invoice,38480);
});
test('Dati mancanti, non finiti, negativi o fuori campo non producono un netto',()=>{
  for(const patch of [{gross:NaN},{gross:-1},{gross:Infinity},{costs:-1},{costs:NaN},{employeeRate:-1},{employeeRate:101},{deductible:-1},{deductible:NaN},{months:0},{months:11},{period:'altro'},{reduction:'altro'},{ageGroup:'altro'},{registration:'altro'},{employeePensionRate:NaN},{employeePensionRate:101},{integrativeCreditRate:-1},{integrativeCreditRate:Infinity},{employeeCapped:'true'},{gross:100000,fiscalCosts:-1},{gross:100000,fiscalCosts:NaN}])
    assert.equal(calculate({...DEFAULTS,...patch}).valid,false,JSON.stringify(patch));
});

test('Il montante comprende il totale pensionistico e la quota integrativa accreditata',()=>{
  const r=calculate({...DEFAULTS,gross:42000});
  assert.equal(r.employee.pensionAnnual,13860);
  assert.equal(r.freelance.pension,2375.1);
  assert.equal(r.freelance.integrativeCredited,840);
  assert.equal(r.freelance.pensionAnnual,3215.1);
  assert.equal(r.pensionDifference,-10644.9);
  const changed=calculate({...DEFAULTS,gross:42000,costs:4000,deductible:null});
  assert.equal(changed.freelance.pensionAnnual,r.freelance.pensionAnnual);
  assert.equal(calculate({...DEFAULTS,gross:42000,reduction:'full'}).freelance.pensionAnnual,5590.2);
  assert.equal(calculate({...DEFAULTS,gross:0}).freelance.pensionAnnual,1070);
});

test('Le aliquote pensionistiche sono regolabili e separate dal netto',()=>{
  const base=calculate({...DEFAULTS,gross:42000});
  const changed=calculate({...DEFAULTS,gross:42000,employeePensionRate:30,integrativeCreditRate:43.75});
  assert.equal(changed.employee.pensionAnnual,12600);
  assert.equal(changed.freelance.pensionAnnual,3110.1);
  assert.equal(changed.employee.net,base.employee.net);
  assert.equal(changed.freelance.net,base.freelance.net);
});

test('Il regime passa all ordinario oltre 85.000 euro senza interrompere il confronto',()=>{
  assert.ok(calculate({...DEFAULTS,gross:85000}).freelance);
  const over=calculate({...DEFAULTS,gross:85000.01});
  assert.equal(over.valid,true);
  assert.equal(over.freelance.regime,'ordinary');
  assert.ok(Number.isFinite(over.difference));
  assert.ok(Number.isFinite(over.pensionDifference));
  assert.equal(calculate({...DEFAULTS,gross:85000}).freelance.regime,'forfait');
  const high=calculate({...DEFAULTS,gross:200000});
  const cap=calculate({...DEFAULTS,gross:122295});
  assert.equal(high.valid,true);
  assert.equal(high.employee.pensionAnnual,40357.35);
  assert.equal(high.employee.contributions,cap.employee.contributions);
  assert.ok(Math.abs(high.employee.taxable-cap.employee.taxable-(200000-122295))<1e-7);
  assert.ok(Number.isFinite(high.employee.net));
  const uncapped=calculate({...DEFAULTS,gross:200000,employeeCapped:false});
  assert.equal(uncapped.employee.pensionAnnual,66000);
  assert.ok(uncapped.employee.contributions>high.employee.contributions);
});

test('Costi deducibili, contributi personali e IVA hanno ruoli distinti nell ordinario',()=>{
  const r=calculate({...DEFAULTS,gross:100000,costs:20000,fiscalCosts:8000,deductible:12000,ageGroup:'35plus'}).freelance;
  assert.equal(r.income,92000);
  assert.equal(r.pension,13340);
  assert.equal(r.taxable,80000);
  assert.equal(r.netIrpef,26600);
  assert.equal(r.provinceTax,1134);
  assert.equal(r.taxes,27734);
  assert.equal(r.net,38860.5);
  assert.equal(r.invoice,104000);
  assert.equal(r.vat,22880);
  assert.equal(r.invoiceWithVat,126880);
  const blank=calculate({...DEFAULTS,gross:100000,costs:20000,fiscalCosts:null,deductible:null}).freelance;
  assert.equal(blank.fiscalCosts,20000);
  assert.equal(blank.deducted,blank.contributions);
  const zero=calculate({...DEFAULTS,gross:100000,costs:20000,fiscalCosts:0}).freelance;
  assert.equal(zero.income,100000);
  assert.ok(zero.taxes>blank.taxes);
});

test('Età, prima iscrizione e reddito sono necessari anche con riduzione richiesta manualmente',()=>{
  for(const patch of [{ageGroup:'35plus'},{registration:'later'},{costs:50092.99}])
    assert.equal(calculate({...DEFAULTS,gross:100000,costs:50093,reduction:'reduced',...patch}).freelance.reduced,false);
  assert.equal(calculate({...DEFAULTS,gross:100000,costs:50093}).freelance.reduced,true);
  assert.equal(calculate({...DEFAULTS,gross:100000,costs:50093,period:'ordinary'}).freelance.reduced,true);
});

test('Gli importi elevati restano calcolabili e i massimali limitano soltanto i contributi',()=>{
  for(const gross of [200001,500000,1000000,10000000]){
    const r=calculate({...DEFAULTS,gross});
    assert.equal(r.valid,true);
    assert.equal(r.freelance.pension,21358.5);
    assert.equal(r.freelance.integrativeCredited,3872);
    assert.equal(r.freelance.pensionAnnual,25230.5);
    assert.equal(r.employee.pensionAnnual,40357.35);
    assert.ok(Number.isFinite(r.employee.net)&&Number.isFinite(r.freelance.net));
    assert.ok(Math.abs(r.freelance.net-(gross-r.freelance.contributions-r.freelance.taxes))<1e-6);
  }
});

test('Bilancio del lordo e media mensile su un esempio generico',()=>{
  for(const months of [12,13,14]) {
    const r=calculate({...DEFAULTS,gross:42000,months,costs:1800});
    assert.ok(Math.abs(r.employee.net-(42000-r.employee.contributions-r.employee.taxes+r.employee.benefits))<1e-7);
    assert.ok(Math.abs(r.freelance.net-(42000-r.freelance.contributions-r.freelance.taxes-1800))<1e-7);
    assert.ok(Math.abs(r.employee.monthly*months-r.employee.net)<1e-7);
    assert.ok(Math.abs(r.freelance.monthly*months-r.freelance.net)<1e-7);
  }
});
