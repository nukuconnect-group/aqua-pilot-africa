/**
 * Traduction de secours des textes non couverts par le dictionnaire local.
 * Utilise la fonction edge `translate-ui` puis met en cache le résultat.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/translate-ui`;
const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ?? '';
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', pt: 'Portuguese', ar: 'Arabic',
  ewe: 'Ewe', kabye: 'Kabiye', adja: 'Adja', wolof: 'Wolof', bambara: 'Bambara',
};

const cacheKeyFor = (lang: string) => `ui-translation-cache-${lang}`;

const caches: Record<string, Record<string, string>> = {};
const pendingByLang: Record<string, Set<string>> = {};
const failedByLang: Record<string, Set<string>> = {};
const timers: Record<string, number | null> = {};
let listeners: Array<() => void> = [];

const cacheFor = (lang: string): Record<string, string> => {
  if (!caches[lang]) {
    try {
      caches[lang] = JSON.parse(localStorage.getItem(cacheKeyFor(lang)) || '{}');
    } catch {
      caches[lang] = {};
    }
  }
  return caches[lang];
};

const pendingFor = (lang: string) => (pendingByLang[lang] ||= new Set<string>());
const failedFor = (lang: string) => (failedByLang[lang] ||= new Set<string>());

const saveCache = (lang: string) => {
  try {
    localStorage.setItem(cacheKeyFor(lang), JSON.stringify(cacheFor(lang)));
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

const flush = async (lang: string) => {
  timers[lang] = null;
  const pending = pendingFor(lang);
  const failed = failedFor(lang);
  const cache = cacheFor(lang);
  const batch = Array.from(pending).slice(0, 60);
  batch.forEach((t) => pending.delete(t));
  if (batch.length === 0 || !FUNCTIONS_URL.startsWith('http')) return;

  try {
    const res = await fetch(FUNCTIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ texts: batch, target: LANG_NAMES[lang] ?? lang }),
    });
    const data = await res.json();
    const translations: string[] = data?.translations ?? [];
    let changed = false;
    batch.forEach((source, i) => {
      const value = translations[i];
      if (typeof value === 'string' && value.trim()) {
        cache[source] = value;
        if (value !== source) changed = true;
      } else {
        failed.add(source);
      }
    });
    saveCache(lang);
    if (changed) listeners.forEach((l) => l());
  } catch {
    batch.forEach((t) => failed.add(t));
  }
  if (pending.size > 0 && timers[lang] == null) {
    timers[lang] = window.setTimeout(() => flush(lang), 800);
  }
};

/** Renvoie la traduction en cache pour la langue cible, ou la met en file d'attente. */
export const aiTranslate = (text: string, lang = 'en'): string | null => {
  const key = text.trim();
  if (!key || key.length < 3 || key.length > 400) return null;
  const cache = cacheFor(lang);
  if (cache[key]) return cache[key];
  if (failedFor(lang).has(key) || pendingFor(lang).has(key)) return null;
  pendingFor(lang).add(key);
  if (timers[lang] == null) timers[lang] = window.setTimeout(() => flush(lang), 500);
  return null;
};
