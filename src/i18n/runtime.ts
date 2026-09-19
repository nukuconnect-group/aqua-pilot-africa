/**
 * Couche de traduction runtime centralisée.
 * Utilisée à la fois par la traduction automatique de l'interface (DOM)
 * et par les documents générés (PDF, Word, Excel, CSV).
 */
import { translateFrToEn } from './frToEn';
import { aiTranslate } from './aiTranslate';

let currentLanguage = 'fr';

export const setRuntimeLanguage = (lang: string) => {
  currentLanguage = lang || 'fr';
};

export const getRuntimeLanguage = () => currentLanguage;

/** Langue source de l'application : aucun besoin de traduire. */
export const isSourceLanguage = (lang = currentLanguage) => !lang || lang === 'fr';

const ENGLISH_ONLY =
  /^(ok|yes|no|on|off|email|e-mail|dashboard|home|login|logout|admin|pdf|csv|excel|word|kg|g|mg|l|ml|ph|id|url|api|ia|ai|sms|http[s]?:\/\/.*)$/i;

export const shouldTranslate = (text: string) => {
  const t = text.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[a-zà-ÿ]{2}/i.test(t)) return false;
  if (/^[\d\s.,:%€$/+-]+$/.test(t)) return false;
  if (ENGLISH_ONLY.test(t)) return false;
  return true;
};

/**
 * Traduit un texte dans la langue active (retourne null si inconnu).
 * Le dictionnaire local couvre l'anglais ; les autres langues passent par l'IA.
 */
export const translateRuntime = (value: string, lang = currentLanguage): string | null => {
  if (isSourceLanguage(lang)) return null;
  if (lang === 'en') {
    const dict = translateFrToEn(value);
    if (dict) return dict;
  }
  if (!shouldTranslate(value)) return null;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const ai = aiTranslate(value.trim(), lang);
  return ai ? leading + ai + trailing : null;
};

/** Traduit si possible, sinon renvoie le texte d'origine. */
export const tr = (value: string | null | undefined, lang = currentLanguage): string => {
  if (!value) return value ?? '';
  return translateRuntime(value, lang) ?? value;
};

/** Locale à utiliser pour les dates et nombres des documents générés. */
export const runtimeLocale = (lang = currentLanguage) => {
  switch (lang) {
    case 'en': return 'en-US';
    case 'es': return 'es-ES';
    case 'pt': return 'pt-PT';
    case 'ar': return 'ar';
    default: return 'fr-FR';
  }
};

/** Traduit tous les textes visibles d'un document HTML généré (PDF/Word/impression). */
export const translateHtmlDocument = (html: string, lang = currentLanguage): string => {
  if (isSourceLanguage(lang) || typeof DOMParser === 'undefined') return html;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const skip = new Set(['SCRIPT', 'STYLE']);
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = (node as Text).parentElement;
      const value = node.nodeValue;
      if (parent && !skip.has(parent.tagName) && value && value.trim()) {
        const translated = translateRuntime(value, lang);
        if (translated) node.nodeValue = translated;
      }
      node = walker.nextNode();
    }
    const title = doc.querySelector('title');
    if (title?.textContent) title.textContent = tr(title.textContent, lang);
    return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
  } catch {
    return html;
  }
};

/** Traduit les cellules texte d'un contenu CSV/TSV généré. */
export const translateDelimitedText = (content: string, lang = currentLanguage): string => {
  if (isSourceLanguage(lang)) return content;
  return content
    .split('\n')
    .map((line) =>
      line.replace(/"([^"\n]+)"|([^\t,"\n]+)/g, (match, quoted, bare) => {
        const raw = quoted ?? bare;
        if (!raw || !shouldTranslate(raw)) return match;
        const translated = translateRuntime(raw, lang);
        if (!translated) return match;
        return quoted != null ? `"${translated}"` : translated;
      }),
    )
    .join('\n');
};
