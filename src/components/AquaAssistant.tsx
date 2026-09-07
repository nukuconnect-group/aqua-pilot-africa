import { SUPABASE_URL } from '@/integrations/supabase/env';
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Mic, MicOff, Volume2, Loader2, Building2, Fish, Utensils, HeartPulse, TrendingUp, Settings, Sparkles, ChevronDown, Globe, Maximize2, Minimize2, Crown, Lock, Calculator, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { CHAT_ERROR_LABEL } from '@/lib/chatErrors';
import { useChatGuard } from '@/hooks/useChatGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useSettings } from '@/contexts/SettingsContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  unitId?: string;
}


interface Category {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  suggestions: string[];
}

interface Language {
  id: string;
  label: string;
  code: string;
  flag: string;
}

const languages: Language[] = [
  { id: 'fr', label: 'Français', code: 'fr-FR', flag: '🇫🇷' },
  { id: 'en', label: 'English', code: 'en-US', flag: '🇺🇸' },
  { id: 'ewe', label: 'Eʋegbe (Ewe)', code: 'ee-GH', flag: '🇬🇭' },
  { id: 'kabye', label: 'Kabɩyɛ', code: 'fr-TG', flag: '🇹🇬' },
  { id: 'adja', label: 'Adja', code: 'fr-BJ', flag: '🇧🇯' },
  { id: 'lingala', label: 'Lingála', code: 'ln-CD', flag: '🇨🇩' },
  { id: 'wolof', label: 'Wolof', code: 'wo-SN', flag: '🇸🇳' },
  { id: 'bambara', label: 'Bambara', code: 'bm-ML', flag: '🇲🇱' },
  { id: 'hausa', label: 'Hausa', code: 'ha-NG', flag: '🇳🇬' },
  { id: 'yoruba', label: 'Yorùbá', code: 'yo-NG', flag: '🇳🇬' },
  { id: 'swahili', label: 'Kiswahili', code: 'sw-KE', flag: '🇰🇪' },
  { id: 'fon', label: 'Fɔngbè', code: 'fr-BJ', flag: '🇧🇯' },
];

const categories: Category[] = [
  {
    id: 'production',
    label: 'Production',
    icon: <Fish className="w-4 h-4" />,
    color: 'bg-blue-500',
    suggestions: [
      "Quel est l'état de mes cycles de production ?",
      "Combien de poissons ai-je en stock ?",
      "Quand prévoir la prochaine récolte ?",
      "Comment optimiser ma densité d'élevage ?",
    ]
  },
  {
    id: 'feeding',
    label: 'Alimentation',
    icon: <Utensils className="w-4 h-4" />,
    color: 'bg-orange-500',
    suggestions: [
      "Quel est mon stock d'aliments actuel ?",
      "Calcule la ration journalière optimale",
      "Quand dois-je commander de l'aliment ?",
      "Quel est mon FCR moyen ?",
    ]
  },
  {
    id: 'health',
    label: 'Santé',
    icon: <HeartPulse className="w-4 h-4" />,
    color: 'bg-red-500',
    suggestions: [
      "Y a-t-il des alertes sanitaires ?",
      "Quel est le taux de mortalité actuel ?",
      "Quand faire le prochain contrôle sanitaire ?",
      "Comment prévenir les maladies courantes ?",
    ]
  },
  {
    id: 'economics',
    label: 'Économie',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'bg-green-500',
    suggestions: [
      "Quel est mon coût de production par kg ?",
      "Analyse ma rentabilité actuelle",
      "Prévision des revenus ce mois",
      "Comment réduire mes coûts ?",
    ]
  },
  {
    id: 'general',
    label: 'Général',
    icon: <Settings className="w-4 h-4" />,
    color: 'bg-purple-500',
    suggestions: [
      "Donne-moi un résumé de ma ferme",
      "Quelles tâches sont prioritaires aujourd'hui ?",
      "Comment améliorer mes performances ?",
      "Conseils pour la saison actuelle",
    ]
  },
];

