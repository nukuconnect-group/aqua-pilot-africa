/** Préférences propres à cet appareil (scanner et imprimante branchés sur ce poste). */
export type ReceiptFormat = '58' | '80' | 'A4';
export interface DevicePrefs {
  receiptFormat: ReceiptFormat;
  autoPrint: boolean;
  hardwareScanner: boolean; // lecteur USB / Bluetooth (fonctionne comme un clavier)
  remoteScanner: boolean;   // recevoir les codes scannés depuis un téléphone connecté au même compte
}

const KEY = 'aquapilote-device-prefs';
export const DEFAULT_DEVICE_PREFS: DevicePrefs = { receiptFormat: '58', autoPrint: false, hardwareScanner: true, remoteScanner: true };

export const readDevicePrefs = (): DevicePrefs => {
  try { return { ...DEFAULT_DEVICE_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT_DEVICE_PREFS; }
};
export const writeDevicePrefs = (p: DevicePrefs) => {
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event('device-prefs'));
};

/** Largeur de page pour l'impression du reçu. */
export const receiptPageCss = (f: ReceiptFormat) =>
  f === 'A4' ? '@page{size:A4;margin:12mm}.ticket{width:100%!important;max-width:120mm;margin:0 auto;font-size:13px}'
    : `@page{size:${f}mm auto;margin:0}.ticket{width:${f}mm!important}`;

/** Canal temps réel sur lequel un téléphone envoie les codes scannés au poste de caisse. */
export const scanChannelName = (userId: string) => `remote-scan-${userId}`;

/**
 * Lecteur de codes-barres « clavier » : les caractères arrivent très vite puis Entrée.
 * Retourne le code quand la saisie est terminée, sinon null.
 */
export const createWedgeReader = (maxGapMs = 40, minLength = 4) => {
  let buf = ''; let last = 0;
  return (key: string, now: number): string | null => {
    if (now - last > maxGapMs) buf = '';
    last = now;
    if (key === 'Enter') { const code = buf; buf = ''; return code.length >= minLength ? code : null; }
    if (key.length === 1) buf += key;
    return null;
  };
};
