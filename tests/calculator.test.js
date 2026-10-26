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

test('Bilancio del lordo e media mensile su un esempio generico',()=>{
  for(const months of [12,13,14]) {
    const r=calculate({...DEFAULTS,gross:42000,months,costs:1800});
    assert.ok(Math.abs(r.employee.net-(42000-r.employee.contributions-r.employee.taxes+r.employee.benefits))<1e-7);
    assert.ok(Math.abs(r.freelance.net-(42000-r.freelance.contributions-r.freelance.taxes-1800))<1e-7);
    assert.ok(Math.abs(r.employee.monthly*months-r.employee.net)<1e-7);
    assert.ok(Math.abs(r.freelance.monthly*months-r.freelance.net)<1e-7);
  }
});