const AquaAssistant = () => {
  const { units, activeUnit } = useProductionUnits();
  const { t } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPremium, setIsPremium] = useState(false); // Option premium
  const STORAGE_KEY = 'aqua_assistant_messages_v1';
  const DEFAULT_GREETING: Message = { role: 'assistant', content: "Bonjour ! Je suis AquaAssistant, votre expert aquacole. Sélectionnez une catégorie ou posez-moi directement votre question. Je peux vous donner des informations précises sur vos cycles, stocks, et lots de poissons." };
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load chat history', e);
    }
    return [DEFAULT_GREETING];
  });

  // Persist messages to localStorage so user can review previous chats
  useEffect(() => {
    try {
      // Cap at last 200 messages to keep storage reasonable
      const toStore = messages.slice(-200);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to save chat history', e);
    }
  }, [messages]);

  const clearChatHistory = () => {
    if (confirm('Effacer tout l\'historique de conversation ?')) {
      setMessages([DEFAULT_GREETING]);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  };
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const {
    chatError,
    lastAttempt,
    retryIn,
    canRetryNow,
    maxAttempts,
    beginAttempt,
    failFromError,
    succeed: markChatSuccess,
    clearError: clearChatError,
  } = useChatGuard();
  const [isListening, setIsListening] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(activeUnit?.id || null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Synchroniser avec l'unité active du contexte
  useEffect(() => {
    if (activeUnit?.id && activeUnit.id !== selectedUnitId) {
      setSelectedUnitId(activeUnit.id);
      // Ajouter un message automatique lors du changement d'unité
      if (isOpen && messages.length > 1) {
        const unitName = activeUnit.name;
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `📍 Contexte basculé vers l'unité "${unitName}". Je peux maintenant répondre avec les données spécifiques de cette unité.` 
        }]);
      }
    }
  }, [activeUnit?.id]);

  // Données réelles pour le contexte
  const { batches } = useLivestockBatches(selectedUnitId || undefined);
  const { stocks: feedStocks } = useFeedStocks();
  const { cycles } = useProductionCycles(selectedUnitId || undefined);
  const { records: healthRecords } = useHealthRecords(undefined, selectedUnitId || undefined);
  const { records: feedingRecords } = useFeedingRecords();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);


  // Initialize speech recognition
  const currentLang = languages.find(l => l.id === selectedLanguage);
  
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = currentLang?.code || 'fr-FR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Erreur micro",
          description: "Je n'ai pas pu vous entendre. Réessayez.",
          variant: "destructive"
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [selectedLanguage, currentLang?.code]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Micro non disponible",
        description: "Votre navigateur ne supporte pas la reconnaissance vocale.",
        variant: "destructive"
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLang?.code || 'fr-FR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  // Générer le contexte des données réelles pour l'assistant
  const generateDataContext = () => {
    const unitName = units.find(u => u.id === selectedUnitId)?.name || 'toutes les unités';
    let context = `\n\n[DONNÉES RÉELLES DE L'UTILISATEUR - ${unitName}]\n`;

    // Cycles de production
    if (cycles.length > 0) {
      const activeCycles = cycles.filter(c => c.status === 'active');
      context += `\n📊 CYCLES DE PRODUCTION:\n`;
      context += `- ${activeCycles.length} cycle(s) actif(s) sur ${cycles.length} total\n`;
      activeCycles.forEach(cycle => {
        const progress = cycle.target_quantity > 0 ? ((cycle.current_quantity / cycle.target_quantity) * 100).toFixed(1) : 0;
        const daysActive = cycle.start_date ? Math.floor((Date.now() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        context += `  • ${cycle.name}: ${cycle.species || 'N/A'}, ${cycle.current_quantity?.toLocaleString() || 0} poissons, progression ${progress}%, ${daysActive} jours actif\n`;
      });
    } else {
      context += `\n📊 CYCLES: Aucun cycle enregistré\n`;
    }

    // Lots de poissons (cheptel)
    if (batches.length > 0) {
      const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const totalWeight = batches.reduce((sum, b) => sum + (b.total_weight || 0), 0);
      const healthyBatches = batches.filter(b => b.status === 'healthy').length;
      context += `\n🐟 CHEPTEL (LOTS DE POISSONS):\n`;
      context += `- ${batches.length} lot(s), ${totalQuantity.toLocaleString()} individus total, ${totalWeight.toFixed(1)} kg\n`;
      context += `- ${healthyBatches} lot(s) en bonne santé\n`;
      batches.slice(0, 5).forEach(batch => {
        context += `  • ${batch.species} (${batch.variety || 'standard'}): ${batch.quantity?.toLocaleString() || 0} ind., ${batch.average_weight || 0}g/ind., ${batch.status}\n`;
      });
    } else {
      context += `\n🐟 CHEPTEL: Aucun lot enregistré\n`;
    }

    // Stocks d'aliments
    const unitStocks = selectedUnitId ? feedStocks.filter(s => s.unit_id === selectedUnitId) : feedStocks;
    if (unitStocks.length > 0) {
      const totalStock = unitStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
      const lowStocks = unitStocks.filter(s => s.quantity <= (s.min_threshold || 50));
      context += `\n🌾 STOCK D'ALIMENTS:\n`;
      context += `- ${unitStocks.length} type(s) d'aliment, ${totalStock.toFixed(1)} kg total\n`;
      if (lowStocks.length > 0) {
        context += `- ⚠️ ${lowStocks.length} stock(s) faible(s)!\n`;
      }
      unitStocks.forEach(stock => {
        const status = stock.quantity <= (stock.min_threshold || 50) ? '⚠️ FAIBLE' : '✅';
        context += `  • ${stock.feed_type}: ${stock.quantity} ${stock.unit} ${status}\n`;
      });
    } else {
      context += `\n🌾 STOCK: Aucun stock enregistré\n`;
    }

    // Données de santé et mortalité
    if (healthRecords.length > 0) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentRecords = healthRecords.filter(r => new Date(r.date) >= weekAgo);
      const totalMortality = recentRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
      const avgTemp = recentRecords.length > 0 
        ? recentRecords.reduce((sum, r) => sum + (r.temperature || 0), 0) / recentRecords.filter(r => r.temperature).length 
        : 0;
      const avgPh = recentRecords.length > 0 
        ? recentRecords.reduce((sum, r) => sum + (r.ph || 0), 0) / recentRecords.filter(r => r.ph).length 
        : 0;
      
      context += `\n❤️ SANTÉ (7 derniers jours):\n`;
      context += `- Mortalité: ${totalMortality} individus\n`;
      if (avgTemp > 0) context += `- Température moyenne: ${avgTemp.toFixed(1)}°C\n`;
      if (avgPh > 0) context += `- pH moyen: ${avgPh.toFixed(1)}\n`;
    }

    // Alimentation récente
    if (feedingRecords.length > 0) {
      const unitFeedings = selectedUnitId ? feedingRecords.filter(r => r.unit_id === selectedUnitId) : feedingRecords;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentFeedings = unitFeedings.filter(r => new Date(r.date) >= weekAgo);
      const totalFed = recentFeedings.reduce((sum, r) => sum + (r.quantity || 0), 0);
      
      context += `\n🍽️ ALIMENTATION (7 derniers jours):\n`;
      context += `- ${recentFeedings.length} nourrissage(s), ${totalFed.toFixed(1)} kg distribués\n`;
    }

    return context;
  };

  const sendMessage = async (messageText?: string) => {
    const isRetry = Boolean(messageText);
    const textToSend = messageText || input.trim();
    if (isLoading) return;
    const ctx = beginAttempt(textToSend, isRetry);
    if (!ctx) return;

    const selectedUnitName = units.find(u => u.id === selectedUnitId)?.name;
    const contextPrefix = selectedUnitId && selectedUnitName 
      ? `[Contexte: Unité "${selectedUnitName}"] ` 
      : '';

    // Toujours envoyer le contexte des données réelles
    const dataContext = generateDataContext();

    const userMessage: Message = { 
      role: 'user', 
      content: textToSend,
      category: selectedCategory || undefined,
      unitId: selectedUnitId || undefined
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const authErr = new Error("Session expirée. Reconnectez-vous pour utiliser l'assistant.");
        (authErr as unknown as { status: number }).status = 401;
        failFromError(authErr, ctx.attempt);
        setIsLoading(false);
        return;
      }

      // Enrichir le message avec le contexte des données
      const enrichedMessages = newMessages.map(m => ({
        role: m.role,
        content: m.role === 'user' && m === userMessage 
          ? `${contextPrefix}${m.content}${dataContext}`
          : m.content
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/aqua-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-request-id': ctx.requestId,
        },
        body: JSON.stringify({ 
          messages: enrichedMessages,
          category: selectedCategory,
          unitId: selectedUnitId,
          language: currentLang?.label || 'Français'
        }),
      });

      if (!response.ok) {
        let serverMessage = '';
        try {
          const errorData = await response.json();
          serverMessage = errorData?.error || '';
        } catch {
          serverMessage = '';
        }
        const err = new Error(serverMessage || `Erreur serveur (${response.status})`);
        (err as any).status = response.status;
        throw err;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('Pas de réponse');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
      markChatSuccess();
    } catch (error) {
      console.error('Assistant error:', error);
      failFromError(error, ctx.attempt);
      if (!assistantContent) {
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const currentUnit = units.find(u => u.id === selectedUnitId);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group ${isOpen ? 'hidden' : ''}`}
        aria-label="Ouvrir l'assistant"
      >
        <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>

      {/* Chat modal */}
      {isOpen && (
        <div className={`fixed z-50 flex flex-col bg-background border border-border shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'inset-0 rounded-none' 
            : 'inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] rounded-none sm:rounded-2xl'
        }`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-3 sm:p-4 text-white">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg leading-tight">AquaAssistant Pro</h3>
                  <p className="text-xs sm:text-sm text-white/80 leading-tight">Expert aquacole IA</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Clear chat history */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearChatHistory}
                  className="text-white hover:bg-white/20 h-8 px-2 text-xs"
                  title="Effacer l'historique de conversation"
                >
                  Effacer
                </Button>
                {/* Fullscreen toggle - visible on mobile/tablet */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setIsOpen(false); setIsFullscreen(false); }}
                  className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>

            {/* Unit selector */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button
                  onClick={() => { setShowUnitSelector(!showUnitSelector); setShowLanguageSelector(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{currentUnit?.name || 'Toutes unités'}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showUnitSelector ? 'rotate-180' : ''}`} />
                </button>
                
                {showUnitSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedUnitId(null); setShowUnitSelector(false); }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${!selectedUnitId ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                    >
                      Toutes les unités
                    </button>
                    {units.map(unit => (
                      <button
                        key={unit.id}
                        onClick={() => { setSelectedUnitId(unit.id); setShowUnitSelector(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${selectedUnitId === unit.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                      >
                        {unit.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Language selector */}
              <div className="relative">
                <button
                  onClick={() => { setShowLanguageSelector(!showLanguageSelector); setShowUnitSelector(false); }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  <span>{currentLang?.flag}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showLanguageSelector ? 'rotate-180' : ''}`} />
                </button>
                
                {showLanguageSelector && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-10 min-w-[160px] max-h-64 overflow-y-auto">
                    {languages.map(lang => (
                      <button
                        key={lang.id}
                        onClick={() => { setSelectedLanguage(lang.id); setShowLanguageSelector(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 ${selectedLanguage === lang.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Premium banner */}
          {!isPremium && (
            <div className="px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-200/50">
              <button
                onClick={() => setShowPremiumModal(true)}
                className="w-full flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Passez à Premium</span>
                </div>
                <div className="flex items-center gap-1 text-amber-600">
                  <Calculator className="w-3 h-3" />
                  <BarChart3 className="w-3 h-3" />
                  <Lock className="w-3 h-3" />
                </div>
              </button>
            </div>
          )}

          {/* Categories */}
          <div className="p-2 border-b border-border bg-muted/30">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat.id 
                      ? `${cat.color} text-white shadow-md` 
                      : 'bg-background hover:bg-muted border border-border'
                  }`}
                >
                  <span className="hidden sm:inline">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {currentCategory && messages.length <= 2 && (
            <div className="p-2 sm:p-3 bg-muted/20 border-b border-border">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1.5 sm:mb-2">Suggestions :</p>
              <div className="flex flex-col sm:flex-wrap sm:flex-row gap-1.5">
                {currentCategory.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 text-[11px] sm:text-xs bg-background hover:bg-primary/10 border border-border rounded-lg sm:rounded-full transition-colors hover:border-primary/50 leading-snug text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages with WhatsApp-style background */}
          <ScrollArea 
            className="flex-1 relative" 
            ref={scrollRef}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2306b6d4' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundColor: 'hsl(var(--muted) / 0.3)'
            }}
          >
            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] p-2.5 sm:p-3 rounded-2xl shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-md'
                        : 'bg-background text-foreground rounded-bl-md border border-border/50'
                    }`}
                  >
                    {msg.role === 'user' && msg.unitId && (
                      <Badge variant="secondary" className="mb-1 sm:mb-1.5 text-[9px] sm:text-[10px] bg-white/20 text-white border-0">
                        <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                        {units.find(u => u.id === msg.unitId)?.name}
                      </Badge>
                    )}
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.role === 'assistant' && msg.content && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => speakText(msg.content)}
                        className="mt-1.5 sm:mt-2 h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs opacity-70 hover:opacity-100"
                      >
                        <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
                        Écouter
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="bg-background border border-border/50 p-2.5 sm:p-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Analyse en cours...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-2.5 sm:p-4 border-t border-border bg-background">
            {chatError && (
              <div
                className="mb-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5 text-left"
                data-chat-error={chatError.cause}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-destructive">
                      {CHAT_ERROR_LABEL[chatError.cause]}
                      {chatError.attempt ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          (tentative {chatError.attempt}/{maxAttempts})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground break-words">{chatError.message}</p>
                    <dl className="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground/90 font-mono break-all">
                      {chatError.requestId && (
                        <div className="flex gap-1">
                          <dt className="shrink-0">request_id:</dt>
                          <dd data-chat-request-id>{chatError.requestId}</dd>
                        </div>
                      )}
                      {chatError.route && (
                        <div className="flex gap-1">
                          <dt className="shrink-0">route:</dt>
                          <dd data-chat-route>{chatError.route}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {chatError.retryable && lastAttempt && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          disabled={isLoading || !canRetryNow}
                          onClick={() => sendMessage(lastAttempt)}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {canRetryNow ? 'Réessayer' : `Réessayer dans ${retryIn}s`}
                        </Button>
                      )}
                      {chatError.requestId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px]"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `request_id=${chatError.requestId} route=${chatError.route} cause=${chatError.cause} message=${chatError.message}`,
                            )
                          }
                        >
                          Copier le diagnostic
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={clearChatError}
                      >
                        Fermer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="icon"
                onClick={toggleListening}
                className="shrink-0 h-9 w-9 sm:h-10 sm:w-10"
                disabled={isLoading}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => { setInput(e.target.value); if (chatError) clearChatError(); }}
                onKeyPress={handleKeyPress}
                placeholder="Posez votre question..."
                className="flex-1 h-9 sm:h-10 text-sm"
                disabled={isLoading}
                data-chat-input
              />
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading}
                size="icon"
                className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                aria-label="Envoyer le message"
                data-chat-send
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </Button>
            </div>
            {isListening && (
              <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-1.5 sm:mt-2 animate-pulse">
                🎤 Écoute en cours... Parlez maintenant
              </p>
            )}
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">AquaAssistant Premium</h3>
                  <p className="text-xs text-white/80">Fonctionnalités avancées</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Calculs de production</p>
                    <p className="text-xs text-muted-foreground">Estimations précises de rendement</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Analyse de rentabilité</p>
                    <p className="text-xs text-muted-foreground">ROI et marges détaillées</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium">Prévisions avancées</p>
                    <p className="text-xs text-muted-foreground">Planification et scénarios</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-3 space-y-2">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                  <div className="flex items-center gap-2 mb-1">
                    <Crown className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-400">En cours de développement</span>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400/80">
                    Cette fonctionnalité premium sera bientôt disponible. Restez connecté pour les mises à jour !
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full text-sm"
                  onClick={() => setShowPremiumModal(false)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AquaAssistant;