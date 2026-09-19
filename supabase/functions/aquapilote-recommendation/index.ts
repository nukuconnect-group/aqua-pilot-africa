import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IoTData {
  temperature: number;
  oxygene_dissous: number;
  ph: number;
  ammonium: number;
  nitrite: number;
  unit_id?: string;
}

interface AquapiloteResponse {
  alerte: boolean;
  conseil: string;
}

// Seuils critiques pour les paramètres de qualité de l'eau
const THRESHOLDS = {
  temperature: { min_critical: 12, min_warning: 18, max_warning: 30, max_critical: 32, optimal: { min: 22, max: 28 } },
  ph: { min_critical: 5.5, min_warning: 6.5, max_warning: 8.5, max_critical: 9.0, optimal: { min: 6.8, max: 8.2 } },
  oxygen: { min_critical: 3.0, min_warning: 4.0, max_warning: 12, max_critical: 15, optimal: { min: 5.0, max: 8.0 } },
  ammonia: { min_critical: 0, min_warning: 0, max_warning: 0.5, max_critical: 1.0, optimal: { min: 0, max: 0.02 } },
  nitrite: { min_critical: 0, min_warning: 0, max_warning: 0.5, max_critical: 1.0, optimal: { min: 0, max: 0.1 } }
};

// Analyser localement les paramètres avant d'appeler l'IA
function analyzeParameters(data: IoTData): { hasAlert: boolean; issues: string[]; criticalParams: string[] } {
  const issues: string[] = [];
  const criticalParams: string[] = [];
  
  // Température
  if (data.temperature <= THRESHOLDS.temperature.min_critical) {
    issues.push(`🚨 TEMPÉRATURE CRITIQUE: ${data.temperature}°C - Risque de mortalité massive!`);
    criticalParams.push('température');
  } else if (data.temperature <= THRESHOLDS.temperature.min_warning) {
    issues.push(`⚠️ Température basse: ${data.temperature}°C - Métabolisme ralenti`);
  } else if (data.temperature >= THRESHOLDS.temperature.max_critical) {
    issues.push(`🚨 TEMPÉRATURE CRITIQUE: ${data.temperature}°C - Choc thermique imminent!`);
    criticalParams.push('température');
  } else if (data.temperature >= THRESHOLDS.temperature.max_warning) {
    issues.push(`⚠️ Température élevée: ${data.temperature}°C - Stress thermique`);
  }
  
  // pH
  if (data.ph <= THRESHOLDS.ph.min_critical) {
    issues.push(`🚨 pH CRITIQUE: ${data.ph} - Acidose sévère!`);
    criticalParams.push('pH');
  } else if (data.ph <= THRESHOLDS.ph.min_warning) {
    issues.push(`⚠️ pH bas: ${data.ph} - Stress acide`);
  } else if (data.ph >= THRESHOLDS.ph.max_critical) {
    issues.push(`🚨 pH CRITIQUE: ${data.ph} - Alcalose dangereuse!`);
    criticalParams.push('pH');
  } else if (data.ph >= THRESHOLDS.ph.max_warning) {
    issues.push(`⚠️ pH élevé: ${data.ph} - Toxicité NH3 accrue`);
  }
  
  // Oxygène
  if (data.oxygene_dissous <= THRESHOLDS.oxygen.min_critical) {
    issues.push(`🚨🚨 OXYGÈNE CRITIQUE: ${data.oxygene_dissous} mg/L - ASPHYXIE IMMINENTE!`);
    criticalParams.push('oxygène');
  } else if (data.oxygene_dissous <= THRESHOLDS.oxygen.min_warning) {
    issues.push(`⚠️ Oxygène bas: ${data.oxygene_dissous} mg/L - Hypoxie`);
  }
  
  // Ammoniac
  if (data.ammonium >= THRESHOLDS.ammonia.max_critical) {
    issues.push(`🚨 AMMONIAQUE CRITIQUE: ${data.ammonium} mg/L - Toxicité aiguë!`);
    criticalParams.push('ammoniaque');
  } else if (data.ammonium >= THRESHOLDS.ammonia.max_warning) {
    issues.push(`⚠️ Ammoniaque élevé: ${data.ammonium} mg/L - Toxicité chronique`);
  }
  
  // Nitrite
  if (data.nitrite >= THRESHOLDS.nitrite.max_critical) {
    issues.push(`🚨 NITRITE CRITIQUE: ${data.nitrite} mg/L - Méthémoglobinémie!`);
    criticalParams.push('nitrite');
  } else if (data.nitrite >= THRESHOLDS.nitrite.max_warning) {
    issues.push(`⚠️ Nitrite élevé: ${data.nitrite} mg/L - Toxicité`);
  }
  
  return {
    hasAlert: issues.length > 0,
    issues,
    criticalParams
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Utilisateur non authentifié. Veuillez vous connecter.');
    }

    const { iotData, language }: { iotData: IoTData; language?: string } = await req.json();
    
    console.log('Received IoT data:', iotData);

    // Analyse locale des paramètres
    const localAnalysis = analyzeParameters(iotData);
    
    const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY');
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is not configured');
    }

    // Construire le prompt avec contexte des alertes
    const alertContext = localAnalysis.hasAlert 
      ? `\n\n⚠️ ALERTES DÉTECTÉES:\n${localAnalysis.issues.join('\n')}\n\nParamètres critiques: ${localAnalysis.criticalParams.join(', ')}`
      : '';

    // Préparer le message utilisateur avec les données IoT
    const userMessage = `Analyse ces paramètres d'eau en aquaculture et fournis des recommandations DÉTAILLÉES et ACTIONNABLES:

📊 PARAMÈTRES ACTUELS:
- Température de l'eau: ${iotData.temperature}°C (optimal: 22-28°C)
- Oxygène dissous: ${iotData.oxygene_dissous} mg/L (optimal: 5-8 mg/L)
- pH: ${iotData.ph} (optimal: 6.8-8.2)
- Ammonium/Ammoniaque: ${iotData.ammonium} mg/L (optimal: <0.02 mg/L)
- Nitrite: ${iotData.nitrite} mg/L (optimal: <0.1 mg/L)
${alertContext}

INSTRUCTIONS:
1. Si un paramètre est CRITIQUE (hors normes dangereuses), commence par "🚨 ALERTE CRITIQUE:" suivi des actions IMMÉDIATES à prendre
2. Explique POURQUOI chaque paramètre problématique est dangereux pour les poissons
3. Donne des ACTIONS CONCRÈTES avec doses et quantités précises
4. Indique le DÉLAI d'intervention (immédiat, 1-4h, 24h)
5. Si tout est normal, confirme que les conditions sont optimales

Réponds UNIQUEMENT avec un objet JSON contenant:
- 'alerte' (boolean): true si un paramètre nécessite une intervention urgente
- 'conseil' (string): tes recommandations détaillées en français`;

    console.log('Calling Mistral API...');

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: `Réponds impérativement en ${language || 'Français'}.

Tu es Aquapilote, un expert senior en aquaculture avec 20 ans d'expérience. Tu analyses les paramètres d'eau des bassins piscicoles et fournis des recommandations PRÉCISES, ACTIONNABLES et URGENTES quand nécessaire.

RÈGLES CRITIQUES:
- Si pH < 6.0 ou pH > 9.0 → ALERTE CRITIQUE
- Si température < 15°C ou > 30°C → ALERTE CRITIQUE  
- Si oxygène < 4 mg/L → ALERTE CRITIQUE URGENTE
- Si ammoniaque > 0.5 mg/L → ALERTE CRITIQUE
- Si nitrite > 0.5 mg/L → ALERTE CRITIQUE

Pour chaque alerte, tu DOIS donner:
1. La CAUSE du problème
2. L'ACTION IMMÉDIATE à prendre (avec doses précises)
3. Le RISQUE si non traité (mortalité, stress, etc.)
4. Le DÉLAI maximum d'intervention

Réponds TOUJOURS avec un JSON valide: {"alerte": boolean, "conseil": "string"}`
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Mistral API error:', response.status, errorText);
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Mistral API response:', data);

    // Extraire le contenu de la réponse
    const messageContent = data.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error('No content in Mistral response');
    }

    // Parser le JSON de la réponse
    let aquapiloteResponse: AquapiloteResponse;
    try {
      // Extraire le JSON s'il est entouré de texte
      const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aquapiloteResponse = JSON.parse(jsonMatch[0]);
      } else {
        aquapiloteResponse = JSON.parse(messageContent);
      }
    } catch (parseError) {
      console.error('Failed to parse Mistral response as JSON:', messageContent);
      // Fallback: utiliser l'analyse locale si l'IA échoue
      aquapiloteResponse = {
        alerte: localAnalysis.hasAlert,
        conseil: localAnalysis.hasAlert 
          ? `Analyse automatique:\n${localAnalysis.issues.join('\n')}\n\nVeuillez consulter un expert aquacole pour des recommandations détaillées.`
          : 'Tous les paramètres sont dans les plages normales. Continuez la surveillance régulière.'
      };
    }

    // Valider la structure de la réponse
    if (typeof aquapiloteResponse.alerte !== 'boolean' || typeof aquapiloteResponse.conseil !== 'string') {
      // Fallback si structure invalide
      aquapiloteResponse = {
        alerte: localAnalysis.hasAlert,
        conseil: localAnalysis.hasAlert 
          ? `Analyse automatique:\n${localAnalysis.issues.join('\n')}`
          : 'Paramètres dans les normes acceptables.'
      };
    }

    // Forcer l'alerte si l'analyse locale a détecté des problèmes critiques
    if (localAnalysis.criticalParams.length > 0 && !aquapiloteResponse.alerte) {
      aquapiloteResponse.alerte = true;
    }

    console.log('Final response:', aquapiloteResponse);

    // Save analysis to database
    const { error: saveError } = await supabase
      .from('ai_analyses')
      .insert({
        user_id: user.id,
        unit_id: iotData.unit_id || null,
        temperature: iotData.temperature,
        oxygene_dissous: iotData.oxygene_dissous,
        ph: iotData.ph,
        ammonium: iotData.ammonium,
        nitrite: iotData.nitrite,
        alerte: aquapiloteResponse.alerte,
        conseil: aquapiloteResponse.conseil
      });

    if (saveError) {
      console.error('Error saving analysis:', saveError);
      // Don't fail the request, just log the error
    }

    return new Response(JSON.stringify(aquapiloteResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in aquapilote-recommendation function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        alerte: true,
        conseil: 'Une erreur est survenue lors de l\'analyse des données. Veuillez vérifier manuellement les paramètres de l\'eau.'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
