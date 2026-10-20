export type StockPurpose = 'production' | 'commercial';

/** Marqueur utilisé tant que la colonne stock_purpose n'existe pas encore dans la base. */
export const COMMERCIAL_TAG = '[Stock commercial]';

export const STOCK_PURPOSE_LABELS: Record<StockPurpose, string> = {
  production: 'Stock de production',
  commercial: 'Stock commercial',
};

export const getStockPurpose = (s: { stock_purpose?: string | null; notes?: string | null }): StockPurpose =>
  s.stock_purpose === 'commercial' || (!s.stock_purpose && (s.notes || '').startsWith(COMMERCIAL_TAG))
    ? 'commercial' : 'production';

export const isCommercialStock = (s: { stock_purpose?: string | null; notes?: string | null }) =>
  getStockPurpose(s) === 'commercial';

const stripTag = (notes?: string | null) => (notes || '').replace(COMMERCIAL_TAG, '').trim();
export const cleanStockNotes = stripTag;

export const isMissingColumnError = (err: any) =>
  !!err && (err.code === 'PGRST204' || err.code === '42703' || /stock_purpose|sale_price/.test(err.message || ''));

/** Version de repli : conserve la destination dans les notes si la base n'a pas encore la colonne. */
export const toLegacyStockRow = <T extends Record<string, any>>(row: T) => {
  const { stock_purpose, sale_price, ...rest } = row;
  if (stock_purpose === undefined) return rest;
  const notes = stripTag(rest.notes);
  return {
    ...rest,
    notes: stock_purpose === 'commercial'
      ? `${COMMERCIAL_TAG}${sale_price ? ` Prix de vente: ${sale_price}` : ''}${notes ? ` ${notes}` : ''}`
      : notes || null,
  };
};

export const getSalePrice = (s: { sale_price?: number | null; notes?: string | null }) => {
  if (s.sale_price != null && Number(s.sale_price) > 0) return Number(s.sale_price);
  const m = (s.notes || '').match(/Prix de vente: ([\d.]+)/);
  return m ? Number(m[1]) : 0;
};
