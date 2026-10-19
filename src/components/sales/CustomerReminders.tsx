import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Phone } from 'lucide-react';
import { useSales } from '@/hooks/useSales';
import { useSettings } from '@/contexts/SettingsContext';
import { toWhatsappNumber, whatsappLink } from '@/lib/whatsappReminder';

/** Clients ayant un reste à payer, avec relance WhatsApp pré-remplie. */
const CustomerReminders: React.FC = () => {
  const { sales } = useSales();
  const { formatCurrency, companyInfo } = useSettings() as any;
  const today = new Date().toISOString().slice(0, 10);

  const debts = useMemo(() => sales
    .map((s) => ({ s, due: Math.max(0, s.totalAmount - (s.paidAmount || 0)) }))
    .filter(({ s, due }) => due > 0 && (s.isCredit || s.status === 'pending' || s.status === 'confirmed' || s.status === 'delivered'))
    .sort((a, b) => (a.s.dueDate || a.s.date).localeCompare(b.s.dueDate || b.s.date)), [sales]);

  const company = companyInfo?.name || companyInfo?.companyName || '';

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2"><CardTitle className="text-base">Relances clients</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {debts.length === 0 && <p className="text-sm text-muted-foreground">Aucun client n'a de reste à payer.</p>}
        {debts.map(({ s, due }) => {
          const phone = toWhatsappNumber(s.clientContact);
          const late = s.dueDate && s.dueDate < today;
          const msg = `Bonjour ${s.clientName}, ${company ? company + ' vous' : 'nous vous'} rappelle un reste à payer de ${formatCurrency(due)} pour la vente ${s.documentNumber || ''} du ${new Date(s.date).toLocaleDateString('fr-FR')}${s.dueDate ? `, échéance le ${new Date(s.dueDate).toLocaleDateString('fr-FR')}` : ''}. Merci.`;
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-semibold text-sm">{s.clientName} {late && <Badge variant="destructive" className="ml-1">En retard</Badge>}</p>
                <p className="text-xs text-muted-foreground">{s.documentNumber || 'Vente'} · {new Date(s.date).toLocaleDateString('fr-FR')} · {s.clientContact || 'pas de numéro'}</p>
              </div>
              <span className="font-bold text-sm">{formatCurrency(due)}</span>
              {phone ? (
                <>
                  <Button size="sm" asChild><a href={whatsappLink(phone, msg)} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4 mr-1" />WhatsApp</a></Button>
                  <Button size="sm" variant="outline" asChild><a href={`tel:+${phone}`}><Phone className="w-4 h-4" /></a></Button>
                </>
              ) : <span className="text-xs text-muted-foreground">Ajoutez un numéro au client</span>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CustomerReminders;
