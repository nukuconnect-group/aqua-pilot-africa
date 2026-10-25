import {expect,it} from 'vitest';
import {buildFarmContext} from '../../../supabase/functions/aqua-assistant/farmContext';
function database(unit:any, failures:string[]=[]) {
 const calls:{table:string;column:string;value:unknown}[]=[];
 const db={from:(table:string)=>{
   const q:any={select:()=>q,eq:(column:string,value:unknown)=>{calls.push({table,column,value});return q;},in:(column:string,value:unknown)=>{calls.push({table,column,value});return q;},gte:()=>q,lte:()=>q,order:()=>q,limit:()=>q,
     then:(resolve:any)=>resolve({data:table==='production_units'?(unit?[unit]:[]):[],error:failures.includes(table)?{message:'unavailable'}:null})};return q;
 }};return {db,calls};
}
it('refuses a unit that the authenticated user cannot read',async()=>{
 const {db}=database(null);await expect(buildFarmContext(db,'u')).rejects.toThrow('Unité inaccessible');
});
it('scopes every source including cycles to the actual accessible IDs',async()=>{
 const {db,calls}=database({id:'u',name:'Unité réelle',type:'grossissement',user_id:'owner'});
 await buildFarmContext(db,'u');expect(calls.find(c=>c.table==='production_cycles'&&c.column==='unit_id')?.value).toEqual(['u']);
});
it('does not fetch feeding or fish health in a commercial unit',async()=>{
 const {db,calls}=database({id:'u',name:'Commerce',type:'commercialisation',user_id:'owner'});
 await buildFarmContext(db,'u');expect(calls.some(c=>c.table==='feeding_records'||c.table==='health_records'||c.table==='production_cycles')).toBe(false);
});
it('marks unavailable sales as null rather than inventing zero revenue',async()=>{
 const {db}=database({id:'u',name:'Commerce',type:'commercialisation',user_id:'owner'},['sales']);
 const text=await buildFarmContext(db,'u');expect(text).toContain('"chiffre_affaires":null');expect(text).toContain('"sources_indisponibles":["ventes"]');
});