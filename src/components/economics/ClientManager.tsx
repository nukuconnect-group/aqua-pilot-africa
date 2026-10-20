import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Mail, Phone, ShoppingCart } from 'lucide-react';
import ContactActions from '@/components/crm/ContactActions';
import { useSettings } from '@/contexts/SettingsContext';
import { useSales } from '@/hooks/useSales';

type ClientStatus = 'active' | 'inactive';

interface ClientRow {
  id: string;
  name: string;
  contact: string;
  status: ClientStatus;
  totalOrders: number;
  totalRevenue: number;
  lastOrder: string;
}

const ClientManager = () => {
  const { formatCurrency, t } = useSettings();
  const { sales } = useSales(); // déjà filtré par unité active dans le hook

  const clients = useMemo<ClientRow[]>(() => {
    const map = new Map<string, ClientRow>();

    for (const sale of sales) {
      const name = sale.clientName?.trim() || t('unknownClient') || 'Client';
      const contact = (sale.clientContact ?? '').trim();
      const key = `${name}__${contact}`;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: key,
          name,
          contact,
          status: 'active',
          totalOrders: 1,
          totalRevenue: sale.totalAmount,
          lastOrder: sale.date,
        });
      } else {
        existing.totalOrders += 1;
        existing.totalRevenue += sale.totalAmount;
        if (sale.date > existing.lastOrder) existing.lastOrder = sale.date;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [sales, t]);

  const getStatusColor = (status: ClientStatus) => {
    switch (status) {
      case 'active':
        return 'bg-primary/10 text-primary';
      case 'inactive':
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: ClientStatus) => {
    switch (status) {
      case 'active':
        return t('active') || 'Actif';
      case 'inactive':
      default:
        return t('inactive') || 'Inactif';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          {t('clientManagement') || 'Clients'}
        </h3>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clients">{t('clients') || 'Clients'}</TabsTrigger>
          <TabsTrigger value="orders">{t('orders') || 'Commandes'}</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          {clients.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('noClientsYet') || "Aucun client: enregistrez d'abord des ventes."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {clients.map((client) => (
                <Card key={client.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h4 className="font-semibold truncate">{client.name}</h4>
                          <Badge className={getStatusColor(client.status)}>{getStatusLabel(client.status)}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {client.contact.includes('@') ? <Mail className="w-4 h-4 shrink-0" /> : <Phone className="w-4 h-4 shrink-0" />}
                          <span className="break-all">{client.contact || t('notProvided') || '—'}</span>
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                          <span>
                            {t('orders') || 'Commandes'}: <strong>{client.totalOrders}</strong>
                          </span>
                          <span>
                            {t('totalRevenue') || 'CA total'}: <strong>{formatCurrency(client.totalRevenue)}</strong>
                          </span>
                          <span>
                            {t('lastOrder') || 'Dernière vente'}: <strong>{client.lastOrder}</strong>
                          </span>
                        </div>
                      </div>
                      <ContactActions
                        name={client.name}
                        phone={client.contact.includes('@') ? '' : client.contact}
                        email={client.contact.includes('@') ? client.contact : ''}
                        message={`Bonjour ${client.name}, nous souhaitons faire le point avec vous sur vos commandes. Merci de nous recontacter.`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                {t('orders') || 'Commandes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sales.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noOrdersYet') || 'Aucune commande.'}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('client') || 'Client'}</TableHead>
                      <TableHead>{t('date') || 'Date'}</TableHead>
                      <TableHead>{t('status') || 'Statut'}</TableHead>
                      <TableHead className="text-right">{t('amount') || 'Montant'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales
                      .slice()
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.clientName}</TableCell>
                          <TableCell>{sale.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{sale.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(sale.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientManager;
