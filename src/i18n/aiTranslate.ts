/**
 * Traduction de secours des textes non couverts par le dictionnaire local.
 * Utilise la fonction edge `translate-ui` puis met en cache le résultat.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/translate-ui`;
const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? '';
const CACHE_KEY = 'ui-translation-cache-en';

let cache: Record<string, string> = {};
let loaded = false;
const pending = new Set<string>();
const failed = new Set<string>();
let timer: number | null = null;
let listeners: Array<() => void> = [];

const loadCache = () => {
  if (loaded) return;
  loaded = true;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    cache = {};
  }
};

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota */
  }
};

export const onTranslationsReady = (cb: () => void) => {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
};

const flush = async () => {
  timer = null;
  const batch = Array.from(pending).slice(0, 60);
  batch.forEach((t) => pending.delete(t));
  if (batch.length === 0 || !FUNCTIONS_URL.startsWith('http')) return;

  try {
    const res = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ texts: batch, target: 'en' }),
    });
    const data = await res.json();
    const translations: string[] = data?.translations ?? [];
    let changed = false;
    batch.forEach((source, i) => {
      const value = translations[i];
      if (typeof value === 'string' && value.trim() && value !== source) {
        cache[source] = value;
        changed = true;
      } else {
        failed.add(source);
      }
    });
    if (changed) {
      saveCache();
      listeners.forEach((l) => l());
    }
  } catch {
    batch.forEach((t) => failed.add(t));
  }
  if (pending.size > 0 && timer === null) timer = window.setTimeout(flush, 800);
};

/** Renvoie la traduction en cache, ou la met en file d'attente pour traduction. */
export const aiTranslate = (text: string): string | null => {
  loadCache();
  const key = text.trim();
  if (!key || key.length < 3 || key.length > 400) return null;
  if (cache[key]) return cache[key];
  if (failed.has(key) || pending.has(key)) return null;
  pending.add(key);
  if (timer === null) timer = window.setTimeout(flush, 500);
  return null;
};
