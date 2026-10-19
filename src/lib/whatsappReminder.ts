/** Normalise un numéro pour un lien WhatsApp (chiffres seuls, indicatif pays). */
export const toWhatsappNumber = (raw: string, defaultCountryCode = '228') => {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length < 6) return '';
  return d.length <= 9 ? defaultCountryCode + d : d;
};

export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
