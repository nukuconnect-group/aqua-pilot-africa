export interface WaterQualityRecommendation {
  parameter: string;
  currentValue: number;
  optimalRange: string;
  status: 'critical' | 'warning' | 'optimal';
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
  healthImpact: string;
  technicalDetails: string;
  timeline: string;
  preventiveMeasures: string[];
  estimatedCost?: string;
}

export interface WaterQualityAnalysis {
  healthScore: number;
  status: 'critical' | 'warning' | 'good' | 'excellent';
  recommendations: WaterQualityRecommendation[];
  summary: string;
}

const getOptimalDensity = (pondType: string): number => {
  switch (pondType?.toLowerCase()) {
    case 'incubation':
    case 'ecloserie':
      return 200;
    case 'nursery':
    case 'pre-grossissement':
      return 100;
    case 'grossissement':
      return 30;
    case 'finition':
      return 15;
    default:
      return 50;
  }
};

export const analyzeWaterQuality = (
  temperature: number,
  pH: number,
  oxygen: number,
  ammonia: number,
  fishCount: number,
  pondVolume: number,
  averageWeight: number,
  pondType: string = 'grossissement',
  currentTime: Date = new Date()
): WaterQualityAnalysis => {
  const recommendations: WaterQualityRecommendation[] = [];
  let healthScore = 100;
  
  // Obtenir l'heure actuelle pour des recommandations contextuelles
  const hour = currentTime.getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isAfternoon = hour >= 12 && hour < 18;
  const isEvening = hour >= 18 && hour < 22;
  const isNight = hour >= 22 || hour < 5;

  if (temperature < 15 || temperature > 30) {
    const isCritical = temperature < 12 || temperature > 32;
    recommendations.push({
      parameter: 'Température',
      currentValue: temperature,
      optimalRange: '18-28°C',
      status: isCritical ? 'critical' : 'warning',
      priority: isCritical ? 'high' : 'medium',
      action: temperature < 15 
        ? '🚨 URGENT: Activer le système de chauffage immédiatement. Augmenter progressivement de 1°C par heure maximum jusqu\'à atteindre 20-22°C.' 
        : '🚨 URGENT: Arrêter l\'alimentation temporairement. Augmenter l\'aération et installer des ombrages ou écrans solaires.',
      reason: temperature < 15
        ? 'Le métabolisme des poissons est fortement ralenti en dessous de 15°C. En dessous de 12°C, les fonctions vitales sont compromises.'
        : 'L\'oxygène dissous chute drastiquement au-dessus de 28°C. Au-delà de 32°C, risque de choc thermique mortel.',
      healthImpact: isCritical
        ? '⚠️ CRITIQUE: Mortalité massive imminente (30-100% dans les 24-48h). Arrêt de la croissance, immunosuppression sévère, vulnérabilité maximale aux pathogènes.'
        : 'Croissance réduite de 40-60%, appétit diminué, stress chronique, sensibilité accrue aux maladies (costiose, columnariose).',
      technicalDetails: temperature < 15
        ? 'Installer un système de chauffage de 1-2 kW par m³. Isoler les bassins avec des bâches thermiques la nuit. Vérifier l\'absence de fuites thermiques.'
        : 'Augmenter le débit d\'aération à 2-3x la normale. Renouveler 20-30% du volume d\'eau avec de l\'eau fraîche. Installer des filets d\'ombrage (70-80% de réduction lumineuse).',
      timeline: isCritical ? 'IMMÉDIAT (0-2h)' : 'Urgent (2-6h)',
      preventiveMeasures: temperature < 15 
        ? ['Installer un thermostat automatique avec alarmes', 'Prévoir un système de chauffage de secours', 'Isoler thermiquement les parois des bassins']
        : ['Installer des systèmes d\'ombrage automatiques', 'Prévoir un système de refroidissement par évaporation', 'Programmer l\'alimentation aux heures fraîches'],
      estimatedCost: temperature < 15 ? '150,000-500,000 XOF (système de chauffage)' : '50,000-200,000 XOF (ombrage et aération)'
    });
    healthScore -= isCritical ? 40 : 20;
  }

  if (pH < 6.5 || pH > 8.5) {
    const isCritical = pH < 6.0 || pH > 9.0;
    
    // Analyse contextuelle basée sur l'heure
    let contextMessage = '';
    let priorityAdjustment = '';
    
    if (pH < 6.5) {
      if (isMorning && pH < 5.5) {
        contextMessage = '🔴 ALERTE MATINALE CRITIQUE: pH très bas le matin (< 5.5) indique une acidification nocturne sévère par CO2 et déchets. ';
        priorityAdjustment = 'URGENCE ABSOLUE - Risque de mortalité massive dans les 2-4h. ';
      } else if (isMorning && pH < 6.0) {
        contextMessage = '⚠️ pH bas le matin: La photosynthèse va augmenter le pH dans la journée, mais ce niveau reste critique. ';
      } else if (isAfternoon || isEvening) {
        contextMessage = '⚠️ pH bas en journée/soirée: Situation anormale car la photosynthèse devrait augmenter le pH. Problème structurel. ';
      }
    } else {
      if (isMorning && pH > 8.5) {
        contextMessage = '⚠️ pH très élevé dès le matin: Indique alcalinité excessive ou bloom algal. Le pH va encore augmenter en journée. ';
      } else if (isAfternoon && pH > 9.0) {
        contextMessage = '🔴 ALERTE APRÈS-MIDI: pH critique en pleine photosynthèse (> 9.0). Toxicité NH3 maximale. ';
        priorityAdjustment = 'URGENCE - Arrêter alimentation immédiatement. ';
      }
    }
    
    recommendations.push({
      parameter: 'pH',
      currentValue: pH,
      optimalRange: '6.8-8.2',
      status: isCritical ? 'critical' : 'warning',
      priority: isCritical ? 'high' : 'medium',
      action: pH < 6.5
        ? `${priorityAdjustment}${contextMessage}🚨 Corriger: Ajouter 100-200g bicarbonate de sodium par m³ OU 50-100g chaux agricole par m³.`
        : `${priorityAdjustment}${contextMessage}🚨 Corriger: Augmenter l'aération à maximum. Ajouter 50ml acide citrique (10%) par m³ OU renouveler 30-50% volume.`,
      reason: pH < 6.5
        ? 'En milieu acide, l\'hémoglobine perd son efficacité de transport d\'oxygène. Le pouvoir tampon de l\'eau est compromis.'
        : 'En milieu alcalin (pH>8.5), l\'ammoniac (NH3) devient majoritairement sous forme toxique libre. Au-delà de pH 9, les branchies sont chimiquement brûlées.',
      healthImpact: isCritical
        ? '⚠️ CRITIQUE: Mortalité 20-80% dans les 12-36h. Nécroses branchiales, lyse des muqueuses, hémorragies internes, asphyxie progressive.'
        : 'Stress osmotique chronique, croissance réduite de 30-50%, sensibilité extrême aux pathogènes (Aeromonas, Flavobacterium).',
      technicalDetails: pH < 6.5
        ? `Dose bicarbonate: 100g/m³ augmente pH de ~0.3 unités. Surveiller toutes les 2h. Analyser alcalinité (TAC) - doit être >50 mg/L CaCO3. Heure: ${hour}h - ${isMorning ? 'Matin' : isAfternoon ? 'Après-midi' : isEvening ? 'Soirée' : 'Nuit'}`
        : `Dose acide citrique: 50ml (10%) par m³ réduit pH de ~0.2 unités. Éviter chutes >0.5 pH/jour. Heure: ${hour}h - ${isMorning ? 'Matin' : isAfternoon ? 'Après-midi' : isEvening ? 'Soirée' : 'Nuit'}`,
      timeline: isCritical ? 'IMMÉDIAT (0-1h)' : 'Urgent (1-4h)',
      preventiveMeasures: ['Installer sonde pH avec alarmes', 'Maintenir alcalinité (TAC) 80-120 mg/L CaCO3', 'Tester pH 2x/jour (matin 7h + après-midi 16h)'],
      estimatedCost: '20,000-80,000 XOF (correcteurs pH + sonde)'
    });
    healthScore -= isCritical ? 35 : 18;
  } else if (pH >= 6.8 && pH <= 8.2) {
    // pH optimal - Donner un feedback positif avec contexte horaire
    if (isMorning && pH >= 7.0 && pH <= 7.5) {
      recommendations.push({
        parameter: 'pH',
        currentValue: pH,
        optimalRange: '6.8-8.2',
        status: 'optimal',
        priority: 'low',
        action: `✅ EXCELLENT: pH optimal le matin (${pH}) - Environnement idéal pour démarrer la journée. Continuer surveillance.`,
        reason: 'pH matinal équilibré indique une bonne capacité tampon de l\'eau et un équilibre respiration/photosynthèse nocturne.',
        healthImpact: '✅ Conditions optimales pour croissance maximale, métabolisme efficace, résistance aux maladies.',
        technicalDetails: `pH ${pH} à ${hour}h (matin) - Stable et sain. Prévoir légère hausse avec photosynthèse diurne.`,
        timeline: 'Maintenir - Contrôle de routine',
        preventiveMeasures: ['Continuer monitoring 2x/jour', 'Maintenir capacité tampon (TAC 80-120 mg/L)'],
        estimatedCost: '0 XOF (aucune intervention)'
      });
    }
  }

  if (oxygen < 4) {
    const isCritical = oxygen < 3;
    
    // Analyse contextuelle selon l'heure
    let contextMessage = '';
    let priorityAdjustment = '';
    
    if (isMorning && oxygen < 3) {
      contextMessage = '🔴 URGENCE ABSOLUE MATINALE: O2 critique après la nuit (< 3 mg/L). Consommation nocturne + respiration sans photosynthèse. ';
      priorityAdjustment = 'AGIR DANS LES 15 MINUTES - ';
    } else if (isMorning && oxygen < 4) {
      contextMessage = '⚠️ O2 bas au réveil: Normal après la nuit mais doit remonter rapidement avec la photosynthèse. ';
    } else if (isAfternoon && oxygen < 3) {
      contextMessage = '🔴 ALERTE APRÈS-MIDI: O2 critique en pleine journée alors que photosynthèse est maximale. Surpopulation ou bloom algal mortel. ';
      priorityAdjustment = 'URGENCE EXTRÊME - ';
    } else if (isEvening && oxygen < 4) {
      contextMessage = '⚠️ O2 bas en soirée: Va encore baisser pendant la nuit. Renforcer aération AVANT la nuit. ';
    } else if (isNight && oxygen < 3) {
      contextMessage = '🔴 CRISE NOCTURNE: O2 effondré la nuit. Mortalité imminente. ';
      priorityAdjustment = 'INTERVENTION IMMÉDIATE NUIT - ';
    }
    
    recommendations.push({
      parameter: 'Oxygène dissous',
      currentValue: oxygen,
      optimalRange: '5-8 mg/L',
      status: isCritical ? 'critical' : 'warning',
      priority: isCritical ? 'high' : 'medium',
      action: isCritical
        ? `${priorityAdjustment}${contextMessage}🚨🚨 ACTION: 1) ARRÊTER ALIMENTATION. 2) Activer TOUS aérateurs maximum. 3) Renouveler 30-50% eau IMMÉDIATEMENT.`
        : `${contextMessage}🚨 URGENT: Doubler capacité aération immédiatement. Installer aérateurs/oxygénateurs supplémentaires.`,
      reason: 'Les poissons consomment O2 pour respiration cellulaire. En dessous de 4 mg/L, métabolisme anaérobie produit acide lactique. En dessous de 3 mg/L, asphyxie commence.',
      healthImpact: isCritical
        ? '⚠️⚠️ CRITIQUE EXTRÊME: MORTALITÉ 50-100% dans 2-6h. Asphyxie aiguë, poissons en surface bouche ouverte, convulsions, coma hypoxique.'
        : '⚠️ GRAVE: Stress hypoxique sévère, croissance stoppée, perte poids, immunodépression majeure, risque mortalité 10-30%.',
      technicalDetails: isCritical
        ? `Saturation O2 <40% = urgence absolue à ${hour}h. Installer: 1) Aérateurs surface (1 par 20m³), 2) Diffuseurs bulles fines (5-10 L/min/m³).`
        : `Saturation 40-60% à ${hour}h = insuffisant. Ajouter aération: Paddlewheels ou aérateurs (0.5-1 kW par 100m³). Objectif: >5 mg/L en 3-6h.`,
      timeline: isCritical ? '⏰ IMMÉDIAT (0-30min) - VIE EN DANGER' : '⏰ URGENT (0-2h)',
      preventiveMeasures: [`Installer sondes O2 avec alarmes (seuil: 4 mg/L)`, 'Aération continue 24h/24h renforcée la nuit', 'Capacité: min 1 kW par 50m³', 'Prévoir aérateurs secours'],
      estimatedCost: isCritical ? '200,000-800,000 XOF (aérateurs urgence)' : '100,000-400,000 XOF (aérateurs supplémentaires)'
    });
    healthScore -= isCritical ? 50 : 25;
  }

  if (ammonia > 0.5) {
    const isCritical = ammonia > 1.0;
    
    // Recommandation contextuelle pour ammoniaque élevé
    let actionDetail = '';
    if (ammonia > 0.5) {
      actionDetail = isCritical 
        ? ' 💧 Changement partiel eau (50-70%) IMMÉDIAT requis pour dilution rapide. '
        : ' 💧 Changement partiel eau (30-40%) recommandé pour réduire concentration. ';
    }
    
    recommendations.push({
      parameter: 'Ammoniac',
      currentValue: ammonia,
      optimalRange: '< 0.02 mg/L',
      status: isCritical ? 'critical' : 'warning',
      priority: isCritical ? 'high' : 'medium',
      action: isCritical
        ? `🚨🚨 PROTOCOLE URGENCE: 1) ARRÊTER ALIMENTATION 48-72h. 2) ${actionDetail}3) Répéter renouvellement 30% toutes 6-8h.`
        : `🚨 URGENT: 1) ${actionDetail}2) Arrêter alimentation 24h. 3) Nettoyer biofiltre + augmenter débit filtration 50%.`,
      reason: `L'ammoniac (NH3) provient excrétion azotée poissons. NH3 traverse librement membranes cellulaires → toxicité immédiate. À pH >8, forme toxique augmente exponentiellement.${actionDetail}`,
      healthImpact: isCritical
        ? '⚠️⚠️ CRITIQUE SÉVÈRE: MORTALITÉ 30-90% dans 24-96h. Nécroses branchiales massives, œdème cérébral, convulsions, hémorragies.'
        : '⚠️ GRAVE: Empoisonnement chronique, nécrose branchiale (efficacité respiratoire réduite 40-70%), croissance stoppée, immunosuppression sévère.',
      technicalDetails: isCritical
        ? `NH3-N >1 mg/L = toxicité aiguë. Renouvellements répétés (objectif <0.5 mg/L en 24h). Zeolite (100g/m³) adsorber NH4+.${actionDetail}`
        : `NH3-N 0.5-1.0 mg/L = toxique subcritique. Ensemencement bactérien (5-10mL/m³ concentré). Vérifier surface filtrante.${actionDetail}`,
      timeline: isCritical ? '⏰ IMMÉDIAT (0-2h) puis suivi toutes 6h pendant 72h' : '⏰ URGENT (0-4h) puis suivi quotidien',
      preventiveMeasures: ['Test NH3/NH4+ 2x/jour phase critique', 'Dimensionner biofiltre: 1-2 m²/kg aliment/jour', 'Ensemencement bactérien mensuel', 'Éviter suralimentation', 'Changements eau partiels réguliers (20-30% hebdo)'],
      estimatedCost: isCritical ? '150,000-600,000 XOF (bactéries + zeolite + eau)' : '50,000-200,000 XOF (bactéries + entretien)'
    });
    healthScore -= isCritical ? 45 : 22;
  }

  const density = fishCount / pondVolume;
  const optimalDensity = getOptimalDensity(pondType);
  
  if (density > optimalDensity * 1.2) {
    const isCritical = density > optimalDensity * 1.5;
    const excessPercentage = ((density / optimalDensity - 1) * 100).toFixed(0);
    const fishToRemove = Math.round((density - optimalDensity) * pondVolume);
    
    recommendations.push({
      parameter: 'Densité de poissons',
      currentValue: density,
      optimalRange: `${optimalDensity} poissons/m³`,
      status: isCritical ? 'critical' : 'warning',
      priority: isCritical ? 'high' : 'medium',
      action: isCritical
        ? `🚨 SURPOPULATION CRITIQUE (+${excessPercentage}%): Transférer immédiatement ${fishToRemove} poissons. Doubler l'aération ET la filtration.`
        : `🚨 SURPOPULATION (+${excessPercentage}%): Planifier transfert de ${fishToRemove} poissons dans les 7-14 jours. Augmenter aération de 50%.`,
      reason: `Surpopulation génère: 1) COMPÉTITION pour O2. 2) ACCUMULATION de toxiques (NH3). 3) STRESS social: combats. 4) ESPACE vital insuffisant.`,
      healthImpact: isCritical
        ? `⚠️⚠️ CRITIQUE: MORTALITÉ chronique 5-30% par mois. Nanisme généralisé, déformations squelettiques, cannibalisme, immunosuppression totale.`
        : `⚠️ GRAVE: Croissance hétérogène, stress chronique, agressivité accrue, vulnérabilité parasitaire, mortalité larvée 2-10% par mois.`,
      technicalDetails: `Densité: ${density.toFixed(1)} vs ${optimalDensity}/m³. Biomasse: ${((density * pondVolume * averageWeight) / 1000).toFixed(1)} kg. Transférer ${fishToRemove} poissons.`,
      timeline: isCritical ? '⏰ IMMÉDIAT (0-48h)' : '⏰ URGENT (7-14 jours)',
      preventiveMeasures: [`Respecter densité max: ${optimalDensity} poissons/m³`, 'Compter régulièrement le stock', 'Prévoir bassins de délestage', 'Calibrer dès 20% variation taille'],
      estimatedCost: isCritical ? '100,000-500,000 XOF (transfert urgence)' : '50,000-200,000 XOF (transfert planifié)'
    });
    healthScore -= isCritical ? 30 : 15;
  }

  healthScore = Math.max(0, Math.min(100, healthScore));
  
  let status: 'critical' | 'warning' | 'good' | 'excellent';
  if (healthScore < 40) status = 'critical';
  else if (healthScore < 70) status = 'warning';
  else if (healthScore < 90) status = 'good';
  else status = 'excellent';

  let summary = '';
  if (status === 'critical') {
    summary = `⚠️⚠️ SITUATION CRITIQUE - Score: ${healthScore}/100. Actions d'urgence IMMÉDIATES requises pour éviter mortalité massive. ${recommendations.length} problèmes critiques.`;
  } else if (status === 'warning') {
    summary = `⚠️ ATTENTION - Score: ${healthScore}/100. Plusieurs paramètres hors normes. ${recommendations.length} problèmes nécessitent corrections rapides.`;
  } else if (status === 'good') {
    summary = `✅ BON - Score: ${healthScore}/100. Conditions acceptables mais améliorables. ${recommendations.length > 0 ? `${recommendations.length} ajustement(s) recommandé(s)` : 'Surveillance continue'}.`;
  } else {
    summary = `✅✅ EXCELLENT - Score: ${healthScore}/100. Paramètres optimaux. Environnement idéal pour croissance maximale.`;
  }

  return { healthScore, status, recommendations, summary };
};
