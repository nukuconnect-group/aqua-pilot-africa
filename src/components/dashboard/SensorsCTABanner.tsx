import React, { useEffect, useState } from 'react';
import { Radio, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface Props {
  onNavigate?: (tab: string) => void;
}

const SensorsCTABanner: React.FC<Props> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('needs_sensors, sensors_banner_dismissed_at')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.needs_sensors && !data.sensors_banner_dismissed_at) {
        setVisible(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!visible) return null;

  const dismiss = async () => {
    if (!user?.id) return;
    setDismissing(true);
    await supabase
      .from('profiles')
      .update({ sensors_banner_dismissed_at: new Date().toISOString() })
      .eq('id', user.id);
    setVisible(false);
  };

  return (
    <div className="mb-4 rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 via-blue-50 to-teal-50 dark:from-cyan-950/40 dark:via-blue-950/40 dark:to-teal-950/40 p-4 flex items-start gap-3 shadow-sm">
      <div className="h-10 w-10 shrink-0 rounded-full bg-cyan-500/15 flex items-center justify-center">
        <Radio className="w-5 h-5 text-cyan-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Vos capteurs IoT vous attendent</div>
        <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
          Vous avez indiqué avoir besoin de capteurs à l'inscription. Découvrez le centre IoT pour connecter température, pH, oxygène et plus.
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onNavigate?.('iot')} className="h-8">
            Découvrir les capteurs <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} disabled={dismissing} className="h-8">
            Plus tard
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SensorsCTABanner;