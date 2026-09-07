import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { supabase } from '@/integrations/supabase/appClient';

declare global {
  interface Window {
    google?: any;
    __initAquapiloteMap?: () => void;
    gm_authFailure?: () => void;
  }
}

type Status = 'normal' | 'warning' | 'critical';

interface Diagnostic {
  stage: 'key' | 'script' | 'auth' | 'init' | 'ok';
  message: string;
  hint?: string;
  detail?: string;
}

interface FarmMarker {
  id: string;
  name: string;
  type: string;
  status: Status;
  lat: number;
  lng: number;
  stock: number;
  capacity: number;
}

// Hash-based deterministic offset around a center so a unit always pins to the same spot
const hashOffset = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = ((h & 0xffff) / 0xffff - 0.5) * 1.2; // ±0.6°
  const b = (((h >> 16) & 0xffff) / 0xffff - 0.5) * 1.2;
  return { dLat: a, dLng: b };
};

const statusColor: Record<Status, string> = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const FarmsMap: React.FC = () => {
  const { units } = useProductionUnits();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const managedKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const trackingId = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

  // Sur les domaines Lovable, la clé gérée fonctionne. Sur un domaine custom,
  // on récupère la clé personnalisée (stockée en secret GOOGLE_API_KEY) via
  // l'edge function get-maps-key.
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLovableHost = /(lovable\.app|lovableproject\.com|localhost|127\.0\.0\.1)$/i.test(host);
    if (isLovableHost && managedKey) {
      setResolvedKey(managedKey);
      return;
    }
    // Domaine custom : essayer la clé serveur
    (async () => {
      const started = performance.now();
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error) throw error;
        const k = (data as any)?.key;
        const ms = Math.round(performance.now() - started);
        if (k) {
          setResolvedKey(k);
          console.info(`[FarmsMap] Clé Maps récupérée via edge (${ms}ms, cache TTL ${(data as any)?.cachedTtl ?? '?'}s)`);
        } else if (managedKey) {
          setResolvedKey(managedKey);
        } else {
          setDiag({
            stage: 'key',
            message: 'Clé Google Maps manquante',
            hint: "Ajoutez le secret GOOGLE_API_KEY dans Supabase, puis rechargez.",
            detail: JSON.stringify(data),
          });
        }
      } catch (e: any) {
        if (managedKey) {
          setResolvedKey(managedKey);
        } else {
          setDiag({
            stage: 'key',
            message: "Impossible d'obtenir la clé Maps depuis l'edge function",
            hint: 'Vérifiez que get-maps-key est déployée et que CORS autorise votre domaine.',
            detail: e?.message || String(e),
          });
        }
      }
    })();
  }, [managedKey]);

  // Default center: West Africa (Lomé, Togo)
  const center = { lat: 6.1725, lng: 1.2314 };

  const markers: FarmMarker[] = units.map((u, i) => {
    const { dLat, dLng } = hashOffset(u.id);
    const ratio = u.capacity ? u.currentStock / u.capacity : 0;
    const status: Status = !u.isActive ? 'critical' : ratio > 0.85 ? 'warning' : 'normal';
    return {
      id: u.id,
      name: u.name,
      type: u.type,
      status,
      lat: center.lat + dLat,
      lng: center.lng + dLng,
      stock: u.currentStock,
      capacity: u.capacity,
    };
  });

  useEffect(() => {
    if (!resolvedKey) return;

    // Google appelle window.gm_authFailure() sur RefererNotAllowedMapError /
    // InvalidKeyMapError. On l'intercepte pour afficher un diagnostic précis.
    window.gm_authFailure = () => {
      setDiag({
        stage: 'auth',
        message: 'Google Maps a refusé la clé (RefererNotAllowed / InvalidKey)',
        hint: `Autorisez ces referers dans Google Cloud Console : https://${window.location.hostname}/* et https://*.${window.location.hostname.split('.').slice(-2).join('.')}/*. Vérifiez aussi que Maps JavaScript API est activée.`,
        detail: `Host actuel : ${window.location.hostname}`,
      });
    };

    const init = async () => {
      if (!mapRef.current || !window.google?.maps?.importLibrary) return;
      try {
        const { Map, InfoWindow } = (await window.google.maps.importLibrary('maps')) as any;
        const Marker = window.google.maps.Marker;
        if (!Marker) {
          throw new Error('google.maps.Marker indisponible après chargement de Maps JavaScript API');
        }
      const map = new Map(mapRef.current, {
        center,
        zoom: 7,
        disableDefaultUI: false,
        mapTypeControl: false,
        streetViewControl: false,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c4a6e' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        ],
      });

      markers.forEach((m) => {
        const marker = new Marker({
          position: { lat: m.lat, lng: m.lng },
          map,
          title: m.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: statusColor[m.status],
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        const info = new InfoWindow({
          content: `<div style="font-family:system-ui;padding:4px 6px;color:#0f172a;min-width:160px">
            <div style="font-weight:600;margin-bottom:2px">${m.name}</div>
            <div style="font-size:12px;color:#475569">${m.type}</div>
            <div style="font-size:12px;margin-top:4px">Stock : <b>${m.stock.toLocaleString()}</b> / ${m.capacity.toLocaleString()}</div>
            <div style="font-size:12px;color:${statusColor[m.status]};font-weight:600;margin-top:2px;text-transform:capitalize">${m.status}</div>
          </div>`,
        });
        marker.addListener('click', () => info.open({ anchor: marker, map }));
      });

        setMapReady(true);
        setDiag(null);
      } catch (e: any) {
        setDiag({
          stage: 'init',
          message: "Erreur lors de l'initialisation de la carte",
          detail: e?.message || String(e),
        });
      }
    };

    if (window.google?.maps) {
      init();
      return;
    }

    window.__initAquapiloteMap = init;
    const existing = document.getElementById('gmaps-aquapilote');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'gmaps-aquapilote';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${resolvedKey}&loading=async&callback=__initAquapiloteMap${
      trackingId ? `&channel=${trackingId}` : ''
    }`;
    script.onerror = () =>
      setDiag({
        stage: 'script',
        message: 'Échec du chargement du script Google Maps',
        hint: 'CORS bloqué, connexion réseau interrompue, ou domaine non autorisé.',
        detail: script.src.replace(resolvedKey, '***'),
      });
    document.head.appendChild(script);

    // Watchdog : si la carte n'est pas prête au bout de 8s, afficher un diagnostic.
    const watchdog = window.setTimeout(() => {
      if (!window.google?.maps) {
        setDiag((cur) =>
          cur ?? {
            stage: 'script',
            message: "Google Maps ne répond pas (timeout 8s)",
            hint: 'Vérifiez le referer autorisé et la connectivité vers maps.googleapis.com.',
          },
        );
      }
    }, 8000);
    return () => window.clearTimeout(watchdog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedKey, units.length]);

  const counts = {
    normal: markers.filter((m) => m.status === 'normal').length,
    warning: markers.filter((m) => m.status === 'warning').length,
    critical: markers.filter((m) => m.status === 'critical').length,
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MapPin className="w-5 h-5 text-primary" />
            Carte des fermes
          </CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
              <CheckCircle2 className="w-3 h-3" /> Normal {counts.normal}
            </Badge>
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-200">
              <Activity className="w-3 h-3" /> Attention {counts.warning}
            </Badge>
            <Badge variant="outline" className="gap-1 text-red-600 border-red-200">
              <AlertTriangle className="w-3 h-3" /> Critique {counts.critical}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full h-[280px] sm:h-[380px] bg-slate-900">
          <div ref={mapRef} className="absolute inset-0" />
          {!mapReady && !diag && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground bg-slate-900/60">
              Chargement de la carte...
            </div>
          )}
          {diag && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/85 overflow-auto">
              <div className="max-w-md w-full rounded-lg border border-red-500/30 bg-slate-900/90 p-4 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-semibold">Diagnostic Google Maps</span>
                  <Badge variant="outline" className="ml-auto text-[10px] uppercase border-red-500/40 text-red-300">
                    {diag.stage}
                  </Badge>
                </div>
                <p className="text-sm text-slate-100 mb-2">{diag.message}</p>
                {diag.hint && (
                  <p className="text-xs text-amber-300 mb-2">💡 {diag.hint}</p>
                )}
                {diag.detail && (
                  <pre className="text-[10px] text-slate-400 bg-slate-950/70 rounded p-2 overflow-auto max-h-24 whitespace-pre-wrap break-all">
                    {diag.detail}
                  </pre>
                )}
                <button
                  onClick={() => {
                    setDiag(null);
                    setMapReady(false);
                    const s = document.getElementById('gmaps-aquapilote');
                    s?.remove();
                    setResolvedKey((k) => k); // retrigger effect
                    window.location.reload();
                  }}
                  className="mt-3 text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                >
                  Réessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FarmsMap;