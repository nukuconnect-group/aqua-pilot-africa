export interface HealthResult {
  subject?: string | null;
  isFishPhoto?: boolean;
  analysisAllowed?: boolean;
  rejectionReason?: string | null;
  species?: string | null;
  averageWeight?: number | null;
  observations: string[];
  diseases: { name: string; severity: 'low' | 'medium' | 'high'; confidence: number; description?: string; causes?: string; treatment?: string; prevention?: string }[];
  recommendations: string[];
}

const text = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(' ; ') || undefined;
  return undefined;
};
const list = (v: unknown): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).map(text).filter((s): s is string => !!s);
const severity = (v: unknown): 'low' | 'medium' | 'high' => {
  const s = String(v ?? '').toLowerCase();
  if (/high|critical|sév|élev|grave|severe/.test(s)) return 'high';
  if (/medium|moder|modér|moyen/.test(s)) return 'medium';
  return 'low';
};
const confidence = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
};
const bool = (v: unknown): boolean | undefined =>
  v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined;

/** Turns the model's JSON into a safe result; returns null when it is not an object. Missing or null fields never fail the analysis. */
export function normalizeResult(raw: unknown): HealthResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const weight = typeof r.averageWeight === 'number' && Number.isFinite(r.averageWeight) ? r.averageWeight : null;
  return {
    subject: text(r.subject) ?? null,
    isFishPhoto: bool(r.isFishPhoto),
    rejectionReason: text(r.rejectionReason) ?? null,
    species: text(r.species) ?? null,
    averageWeight: weight,
    observations: list(r.observations),
    diseases: (Array.isArray(r.diseases) ? r.diseases : [])
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
      .map(d => ({
        name: text(d.name) ?? '',
        severity: severity(d.severity),
        confidence: confidence(d.confidence),
        description: text(d.description),
        causes: text(d.causes),
        treatment: text(d.treatment),
        prevention: text(d.prevention),
      }))
      .filter(d => d.name),
    recommendations: list(r.recommendations),
  };
}

/** Extracts a JSON object from the model text, tolerating code fences or surrounding text. */
export function parseModelJson(raw: unknown): unknown {
  if (raw && typeof raw === 'object') return raw;
  const s = String(raw ?? '');
  try { return JSON.parse(s); } catch { /* try below */ }
  const match = s.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** No diagnostic is returned for an image unless actual fish were explicitly identified. */
export function enforceFishPhoto(result: HealthResult, mode: 'image' | 'species'): HealthResult {
  if (mode === 'species') return result;
  if (result.isFishPhoto === true) return { ...result, analysisAllowed: true, rejectionReason: null, averageWeight: null };
  return {
    subject: result.subject || 'Sujet non identifiable', isFishPhoto: false, analysisAllowed: false,
    rejectionReason: result.rejectionReason || 'Cette image ne montre pas de vrais poissons. L’analyse sanitaire est réservée aux photos de poissons.',
    species: null, averageWeight: null, observations: [], diseases: [], recommendations: [],
  };
}
