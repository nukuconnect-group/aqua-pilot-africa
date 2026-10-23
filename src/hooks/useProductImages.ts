import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { normalizeProductSearch } from '@/lib/posCatalog';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-product-image`;
const MAX_ROUNDS = 25; // chaque lot crée au plus 8 photos

export const productImageSlug = (name: string) =>
  normalizeProductSearch(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'produit';

/** Photos des produits : charge celles qui existent puis crée automatiquement les manquantes, par lots. */
export function useProductImages(names: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = names.join('|');
  const autoDone = useRef<string>('');

  const call = useCallback(async (generate: boolean) => {
    if (!names.length) return { error: null as string | null, generated: 0, missing: 0 };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Connexion requise', generated: 0, missing: 0 };
    const items = [...new Map(names.map(n => [productImageSlug(n), { name: n, slug: productImageSlug(n) }])).values()];
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ items, generate }),
    });
    const out = await res.json().catch(() => ({}));
    if (out?.urls) { setUrls(out.urls); setMissing(out.missing ?? 0); }
    return { error: (out?.error as string) || (res.ok ? null : 'Photos indisponibles'), generated: Number(out?.generated) || 0, missing: Number(out?.missing) || 0 };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let stop = false;
    (async () => {
      const first = await call(false);
      if (stop || !first.missing || autoDone.current === key) return;
      autoDone.current = key;
      setGenerating(true); setError(null);
      try {
        for (let round = 0; round < MAX_ROUNDS && !stop; round++) {
          const r = await call(true);
          if (r.error) { setError(r.error); break; }
          if (!r.missing || !r.generated) break;
        }
      } finally { if (!stop) setGenerating(false); }
    })();
    return () => { stop = true; };
  }, [call, key]);

  return { imageFor: (name: string) => urls[productImageSlug(name)], missing, generating, error };
}
