import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculate, DEFAULTS } from '../src/calculator.js';

const reference = JSON.parse(fs.readFileSync(new URL('./excel-reference.json',import.meta.url),'utf8'));
test(`${reference.cases.length} scenari confrontati con le formule Excel ricalcolate indipendentemente`,()=>{
  for(const [index,scenario] of reference.cases.entries()) {
    const actual=calculate(scenario.input);
    assert.equal(actual.valid,true,`Scenario ${index}`);
    for(const side of ['employee','freelance']) for(const [key,expected] of Object.entries(scenario[side])) {
      if(typeof expected==='boolean') assert.equal(actual[side][key],expected,`Scenario ${index}: ${side}.${key}`);
      else assert.ok(Math.abs(actual[side][key]-expected)<1e-7,`Scenario ${index}: ${side}.${key}: ${actual[side][key]} != ${expected}`);
    }
    assert.ok(Math.abs(actual.employee.monthly * scenario.input.months-actual.employee.net)<1e-7);
    assert.ok(Math.abs(actual.freelance.monthly * scenario.input.months-actual.freelance.net)<1e-7);
  }
});
test('Campione originale a 37.000 € e deducibili zero',()=>{
  const result=calculate({...DEFAULTS});
  assert.ok(Math.abs(result.employee.net-27187.404417272726)<1e-7);
  assert.ok(Math.abs(result.freelance.net-33399.15)<1e-7);
});
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
  assert.equal(calculate({...DEFAULTS,reduction:'reduced',youngEligible:false}).freelance.reduced,false);
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
  for(const patch of [{gross:NaN},{gross:-1},{gross:85001},{gross:Infinity},{costs:-1},{costs:NaN},{employeeRate:-1},{employeeRate:101},{deductible:-1},{deductible:NaN},{months:0},{months:11},{period:'altro'},{reduction:'altro'},{youngEligible:'true'}])
    assert.equal(calculate({...DEFAULTS,...patch}).valid,false,JSON.stringify(patch));
});
