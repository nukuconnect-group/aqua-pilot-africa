import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/appClient';
import { orderTotal, OrderItem } from '@/lib/savingsShop';

const db = supabase as any;
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

const PublicShop: React.FC = () => {
  const { unitId } = useParams();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'closed' | 'sent'>('loading');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [c, setC] = useState({ name: '', phone: '', address: '', note: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: s } = await db.from('shop_settings').select('*').eq('unit_id', unitId).maybeSingle();
      if (!s) return setState('closed');
      const { data: p } = await db.from('shop_products').select('*').eq('unit_id', unitId).eq('visible', true).order('name');
      setShop(s); setProducts(p || []); setState('ok');
      document.title = s.shop_name;
    })();
  }, [unitId]);

  const items: OrderItem[] = products.filter((p) => cart[p.id] > 0)
    .map((p) => ({ product_id: p.id, name: p.name, quantity: cart[p.id], unit_price: Number(p.price) }));
  const total = orderTotal(items);

  const send = async () => {
    if (!items.length) return setErr('Ajoutez au moins un produit.');
    if (!c.name.trim() || !c.phone.trim()) return setErr('Nom et téléphone requis.');
    const { error } = await db.from('shop_orders').insert({
      unit_id: unitId, customer_name: c.name.trim(), customer_phone: c.phone.trim(),
      customer_address: c.address || null, note: c.note || null, items, total,
    });
    if (error) return setErr("La commande n'a pas pu être envoyée. Réessayez.");
    setState('sent');
  };

  if (state === 'loading') return <div className="min-h-screen grid place-items-center text-muted-foreground">Chargement…</div>;
  if (state === 'closed') return <div className="min-h-screen grid place-items-center text-muted-foreground">Cette boutique n'est pas disponible.</div>;
  if (state === 'sent') return (
    <div className="min-h-screen grid place-items-center p-6 text-center space-y-3">
      <div><h1 className="text-2xl font-bold">Commande envoyée</h1><p className="text-muted-foreground">{shop.shop_name} vous contactera pour la livraison.</p>
        {shop.whatsapp && <Button className="mt-4" asChild><a href={`https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`}>Écrire sur WhatsApp</a></Button>}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-6"><h1 className="text-2xl font-bold">{shop.shop_name}</h1>{shop.banner && <p className="opacity-90">{shop.banner}</p>}</header>
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {products.length === 0 && <p className="text-muted-foreground text-center py-8">Aucun produit disponible pour le moment.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card key={p.id} className="rounded-2xl overflow-hidden">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between"><b>{p.name}</b><span>{fmt(Number(p.price))}/{p.unit_label}</span></div>
                {Number(p.stock) <= 0 ? <p className="text-sm text-destructive">Rupture</p> : (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} max={Number(p.stock)} className="w-24" value={cart[p.id] || ''} placeholder="Qté"
                      onChange={(e) => setCart({ ...cart, [p.id]: Math.min(Number(p.stock), Math.max(0, Number(e.target.value) || 0)) })} />
                    <span className="text-xs text-muted-foreground">{p.unit_label} · {Number(p.stock)} dispo.</span>
                  </div>)}
              </CardContent>
            </Card>
          ))}
        </div>
        {products.length > 0 && (
          <Card className="rounded-2xl"><CardContent className="p-4 space-y-2">
            <p className="font-semibold">Total : {fmt(total)}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Votre nom" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
              <Input placeholder="Téléphone" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
              <Input placeholder="Adresse de livraison" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} />
              <Input placeholder="Message (facultatif)" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button className="w-full" onClick={send}>Commander</Button>
          </CardContent></Card>
        )}
      </main>
    </div>
  );
};

export default PublicShop;
