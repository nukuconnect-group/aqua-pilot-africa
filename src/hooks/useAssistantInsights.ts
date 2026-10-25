import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { configuredWaterAlerts, latestUnitControl, rankInsightAlerts, InsightAlert, InsightHealth } from '@/lib/assistantInsights';
import { stocksForUnitType } from '@/lib/stockPurpose';
import { format, subDays } from 'date-fns';

export function useAssistantInsights(unitId: string | null) {
  const {user,isDemoMode}=useAuth();
  const {units}=useProductionUnits();
  const unit=units.find(u=>u.id===unitId);
  const commercial=unit?.type==='commercialisation';
  return useQuery({queryKey:['assistant-insights',user?.id,unitId,unit?.type],enabled:Boolean(user?.id&&unitId&&!isDemoMode),staleTime:60000,
    queryFn:async()=>{
      if (!unitId) throw new Error('Unité requise');
      const db=supabase as any;
      const from=format(subDays(new Date(),30),'yyyy-MM-dd');
      const requests: Record<string,any>={
        infrastructures:db.from('unit_infrastructures').select('id,name,status,unit_id,type').eq('unit_id',unitId),
        stocks:db.from('feed_stocks').select('*').eq('unit_id',unitId),
        alerts:db.from('performance_alerts').select('*').eq('unit_id',unitId).eq('is_acknowledged',false).order('created_at',{ascending:false}).limit(50),
      };
      if(!commercial) Object.assign(requests,{
        cycles:db.from('production_cycles').select('id,name,species,status,current_quantity,unit_id,start_date').eq('unit_id',unitId),
        batches:db.from('livestock_batches').select('id,species,quantity,status,unit_id').eq('unit_id',unitId),
        health:db.from('health_records').select('id,unit_id,date,temperature,oxygen,ph,mortality').eq('unit_id',unitId).gte('date',from).order('date',{ascending:false}),
        feeding:db.from('feeding_records').select('id,unit_id,date,quantity,mortality').eq('unit_id',unitId).gte('date',from),
        thresholds:db.from('performance_alert_thresholds').select('*').eq('user_id',unit?.userId||user?.id).maybeSingle(),
      });
      const responses=await Promise.all(Object.entries(requests).map(async([name,q])=>({name,...await q})));
      const raw=Object.fromEntries(responses.map(r=>[r.name,r.error?null:r.data]));
      const unavailable=responses.filter(r=>r.error).map(r=>r.name);
      const truncated=responses.filter(r=>Array.isArray(r.data)&&r.data.length>=1000).map(r=>r.name);
      const control=latestUnitControl((raw.health||[]) as InsightHealth[],unitId);
      const saved:InsightAlert[]=(raw.alerts||[]).filter((a:any)=>!commercial||!['fcr','mortality','temperature','oxygen','ph','production'].some(k=>String(a.alert_type).includes(k))).map((a:any)=>({id:a.id,title:a.title,message:a.message,severity:['critical','warning'].includes(a.severity)?a.severity:'information',date:a.created_at,source:`Alertes de performance${a.cycle_name?` · ${a.cycle_name}`:''}`,recommendation:typeof a.metadata?.recommendation==='string'?a.metadata.recommendation:'Examinez le relevé source avec le responsable et confirmez la situation actuelle avant d’intervenir.'}));
      const water=configuredWaterAlerts(control,raw.thresholds);
      return {...raw,stocks:raw.stocks?stocksForUnitType(raw.stocks,unit?.type):null,control,alerts:rankInsightAlerts([...saved,...water.filter(w=>!saved.some(a=>a.title===w.title&&a.date.slice(0,10)===w.date))]),unavailable,truncated,commercial};
    },
  });
}