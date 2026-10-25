import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Star, Crown, ArrowLeft, Rocket } from 'lucide-react';
import { useCurrentSubscription, getPlanLabel } from '@/hooks/useCurrentSubscription';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_OFFERS, offerPrice } from '@/lib/subscriptionOffers';

interface Plan {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
  features: string[];
  icon: React.ElementType;
  highlight?: boolean;
  gradient: string;
  regularPrice?: number;
}

const PLANS: Plan[] = [
  {
    id: 'trial_discovery',
    name: 'Essai gratuit (1 mois)',
    price: '0 F CFA',
    duration: '1 mois offert',
    description: 'Vous êtes en mode essai gratuit pour 1 mois',
    icon: Sparkles,
    gradient: 'from-sky-500/10 to-blue-500/5',
    features: [
      'Accès complet 30 jours',
      'Jusqu\'à 5 bassins',
      'Gestion cheptel & alimentation',
      'Assistant AquaAI (limité)',
      'Support par email',
    ],
  },
  {
    id: 'annual_basic',
    name: SUBSCRIPTION_OFFERS[0].name,
    price: offerPrice(SUBSCRIPTION_OFFERS[0]),
    regularPrice: SUBSCRIPTION_OFFERS[0].regularPrice,
    duration: 'par an',
    description: 'Pour les petites & moyennes exploitations',
    icon: Star,
    gradient: 'from-emerald-500/10 to-green-500/5',
    features: SUBSCRIPTION_OFFERS[0].features,
  },
  {
    id: 'annual_pro',
    name: SUBSCRIPTION_OFFERS[1].name,
    price: offerPrice(SUBSCRIPTION_OFFERS[1]),
    duration: 'par an',
    description: 'Pour les exploitations semi-industrielles',
    icon: Rocket,
    highlight: true,
    gradient: 'from-primary/15 to-blue-500/10',
    features: SUBSCRIPTION_OFFERS[1].features,
  },
  {
    id: 'annual_enterprise',
    name: SUBSCRIPTION_OFFERS[2].name,
    price: offerPrice(SUBSCRIPTION_OFFERS[2]),
    duration: 'par an',
    description: 'Pour les groupes industriels',
    icon: Crown,
    gradient: 'from-purple-500/10 to-pink-500/5',
    features: SUBSCRIPTION_OFFERS[2].features,
  },
  { id: 'custom', name: SUBSCRIPTION_OFFERS[3].name, price: offerPrice(SUBSCRIPTION_OFFERS[3]), duration: '', description: SUBSCRIPTION_OFFERS[3].description, icon: Crown, gradient: '', features: SUBSCRIPTION_OFFERS[3].features },
];

const SubscriptionPage: React.FC = () => {
  const navigate = useNavigate();
  const { subscription } = useCurrentSubscription();
  const { toast } = useToast();

  const handleChoose = (planId: string) => {
    if (planId === 'trial_discovery') return;
    toast({
      title: planId === 'custom' ? 'Demande de devis' : 'Demande de souscription',
      description: `Pour ${planId === 'custom' ? 'obtenir un devis' : `souscrire à ${getPlanLabel(planId)}`}, contactez-nous via le module Support.`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Button>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Abonnements & Tarification
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Choisissez le plan qui correspond à votre exploitation. Tous les plans incluent les mises à jour et la sécurité.
          </p>
          {subscription && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
              <Sparkles className="w-4 h-4" />
              Votre plan actuel : <strong>{getPlanLabel(subscription.plan)}</strong>
              {subscription.isActive && ` · ${subscription.days_remaining}j restants`}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const isCurrent = subscription?.plan === p.id;
            return (
              <Card
                key={p.id}
                className={`relative overflow-hidden bg-card transition-all ${
                  p.highlight ? 'border-2 border-primary shadow-md' : ''
                } ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`}
              >
                {p.highlight && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-primary">Populaire</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-emerald-600">Actuel</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="w-11 h-11 rounded-lg bg-white/70 dark:bg-white/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <div className="pt-2">
                    <div className="text-2xl font-bold">{p.price}</div>
                    <div className="text-xs text-muted-foreground">{p.duration}</div>
                    {p.regularPrice && <p className="mt-1 text-xs text-muted-foreground">Promotion au lieu de <span className="line-through">{p.regularPrice.toLocaleString('fr-FR')} F CFA</span></p>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2 mb-4 min-h-[140px]">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={p.highlight ? 'default' : 'outline'}
                    disabled={isCurrent || p.id === 'trial_discovery'}
                    onClick={() => handleChoose(p.id)}
                  >
                    {isCurrent ? 'Plan actuel' : p.id === 'trial_discovery' ? 'Gratuit' : p.id === 'custom' ? 'Demander un devis' : 'Choisir ce plan'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Besoin d'aide ? Contactez-nous via le module Support ou à contact@aquapilote.com
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPage;
