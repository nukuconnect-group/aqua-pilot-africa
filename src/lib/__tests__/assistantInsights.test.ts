import {expect,it} from 'vitest';
import {configuredWaterAlerts,latestUnitControl,rankInsightAlerts,sumUnitRecorded} from '../assistantInsights';
const record={id:'r',unit_id:'u',date:'2026-10-25',oxygen:3,ph:7,temperature:25};
it('uses the latest measured control of the selected unit, not another unit',()=>{
  expect(latestUnitControl([record,{...record,id:'other',unit_id:'other',date:'2026-10-26'},{...record,id:'old',date:'2026-10-24'}],'u')?.id).toBe('r');
});
it('never creates water alerts without recorded thresholds',()=>expect(configuredWaterAlerts(record,null)).toEqual([]));
it('uses the configured critical oxygen threshold and records source/date',()=>{
 const alerts=configuredWaterAlerts(record,{oxygen_enabled:true,oxygen_warning:5,oxygen_critical:3});
 expect(alerts[0]?.severity).toBe('critical');expect(alerts[0]?.date).toBe('2026-10-25');expect(alerts[0]?.source).toContain('seuils enregistrés');
});
it('respects disabled parameters',()=>expect(configuredWaterAlerts(record,{oxygen_enabled:false,oxygen_warning:5,oxygen_critical:4})).toEqual([]));
it('ignores absent values rather than converting them to zero',()=>expect(configuredWaterAlerts({...record,oxygen:null},{oxygen_enabled:true,oxygen_warning:5,oxygen_critical:4})).toEqual([]));
it('distinguishes warning from critical using the saved limit',()=>expect(configuredWaterAlerts({...record,oxygen:4.5},{oxygen_enabled:true,oxygen_warning:5,oxygen_critical:3})[0]?.severity).toBe('warning'));
it('ranks critical, attention and information',()=>{
 const base={id:'x',title:'x',date:'2026-10-25',source:'x',message:'x',recommendation:'x'};
 expect(rankInsightAlerts([{...base,severity:'information'},{...base,severity:'critical'},{...base,severity:'warning'}]).map(a=>a.severity)).toEqual(['critical','warning','information']);
});
it('totals actual feeding only in the selected unit and day',()=>{
 expect(sumUnitRecorded([{unit_id:'u',date:'2026-10-25',quantity:8},{unit_id:'other',date:'2026-10-25',quantity:100},{unit_id:'u',date:'2026-10-24',quantity:50}],'u','2026-10-25','2026-10-25','quantity')).toBe(8);
});