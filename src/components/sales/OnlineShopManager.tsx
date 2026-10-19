import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useSales } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { isMissingTable } from '@/lib/savingsShop';

const db = supabase as any;
const STATUS: Record<string, string> = { new: 'Nouvelle', confirmed: 'Confirmée', delivered: 'Livrée', cancelled: 'Annulée' };

const OnlineShopManager: React.FC = () => {
  const { user } = useAuth();
  const { activeUnit } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const { addSale } = useSales();
  const { toast } = useToast();
  const unitId = activeUnit?.id;
  const [missing, setMissing] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopForm, setShopForm] = useState({ shop_name: '', banner: '', whatsapp: '' });
  const [pf, setPf] = useState({ name: '', price: '', unit_label: 'kg', stock: '', description: '', image_url: '' });

  const load = useCallback(async () => {
    if (!unitId) return;
    const [s, p, o] = await Promise.all([
      db.from('shop_settings').select('*').eq('unit_id', unitId).maybeSingle(),
      db.from('shop_products').select('*').eq('unit_id', unitId).order('name'),
      db.from('shop_orders').select('*').eq('unit_id', unitId).order('created_at', { ascending: false }).limit(200),
    ]);
    const err = s.error || p.error || o.error;
    if (err) { setMissing(isMissingTable(err)); return; }
    setMissing(false);
    setSettings(s.data); setProducts(p.data || []); setOrders(o.data || []);
    if (s.data) setShopForm({ shop_name: s.data.shop_name || '', banner: s.data.banner || '', whatsapp: s.data.whatsapp || '' });
    else setShopForm((f) => ({ ...f, shop_name: f.shop_name || activeUnit?.name || '' }));
  }, [unitId, activeUnit?.name]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!unitId || missing) return;
    const ch = supabase.channel(`shop-${unitId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_orders', filter: `unit_id=eq.${unitId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [unitId, missing, load]);

  const run = async (p: Promise<any>, ok: string) => {
    const { error } = await p;
    if (error) toast({ title: 'Échec', description: error.message, variant: 'destructive' });
    else { toast({ title: ok }); load(); }
    return !error;
  };

  const shopUrl = unitId ? `${window.location.origin}/boutique/${unitId}` : '';

  const confirmOrder = async (o: any) => {
    const sale = await addSale({
      date: new Date().toISOString().split('T')[0],
      clientName: o.customer_name, clientContact: o.customer_phone, unitId: unitId!,
      products: (o.items || []).map((i: any) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unit_price, total: i.quantity * i.unit_price })),
      totalAmount: Number(o.total), status: 'pending', paymentMethod: 'À la livraison',
    } as any);
    if (!sale) return toast({ title: 'Vente non créée', variant: 'destructive' });
    for (const i of o.items || []) {
      const p = products.find((x) => x.id === i.product_id);
      if (p) await db.from('shop_products').update({ stock: Math.max(0, Number(p.stock) - i.quantity) }).eq('id', p.id);
    }
    await run(db.from('shop_orders').update({ status: 'confirmed', sale_id: (sale as any).id || null }).eq('id', o.id), 'Commande confirmée et ajoutée aux ventes');
  };

  if (!unitId) return <p className="text-sm text-muted-foreground">Sélectionnez une unité.</p>;
  if (missing) return <Alert><AlertDescription>La boutique n'est pas encore installée sur le serveur de l'application (fichier « savings_shop.sql »).</AlertDescription></Alert>;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Ma boutique</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Nom de la boutique" value={shopForm.shop_name} onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })} />
            <Input placeholder="Bannière (message d'accueil)" value={shopForm.banner} onChange={(e) => setShopForm({ ...shopForm, banner: e.target.value })} />
            <Input placeholder="WhatsApp (ex. 22890000000)" value={shopForm.whatsapp} onChange={(e) => setShopForm({ ...shopForm, whatsapp: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => {
              if (!shopForm.shop_name.trim()) return toast({ title: 'Nom requis', variant: 'destructive' });
              run(db.from('shop_settings').upsert({ unit_id: unitId, user_id: user?.id, ...shopForm, enabled: settings?.enabled ?? true }), 'Boutique enregistrée');
            }}>Enregistrer</Button>
            {settings && <>
              <div className="flex items-center gap-2 text-sm"><Switch checked={settings.enabled} onCheckedChange={(v) => run(db.from('shop_settings').update({ enabled: v }).eq('unit_id', unitId), v ? 'Boutique en ligne' : 'Boutique fermée')} />{settings.enabled ? 'En ligne' : 'Fermée'}</div>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shopUrl); toast({ title: 'Lien copié' }); }}><Copy className="w-4 h-4 mr-1" />Copier le lien</Button>
              <Button size="sm" variant="outline" asChild><a href={shopUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" />Voir</a></Button>
            </>}
          </div>
        </CardContent></Card>

      <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Commandes en ligne</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-2">
          {orders.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Aucune commande.</p>}
          {orders.map((o) => (
            <div key={o.id} className="border border-border rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between gap-2"><b>{o.customer_name} · {o.customer_phone}</b><Badge variant={o.status === 'new' ? 'default' : 'secondary'}>{STATUS[o.status]}</Badge></div>
              <p className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}{o.customer_address ? ` · ${o.customer_address}` : ''}</p>
              <p>{(o.items || []).map((i: any) => `${i.quantity} × ${i.name}`).join(', ')} — <b>{formatCurrency(Number(o.total))}</b></p>
              {o.note && <p className="text-muted-foreground">« {o.note} »</p>}
              <div className="flex gap-2 pt-1">
                {o.status === 'new' && <><Button size="sm" onClick={() => confirmOrder(o)}>Confirmer</Button><Button size="sm" variant="outline" onClick={() => run(db.from('shop_orders').update({ status: 'cancelled' }).eq('id', o.id), 'Commande annulée')}>Annuler</Button></>}
                {o.status === 'confirmed' && <Button size="sm" variant="outline" onClick={() => run(db.from('shop_orders').update({ status: 'delivered' }).eq('id', o.id), 'Commande livrée')}>Marquer livrée</Button>}
              </div>
            </div>
          ))}
        </CardContent></Card>

      <Card className="rounded-2xl"><CardHeader className="pb-2"><CardTitle className="text-base">Produits de la boutique</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-6">
            <Input placeholder="Produit" value={pf.name} onChange={(e) => setPf({ ...pf, name: e.target.value })} />
            <Input type="number" placeholder="Prix" value={pf.price} onChange={(e) => setPf({ ...pf, price: e.target.value })} />
            <Input placeholder="Unité" value={pf.unit_label} onChange={(e) => setPf({ ...pf, unit_label: e.target.value })} />
            <Input type="number" placeholder="Stock" value={pf.stock} onChange={(e) => setPf({ ...pf, stock: e.target.value })} />
            <Input placeholder="Lien photo (facultatif)" value={pf.image_url} onChange={(e) => setPf({ ...pf, image_url: e.target.value })} />
            <Button onClick={async () => {
              if (!pf.name.trim() || !(Number(pf.price) > 0)) return toast({ title: 'Nom et prix requis', variant: 'destructive' });
              if (await run(db.from('shop_products').insert({ user_id: user?.id, unit_id: unitId, name: pf.name.trim(), price: Number(pf.price), unit_label: pf.unit_label || 'unité', stock: Number(pf.stock) || 0, description: pf.description || null, image_url: pf.image_url || null }), 'Produit ajouté'))
                setPf({ name: '', price: '', unit_label: 'kg', stock: '', description: '', image_url: '' });
            }}>Ajouter</Button>
          </div>
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1 text-sm">
              <span>{p.name} — {formatCurrency(Number(p.price))}/{p.unit_label} · stock {Number(p.stock)}</span>
              <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Visible</span>
                <Switch checked={p.visible} onCheckedChange={(v) => run(db.from('shop_products').update({ visible: v }).eq('id', p.id), v ? 'Produit visible' : 'Produit masqué')} /></div>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-muted-foreground text-center">Aucun produit en boutique.</p>}
        </CardContent></Card>
    </div>
  );
};

export default OnlineShopManager;
