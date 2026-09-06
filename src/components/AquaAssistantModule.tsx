import { SUPABASE_URL } from '@/integrations/supabase/env';
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Mic, MicOff, Volume2, Loader2, Building2, Fish, Utensils, HeartPulse, TrendingUp, Settings, Sparkles, ChevronDown, Globe, Crown, Lock, Calculator, BarChart3, History, MessageSquarePlus, Trash2, X, Maximize2, Minimize2, AlertTriangle, RefreshCw } from 'lucide-react';
import { CHAT_ERROR_LABEL } from '@/lib/chatErrors';
import { useChatGuard } from '@/hooks/useChatGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLivestockBatches } from '@/hooks/useLivestockBatches';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';
import { useSettings } from '@/contexts/SettingsContext';
import { useAquaAssistantConversations, AquaMessage } from '@/hooks/useAquaAssistantConversations';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  unitId?: string;
}

// Category type no longer needed - using config arrays instead

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
  { id: 'wolof', label: 'Wolof', code: 'wo-SN', flag: '🇸🇳' },
  { id: 'swahili', label: 'Kiswahili', code: 'sw-KE', flag: '🇰🇪' },
];

// Categories with full labels for mobile display
const getCategoryLabel = (lang: string, key: string): string => {
  const labels: Record<string, Record<string, string>> = {
    production: { fr: 'Production', en: 'Production' },
    feeding: { fr: 'Alimentation', en: 'Feeding' },
    health: { fr: 'Santé', en: 'Health' },
    economics: { fr: 'Économie', en: 'Economics' },
    general: { fr: 'Général', en: 'General' }
  };
  return labels[key]?.[lang] || labels[key]?.['fr'] || key;
};

const getCategorySuggestions = (lang: string, key: string): string[] => {
  const suggestions: Record<string, Record<string, string[]>> = {
    production: {
      fr: [
        "Quel est l'état de mes cycles de production ?",
        "Combien de poissons ai-je en stock ?",
        "Quand prévoir la prochaine récolte ?",
        "Comment optimiser ma densité d'élevage ?",
      ],
      en: [
        "What is the status of my production cycles?",
        "How many fish do I have in stock?",
        "When should I plan the next harvest?",
        "How to optimize my stocking density?",
      ]
    },
    feeding: {
      fr: [
        "Quel est mon stock d'aliments actuel ?",
        "Calcule la ration journalière optimale",
        "Quand dois-je commander de l'aliment ?",
        "Quel est mon FCR moyen ?",
      ],
      en: [
        "What is my current feed stock?",
        "Calculate the optimal daily ration",
        "When should I order feed?",
        "What is my average FCR?",
      ]
    },
    health: {
      fr: [
        "Y a-t-il des alertes sanitaires ?",
        "Quel est le taux de mortalité actuel ?",
        "Quand faire le prochain contrôle sanitaire ?",
        "Comment prévenir les maladies courantes ?",
      ],
      en: [
        "Are there any health alerts?",
        "What is the current mortality rate?",
        "When to do the next health check?",
        "How to prevent common diseases?",
      ]
    },
    economics: {
      fr: [
        "Quel est mon coût de production par kg ?",
        "Analyse ma rentabilité actuelle",
        "Prévision des revenus ce mois",
        "Comment réduire mes coûts ?",
      ],
      en: [
        "What is my production cost per kg?",
        "Analyze my current profitability",
        "Revenue forecast for this month",
        "How to reduce my costs?",
      ]
    },
    general: {
      fr: [
        "Donne-moi un résumé de ma ferme",
        "Quelles tâches sont prioritaires aujourd'hui ?",
        "Comment améliorer mes performances ?",
        "Conseils pour la saison actuelle",
      ],
      en: [
        "Give me a summary of my farm",
        "What tasks are priority today?",
        "How to improve my performance?",
        "Tips for the current season",
      ]
    }
  };
  return suggestions[key]?.[lang] || suggestions[key]?.['fr'] || [];
};

