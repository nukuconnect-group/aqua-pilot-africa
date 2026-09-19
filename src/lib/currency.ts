/**
 * Gestion centralisée de la devise pour toute l'application.
 *
 * Une seule source de vérité : la devise choisie dans les paramètres
 * (ou l'unité) est utilisée partout — écrans, tableaux de bord, PDF,
 * Word, Excel, CSV. La langue de l'interface ne change PAS la devise.
 */

export type CurrencyCode = 'XOF' | 'EUR' | 'USD' | 'MAD';

export const SUPPORTED_CURRENCIES: Array<{ code: CurrencyCode; symbol: string; name: string }> = [
  { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'Dollar US' },
  { code: 'MAD', symbol: 'DH', name: 'Dirham' },
];

const STORAGE_KEY = 'app-currency';

const isValid = (value: unknown): value is CurrencyCode =>
  value === 'XOF' || value === 'EUR' || value === 'USD' || value === 'MAD';

const readStored = (): CurrencyCode | null => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    return isValid(raw) ? raw : null;
  } catch {
    return null;
  }
};

let currentCurrency: CurrencyCode = readStored() ?? 'XOF';

const listeners = new Set<(c: CurrencyCode) => void>();

export const getCurrency = (): CurrencyCode => currentCurrency;

export const setCurrency = (code: CurrencyCode) => {
  if (!isValid(code) || code === currentCurrency) {
    if (isValid(code)) {
      try { window.localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
    }
    return;
  }
  currentCurrency = code;
  try { window.localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  listeners.forEach(l => {
    try { l(code); } catch { /* ignore */ }
  });
};

export const subscribeCurrency = (listener: (c: CurrencyCode) => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Devise conseillée selon la langue — utilisée uniquement au tout premier lancement. */
export const defaultCurrencyForLanguage = (language: string): CurrencyCode => {
  if (language === 'fr') return 'XOF';
  if (language === 'en') return 'USD';
  if (language === 'es' || language === 'pt') return 'EUR';
  return 'XOF';
};

export const currencySymbol = (code: CurrencyCode = currentCurrency): string =>
  SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol ?? code;

/** Formatage unique des montants pour toute l'application. */
export const formatMoney = (amount: number, code: CurrencyCode = currentCurrency): string => {
  const value = Number.isFinite(amount) ? amount : 0;
  const decimals = code === 'XOF' ? 0 : 2;
  const formatted = new Intl.NumberFormat(code === 'USD' ? 'en-US' : 'fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  if (code === 'USD') return `$${formatted}`;
  if (code === 'EUR') return `${formatted} €`;
  return `${formatted} ${currencySymbol(code)}`;
};

const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 600,
  MAD: 60.7,
};

export const convertAmount = (amount: number, from: CurrencyCode, to: CurrencyCode): number => {
  if (from === to) return amount;
  const inXof = amount * EXCHANGE_RATES[from];
  return inXof / EXCHANGE_RATES[to];
};
