import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { normalizeProductSearch } from '@/lib/posCatalog';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-product-image`;

export const productImageSlug = (name: string) =>
  normalizeProductSearch(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'produit';

/** Photos des produits de caisse : charge celles qui existent, génère les manquantes sur demande. */
export function useProductImages(names: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(0);
  const [generating, setGenerating] = useState(false);
  const key = names.join('|');

  const call = useCallback(async (generate: boolean) => {
    if (!names.length) return { error: null as string | null };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Connexion requise' };
    const items = [...new Map(names.map(n => [productImageSlug(n), { name: n, slug: productImageSlug(n) }])).values()];
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ items, generate }),
    });
    const out = await res.json().catch(() => ({}));
    if (out?.urls) { setUrls(out.urls); setMissing(out.missing ?? 0); }
    return { error: (out?.error as string) || (res.ok ? null : 'Photos indisponibles') };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { call(false); }, [call]);

  const generateMissing = async () => {
    setGenerating(true);
    try { return await call(true); } finally { setGenerating(false); }
  };

  return { imageFor: (name: string) => urls[productImageSlug(name)], missing, generating, generateMissing };
}
