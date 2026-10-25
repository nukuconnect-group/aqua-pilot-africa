export type InsightSeverity = 'critical' | 'warning' | 'information';
export interface InsightAlert { id: string; title: string; severity: InsightSeverity; source: string; date: string; recommendation: string; message: string }
export interface InsightHealth { id: string; unit_id: string; date: string; temperature?: number | null; oxygen?: number | null; ph?: number | null; mortality?: number | null }
export function latestUnitControl(rows: InsightHealth[], unitId: string) {
  return rows.filter(r => r.unit_id === unitId && [r.temperature, r.ph, r.oxygen].some(v=>typeof v==='number' && Number.isFinite(v))).sort((a,b)=>b.date.localeCompare(a.date))[0];
}
/** Only saved thresholds; never infer species-specific safety from generic defaults. */
export function configuredWaterAlerts(record: InsightHealth | undefined, thresholds: Record<string, unknown> | null): InsightAlert[] {
  if (!record || !thresholds) return [];
  const alerts: InsightAlert[] = [];
  const finite = (key: string) => typeof thresholds[key] === 'number' && Number.isFinite(thresholds[key]);
  const check = (param: 'temperature' | 'ph' | 'oxygen', name: string, unit: string, enabled: string, bounds: { lowWarning?: string; lowCritical?: string; highWarning?: string; highCritical?: string }) => {
    const value=record[param];
    if (thresholds[enabled] !== true || typeof value !== 'number' || !Number.isFinite(value)) return;
    const below=(key?:string)=>key && finite(key) && value <= Number(thresholds[key]);
    const above=(key?:string)=>key && finite(key) && value >= Number(thresholds[key]);
    const critical=below(bounds.lowCritical)||above(bounds.highCritical);
    const warning=below(bounds.lowWarning)||above(bounds.highWarning);
    if (!critical && !warning) return;
    alerts.push({id:`${record.id}-${param}`,title:`${name} hors seuil configuré`,severity:critical?'critical':'warning',source:'Relevé de qualité de l’eau · seuils enregistrés',date:record.date,message:`${name} : ${value.toLocaleString('fr-FR')} ${unit}`,recommendation:param==='oxygen'?'Recontrôlez la mesure, vérifiez l’aération et observez les poissons. Contactez le responsable si la valeur reste anormale.':'Recontrôlez avec un appareil vérifié et examinez l’évolution avec le responsable. Ne traitez pas l’eau sans confirmer la cause.'});
  };
  check('temperature','Température','°C','temp_enabled',{lowWarning:'temp_min_warning',lowCritical:'temp_min_critical',highWarning:'temp_max_warning',highCritical:'temp_max_critical'});
  check('ph','pH','','ph_enabled',{lowWarning:'ph_min_warning',lowCritical:'ph_min_critical',highWarning:'ph_max_warning',highCritical:'ph_max_critical'});
  check('oxygen','Oxygène','mg/L','oxygen_enabled',{lowWarning:'oxygen_warning',lowCritical:'oxygen_critical'});
  return alerts;
}
export function rankInsightAlerts(alerts: InsightAlert[]) {
  const order={critical:0,warning:1,information:2};
  return [...alerts].sort((a,b)=>order[a.severity]-order[b.severity]||b.date.localeCompare(a.date));
}
export function sumUnitRecorded(rows: {unit_id:string;date:string;[key:string]:unknown}[], unitId:string, start:string,end:string,key:string) {
  return rows.filter(r=>r.unit_id===unitId&&r.date>=start&&r.date<=end).reduce((sum,r)=>sum+(typeof r[key]==='number'&&Number.isFinite(r[key])?Number(r[key]):0),0);
}