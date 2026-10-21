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