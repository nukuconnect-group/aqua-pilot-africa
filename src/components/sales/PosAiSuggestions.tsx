import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import type { PosProduct } from '@/lib/posCatalog';

export interface AiSuggestion { name: string; quantity: number; unitPrice: number; reason: string }

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-ai-suggest`;

interface Props {
  cart: { name: string; quantity: number; unitPrice: number }[];
  catalog: PosProduct[];
  formatCurrency: (n: number) => string;
  onConfirm: (lines: AiSuggestion[]) => void;
}

/** Vente assistée : l'IA propose, le vendeur choisit et confirme avant l'ajout au panier. */
export default function PosAiSuggestions({ cart, catalog, formatCurrency, onConfirm }: Props) {
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<(AiSuggestion & { checked: boolean })[]>([]);

  const ask = async () => {
    setLoading(true); setError(null); setItems([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Reconnectez-vous pour utiliser l’assistant.');
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          cart, request: request.trim() || undefined,
          catalog: catalog.slice(0, 200).map(p => ({ name: p.name, price: p.price, quantity: p.quantity ?? null, unit: p.unit ?? null })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Assistant indisponible pour le moment.');
      const list = (body.suggestions || []) as AiSuggestion[];
      if (!list.length) setError('Aucune proposition pour ce panier.');
      setItems(list.map(s => ({ ...s, checked: true })));
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  };

  const chosen = items.filter(i => i.checked && i.quantity > 0);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Vente assistée</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {catalog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ajoutez des articles commerciaux au stock pour recevoir des propositions.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input placeholder="Besoin du client (facultatif), ex. « restaurant, 20 kg »" value={request} onChange={e => setRequest(e.target.value)} maxLength={300} />
              <Button onClick={ask} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Proposer'}</Button>
            </div>
            {error && <p className="text-sm text-muted-foreground">{error}</p>}
            {items.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox checked={s.checked} onCheckedChange={v => setItems(prev => prev.map((x, j) => j === i ? { ...x, checked: !!v } : x))} aria-label={`Choisir ${s.name}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name} · {formatCurrency(s.unitPrice)}</p>
                  <p className="text-xs text-muted-foreground">{s.reason}</p>
                </div>
                <Input type="number" min={0} step="any" className="w-20 h-8" value={s.quantity}
                  onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} aria-label={`Quantité ${s.name}`} />
              </div>
            ))}
            {items.length > 0 && (
              <div className="flex gap-2">
                <Button className="flex-1" disabled={!chosen.length} onClick={() => { onConfirm(chosen); setItems([]); }}>
                  Confirmer et ajouter au panier ({chosen.length})
                </Button>
                <Button variant="ghost" onClick={() => setItems([])}>Ignorer</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Rien n’est encaissé automatiquement : vérifiez le panier puis encaissez.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
