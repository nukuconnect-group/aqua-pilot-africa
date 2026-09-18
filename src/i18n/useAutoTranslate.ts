import { useEffect } from 'react';
import { translateFrToEn } from './frToEn';
import { aiTranslate, onTranslationsReady } from './aiTranslate';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const MARK = 'data-i18n-en';

// Mots fréquents permettant de repérer un texte français encore non traduit.
const FRENCH_HINT =
  /(^|\s)(le|la|les|un|une|des|du|de|au|aux|et|ou|pour|avec|sans|dans|sur|par|vos|votre|nos|notre|vous|nous|est|sont|être|plus|tous|toutes|cette|ce|ces|qui|que|selon|afin|entre|chaque)(\s|$)/i;

const shouldAiTranslate = (text: string) => {
  const t = text.trim();
  if (t.length < 8 || t.length > 400) return false;
  if (!/[a-zà-ÿ]/i.test(t)) return false;
  if (/^[\d\s.,%€$/-]+$/.test(t)) return false;
  return FRENCH_HINT.test(t) || /[éèêàùôçîïœ]/i.test(t);
};

const translate = (value: string): string | null => {
  const dict = translateFrToEn(value);
  if (dict) return dict;
  if (!shouldAiTranslate(value)) return null;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const ai = aiTranslate(value.trim());
  return ai ? leading + ai + trailing : null;
};

const translateNode = (node: Text) => {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return;
  if (parent.isContentEditable) return;
  const value = node.nodeValue;
  if (!value || !value.trim()) return;
  const translated = translate(value);
  if (translated && translated !== value) node.nodeValue = translated;
};

const translateElement = (el: Element) => {
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const translated = translate(value);
    if (translated && translated !== value) el.setAttribute(attr, translated);
  }
  if (el instanceof HTMLInputElement && (el.type === 'button' || el.type === 'submit') && el.value) {
    const translated = translate(el.value);
    if (translated) el.value = translated;
  }
};

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    translateNode(root as Text);
    return;
  }
  if (!(root instanceof Element) && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root instanceof Element) translateElement(root);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      if (node.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has((node as Element).tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateNode(current as Text);
    else translateElement(current as Element);
    current = walker.nextNode();
  }
};

/**
 * Traduit l'interface rendue (textes, placeholders, titres) en anglais
 * lorsque la langue de l'application est l'anglais.
 */
export const useAutoTranslate = (language: string) => {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language === 'en' ? 'en' : language;
    if (language !== 'en') {
      document.documentElement.removeAttribute(MARK);
      return;
    }
    document.documentElement.setAttribute(MARK, 'true');

    let scheduled = false;
    const pending: Node[] = [];

    const flush = () => {
      scheduled = false;
      const nodes = pending.splice(0, pending.length);
      for (const node of nodes) {
        try {
          walk(node);
        } catch {
          /* ignore */
        }
      }
    };

    const schedule = (node: Node) => {
      pending.push(node);
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(flush);
    };

    schedule(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') schedule(mutation.target);
        else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateElement(mutation.target);
        } else {
          mutation.addedNodes.forEach((n) => schedule(n));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });

    return () => observer.disconnect();
  }, [language]);
};
