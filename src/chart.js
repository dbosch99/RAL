import { PARAMETERS, calculateEmployee, calculateFreelance } from './calculator.js?v=ordinario-4';

export const chartLimit = gross => gross > 0 ? Math.min(Number.MAX_VALUE,gross*5) : 50000;
export function niceCeiling(value) {
  if (!(value > 0) || !Number.isFinite(value)) return 1;
  const power=10**Math.floor(Math.log10(value)),fraction=value/power;
  return (fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power;
}

// Il numero di campioni resta costante anche con importi molto grandi.
export function chartData(input) {
  input={...input,fiscalCosts:Number.isFinite(input.fiscalCosts)?input.fiscalCosts:null};
  const limit=chartLimit(input.gross),samples=new Set(Array.from({length:401},(_,i)=>limit*(i/400)));
  const add=value=>{if(Number.isFinite(value)&&value>=0&&value<=limit)samples.add(value);};
  const around=value=>{add(value);add(value-.01);add(value+.01);};
  const rate=input.employeeRate/100;
  const forTaxable=taxable=>{
    const cap=PARAMETERS.employeeCeiling;
    const atCap=cap*rate+Math.max(0,cap-PARAMETERS.extraContributionThreshold)*PARAMETERS.extraContributionRate;
    if(input.employeeCapped&&taxable>cap-atCap)return taxable+atCap;
    const basic=taxable/(1-rate);
    return basic<=PARAMETERS.extraContributionThreshold?basic
      :(taxable-PARAMETERS.extraContributionThreshold*PARAMETERS.extraContributionRate)/(1-rate-PARAMETERS.extraContributionRate);
  };
  for(const threshold of [8500,15000,20000,25000,28000,30000,32000,35000,40000,50000])around(forTaxable(threshold));
  const fiscalCosts=input.fiscalCosts??input.costs;
  for(const threshold of [5500,11000,17000,28000,30000,49907,50000,PARAMETERS.pensionCeiling])around(fiscalCosts+threshold);
  for(const value of [input.gross,PARAMETERS.forfaitLimit,PARAMETERS.youngIncomeLimit/PARAMETERS.profitability,
    PARAMETERS.employeeCeiling,PARAMETERS.extraContributionThreshold,PARAMETERS.pensionCeiling,PARAMETERS.integrativePensionCeiling,
    input.costs,PARAMETERS.pensionMinimum/PARAMETERS.profitability/PARAMETERS.pensionRate,
    PARAMETERS.pensionMinimum/3/PARAMETERS.profitability/PARAMETERS.youngPensionRate])around(value);
  // Nel regime ordinario le soglie fiscali sono applicate al reddito dopo i contributi.
  const taxableAt=gross=>calculateFreelance({...input,gross}).taxable;
  if(limit>PARAMETERS.forfaitLimit)for(const threshold of [28000,30000,50000]){
    let low=PARAMETERS.forfaitLimit+.01,high=limit;
    if(taxableAt(low)>threshold||taxableAt(high)<threshold)continue;
    for(let i=0;i<48;i++){const mid=low+(high-low)/2;if(taxableAt(mid)<threshold)low=mid;else high=mid;}
    around(high);
  }
  const points=[...samples].sort((a,b)=>a-b).map(gross=>({gross,
    employee:calculateEmployee({...input,gross}).net,freelance:calculateFreelance({...input,gross}).net,
    regime:gross<=PARAMETERS.forfaitLimit?'forfait':'ordinary'}));
  const values=points.flatMap(p=>[p.employee,p.freelance]).filter(Number.isFinite);
  const maxY=niceCeiling(Math.max(1,...values)*1.02);
  const ticks=Array.from({length:6},(_,i)=>limit*(i/5));
  const tablePoints=[...new Set([...ticks,input.gross,...[30000,85000,100000,200000].filter(n=>n<=limit)])].sort((a,b)=>a-b);
  return {limit,maxY,ticks,points,tablePoints};
}
