import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS} from '../src/calculator.js';
import {chartData,chartLimit} from '../src/chart.js';

test('Il grafico arriva a cinque volte il lordo, con intervallo leggibile anche a zero',()=>{
  for(const gross of [1,30000,100000,500000,10000000]){
    const data=chartData({...DEFAULTS,gross});
    assert.equal(data.limit,gross*5);
    assert.equal(data.ticks[0],0);
    assert.equal(data.ticks.at(-1),data.limit);
    assert.ok(data.points.some(p=>p.gross===gross));
    assert.ok(data.points.every(p=>p.gross>=0&&p.gross<=data.limit));
    assert.ok(data.points.length<1000);
    assert.ok(data.maxY>0&&Number.isFinite(data.maxY));
  }
  assert.equal(chartLimit(0),50000);
});

test('Le curve continuano nell ordinario e includono entrambi i lati della soglia',()=>{
  const data=chartData({...DEFAULTS,gross:100000});
  assert.ok(data.points.some(p=>p.gross===85000&&p.regime==='forfait'));
  assert.ok(data.points.some(p=>p.gross===85000.01&&p.regime==='ordinary'));
  assert.ok(data.points.filter(p=>p.gross>85000).every(p=>Number.isFinite(p.freelance)));
  assert.ok(data.tablePoints.every(p=>p<=data.limit));
});

test('I netti negativi restano nei dati mentre l asse verticale parte da zero',()=>{
  const data=chartData({...DEFAULTS,gross:0});
  assert.ok(data.points.some(p=>p.freelance<0));
  assert.equal(data.ticks[0],0);
});
