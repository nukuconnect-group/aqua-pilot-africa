import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/appClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Mail, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface AlertHistoryItem {
  id: string;
  alert_type: string;
  message: string;
  email_sent: boolean;
  email_error: string | null;
  stock_details: any;
  created_at: string;
}

export default function AlertHistory() {
  const [alerts, setAlerts] = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertHistory();
  }, []);

  const fetchAlertHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching alert history:', error);
        return;
      }

      setAlerts(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historique des Alertes</CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historique des Alertes
        </CardTitle>
        <CardDescription>
          Toutes les notifications envoyées ({alerts.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Aucune alerte envoyée pour le moment</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{alert.message}</p>
                      {alert.stock_details && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Seuil min: {alert.stock_details.min_threshold}
                          {alert.stock_details.unit}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={alert.email_sent ? "default" : "destructive"}
                      className="shrink-0"
                    >
                      {alert.email_sent ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {alert.email_sent ? "Envoyé" : "Échec"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(alert.created_at), "dd MMM yyyy 'à' HH:mm", {
                        locale: fr,
                      })}
                    </span>
                  </div>

                  {alert.email_error && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      Erreur: {alert.email_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