const categoryConfigs = [
  { id: 'production', icon: <Fish className="w-4 h-4" />, color: 'bg-blue-500' },
  { id: 'feeding', icon: <Utensils className="w-4 h-4" />, color: 'bg-orange-500' },
  { id: 'health', icon: <HeartPulse className="w-4 h-4" />, color: 'bg-red-500' },
  { id: 'economics', icon: <TrendingUp className="w-4 h-4" />, color: 'bg-green-500' },
  { id: 'general', icon: <Settings className="w-4 h-4" />, color: 'bg-purple-500' }
];

const AquaAssistantModule = () => {
  const { units, activeUnit } = useProductionUnits();
  const { t } = useSettings();
  const greeting = "Bonjour ! Je suis AquaAssistant, votre expert aquacole IA. Sélectionnez une catégorie ou posez-moi directement votre question. Je peux vous donner des informations précises sur vos cycles, stocks, et lots de poissons.";
  const {
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    startNew,
    persistMessages,
    deleteConversation,
    clearAll,
    loading: convsLoading,
  } = useAquaAssistantConversations(greeting);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: greeting }]);
  const [showHistory, setShowHistory] = useState(false);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Charge les messages de la conversation active depuis Supabase
  useEffect(() => {
    if (activeConversation?.messages?.length) {
      setMessages(
        activeConversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
          category: m.category,
          unitId: m.unitId,
        })),
      );
    } else if (!convsLoading && !activeConversation) {
      setMessages([{ role: 'assistant', content: greeting }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeConversation?.id]);

  // Crée automatiquement une conversation si l'utilisateur n'en a aucune
  useEffect(() => {
    if (!convsLoading && conversations.length === 0 && !activeId) {
      startNew(activeUnit ? { id: activeUnit.id, name: activeUnit.name } : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convsLoading, conversations.length]);

  // Synchroniser avec l'unité active
  useEffect(() => {
    if (activeUnit?.id && activeUnit.id !== selectedUnitId) {
      setSelectedUnitId(activeUnit.id);
      if (messages.length > 1) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `📍 Contexte basculé vers l'unité "${activeUnit.name}". Je peux maintenant répondre avec les données spécifiques de cette unité.` 
        }]);
      }
    }
  }, [activeUnit?.id]);

  // Données réelles
  const { batches } = useLivestockBatches(selectedUnitId || undefined);
  const { stocks: feedStocks } = useFeedStocks();
  const { cycles } = useProductionCycles(selectedUnitId || undefined);
  const { records: healthRecords } = useHealthRecords(undefined, selectedUnitId || undefined);
  const { records: feedingRecords } = useFeedingRecords();

  // Auto-scroll robuste : cible le viewport interne de Radix ScrollArea
  // ET utilise scrollIntoView sur une ancre en bas pour couvrir tous les cas
  // (streaming, changement de conversation, réponses longues, mobile).
  useEffect(() => {
    const scrollToBottom = () => {
      // 1) Radix ScrollArea : viewport réel
      const viewport = scrollRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]'
      ) as HTMLElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
      // 2) Ancre : garantie même quand le contenu grandit en streaming
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    // Deux passes : immédiat + après paint pour laisser le DOM se stabiliser
    scrollToBottom();
    const raf = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(raf);
  }, [messages, isLoading]);

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

  const generateDataContext = () => {
    const unitName = units.find(u => u.id === selectedUnitId)?.name || 'toutes les unités';
    let context = `\n\n[DONNÉES RÉELLES DE L'UTILISATEUR - ${unitName}]\n`;

    if (cycles.length > 0) {
      const activeCycles = cycles.filter(c => c.status === 'active');
      context += `\n📊 CYCLES DE PRODUCTION:\n`;
      context += `- ${activeCycles.length} cycle(s) actif(s) sur ${cycles.length} total\n`;
      activeCycles.forEach(cycle => {
        const progress = cycle.target_quantity > 0 ? ((cycle.current_quantity / cycle.target_quantity) * 100).toFixed(1) : 0;
        context += `  • ${cycle.name}: ${cycle.species || 'N/A'}, ${cycle.current_quantity?.toLocaleString() || 0} poissons, progression ${progress}%\n`;
      });
    }

    if (batches.length > 0) {
      const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      context += `\n🐟 CHEPTEL: ${batches.length} lot(s), ${totalQuantity.toLocaleString()} individus\n`;
    }

    const unitStocks = selectedUnitId ? feedStocks.filter(s => s.unit_id === selectedUnitId) : feedStocks;
    if (unitStocks.length > 0) {
      const totalStock = unitStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
      context += `\n🌾 STOCK D'ALIMENTS: ${totalStock.toFixed(1)} kg\n`;
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
      // Persiste la conversation après chaque échange
      try {
        let convId = activeId;
        if (!convId) {
          const created = await startNew(activeUnit ? { id: activeUnit.id, name: activeUnit.name } : undefined);
          convId = created?.id ?? null;
        }
        if (convId) {
          const finalMessages: AquaMessage[] = [
            ...newMessages.map((m) => ({
              role: m.role,
              content: m.content,
              category: m.category,
              unitId: m.unitId,
              unitName: units.find((u) => u.id === m.unitId)?.name ?? null,
            })),
            { role: 'assistant' as const, content: assistantContent, createdAt: new Date().toISOString() },
          ];
          await persistMessages(convId, finalMessages, selectedCategory ?? null);
        }
      } catch (e) {
        console.warn('Persistance historique chat échouée', e);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const langKey = selectedLanguage === 'en' ? 'en' : 'fr';
  const currentCategoryConfig = categoryConfigs.find(c => c.id === selectedCategory);
  const currentCategorySuggestions = selectedCategory ? getCategorySuggestions(langKey, selectedCategory) : [];
  const currentUnit = units.find(u => u.id === selectedUnitId);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-[80] flex flex-col gap-3 bg-background p-3 sm:p-4 overflow-hidden'
          : 'space-y-4'
      }
      style={
        isFullscreen
          ? {
              paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
            }
          : undefined
      }
    >
      {/* Header */}
      <Card className="shrink-0">
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 sm:p-6 text-white rounded-t-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-xl sm:text-2xl">AquaAssistant Pro</h1>
                <p className="text-sm text-white/80">Expert aquacole IA - Données en temps réel</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFullscreen((v) => !v)}
                className="flex items-center gap-2"
                title={isFullscreen ? 'Réduire' : 'Agrandir'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span className="hidden sm:inline">{isFullscreen ? 'Réduire' : 'Agrandir'}</span>
              </Button>
              <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPremiumModal(true)}
              className="hidden sm:flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Premium
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2"
              title="Historique des conversations"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Historique</span>
              {conversations.length > 0 && (
                <Badge variant="outline" className="ml-1 bg-white/20 text-white border-white/30">
                  {conversations.length}
                </Badge>
              )}
            </Button>
            </div>
          </div>

          {/* Selectors */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[150px]">
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground rounded-lg shadow-xl z-[90] max-h-60 overflow-y-auto border">
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
                <div className="absolute top-full right-0 mt-1 bg-popover text-popover-foreground rounded-lg shadow-xl z-[90] min-w-[180px] max-h-72 overflow-y-auto border">
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
      </Card>

      {/* Categories */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryConfigs.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id 
                    ? `${cat.color} text-white shadow-md` 
                    : 'bg-muted hover:bg-muted/80 border border-border'
                }`}
              >
                {cat.icon}
                <span className="inline">{getCategoryLabel(langKey, cat.id)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {currentCategoryConfig && currentCategorySuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {currentCategoryConfig.icon}
              {langKey === 'en' ? 'Suggested questions' : 'Questions suggérées'} - {getCategoryLabel(langKey, currentCategoryConfig.id)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {currentCategorySuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="text-left p-3 bg-muted/50 hover:bg-muted rounded-lg text-sm transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat area */}
      <Card
        className={
          isFullscreen
            ? 'flex flex-col flex-1 min-h-0'
            : 'flex flex-col h-[70vh] min-h-[500px] md:min-h-[600px]'
        }
      >
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span>Conversation</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? 'Réduire' : 'Agrandir'}
            aria-label={isFullscreen ? 'Réduire la fenêtre du chat' : 'Agrandir la fenêtre du chat'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
        <CardContent className="flex-1 flex flex-col p-0 min-h-0">
          <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-pre:my-2 prose-pre:bg-background/60 prose-code:before:hidden prose-code:after:hidden break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                    )}
                    {message.role === 'assistant' && message.content && (
                      <button
                        onClick={() => speakText(message.content)}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        Écouter
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-muted rounded-bl-md">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Réflexion en cours...</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Ancre pour l'auto-scroll : toujours en bas */}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="p-4 border-t bg-background sticky bottom-0">
            {chatError && (
              <div
                className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
                data-chat-error={chatError.cause}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-destructive">
                      {CHAT_ERROR_LABEL[chatError.cause]}
                      {chatError.attempt ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          (tentative {chatError.attempt}/{maxAttempts})
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground break-words">{chatError.message}</p>
                    <dl className="mt-2 space-y-0.5 text-[11px] font-mono text-muted-foreground/90 break-all">
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
                          disabled={isLoading || !canRetryNow}
                          onClick={() => sendMessage(lastAttempt)}
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          {canRetryNow ? 'Réessayer' : `Réessayer dans ${retryIn}s`}
                        </Button>
                      )}
                      {chatError.requestId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `request_id=${chatError.requestId} route=${chatError.route} cause=${chatError.cause} message=${chatError.message}`,
                            )
                          }
                        >
                          Copier le diagnostic
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={clearChatError}>
                        Fermer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleListening}
                className="shrink-0"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => { setInput(e.target.value); if (chatError) clearChatError(); }}
                onKeyDown={handleKeyPress}
                placeholder="Posez votre question..."
                className="flex-1"
                disabled={isLoading}
                data-chat-input
              />
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading}
                className="shrink-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                aria-label="Envoyer le message"
                data-chat-send
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {isListening && (
              <p className="text-xs text-center text-muted-foreground mt-2 animate-pulse">
                🎤 Écoute en cours... Parlez maintenant
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-[70] flex" onClick={() => setShowHistory(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative ml-auto h-full w-full sm:w-[380px] bg-background shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History className="h-4 w-4 text-primary" />
                <span>Historique des conversations</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    await startNew(activeUnit ? { id: activeUnit.id, name: activeUnit.name } : undefined);
                    setShowHistory(false);
                  }}
                  title="Nouvelle conversation"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    if (window.confirm('Effacer tout l’historique ?')) {
                      await clearAll();
                    }
                  }}
                  title="Effacer l’historique"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowHistory(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {conversations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Aucune conversation enregistrée.
                  </p>
                )}
                {conversations.map((conv) => {
                  const isActive = conv.id === activeId;
                  const date = new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(conv.updated_at));
                  return (
                    <div
                      key={conv.id}
                      className={`group rounded-lg border p-3 transition-colors ${
                        isActive ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-muted/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(conv.id);
                          setShowHistory(false);
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 truncate text-sm font-medium">{conv.title}</p>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            {conv.messages.length}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{date}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {conv.unit_name && (
                            <Badge variant="outline" className="max-w-full truncate text-[10px]">
                              {conv.unit_name}
                            </Badge>
                          )}
                          {conv.last_category && (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {conv.last_category}
                            </Badge>
                          )}
                        </div>
                      </button>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteConversation(conv.id)}
                          className="h-7 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
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
    </div>
  );
};

export default AquaAssistantModule;
