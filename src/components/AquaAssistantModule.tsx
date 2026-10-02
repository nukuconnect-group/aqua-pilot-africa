import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/env';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Mic, MicOff, Volume2, Building2, ChevronDown, Globe, History, MessageSquarePlus, Trash2, X, Maximize2, Minimize2, AlertTriangle, RefreshCw, PackageX, PackageSearch, Trophy, WalletCards, Bot } from 'lucide-react';
import { CHAT_ERROR_LABEL } from '@/lib/chatErrors';
import { useChatGuard } from '@/hooks/useChatGuard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useProductionCycles } from '@/hooks/useProductionCycles';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useSales } from '@/hooks/useSales';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAquaAssistantConversations, AquaMessage } from '@/hooks/useAquaAssistantConversations';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message as AIMessage, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools, PromptInputButton } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { formatMoney } from '@/lib/currency';
import { getAssistantUnitProfile } from '@/lib/assistantUnitProfiles';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  unitId?: string;
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
  { id: 'wolof', label: 'Wolof', code: 'wo-SN', flag: '🇸🇳' },
  { id: 'swahili', label: 'Kiswahili', code: 'sw-KE', flag: '🇰🇪' },
];

const AquaAssistantModule = () => {
  const { units, activeUnit } = useProductionUnits();
  const { isDemoMode } = useAuth();
  const { t } = useSettings();
  const greeting = "Bonjour. Posez-moi une question sur votre chiffre d’affaires, vos cycles, vos stocks, votre alimentation, vos contrôles ou vos priorités. Mes réponses utilisent les données enregistrées dans AquaPilote.";
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
        activeConversation.messages.map((m, index) => {
          // Anciennes conversations : retirer l'ancien nom de l'assistant.
          const legacy = /aqua\s*brain/i.test(m.content || '');
          const content = legacy && index === 0 && m.role === 'assistant'
            ? greeting
            : (m.content || '').replace(/aqua\s*brain/gi, 'AquaAssistant');
          return { role: m.role, content, category: m.category, unitId: m.unitId };
        }),
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
  const { stocks: feedStocks } = useFeedStocks(selectedUnitId || undefined);
  const { cycles } = useProductionCycles(selectedUnitId || undefined);
  const { records: healthRecords } = useHealthRecords(undefined, selectedUnitId || undefined);
  const { allSales } = useSales();

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

  const sendMessage = async (messageText?: string, options?: { retry?: boolean }) => {
    const isRetry = Boolean(messageText) && options?.retry !== false;
    const textToSend = (messageText || input).trim();
    if (isLoading) return;
    const ctx = beginAttempt(textToSend, isRetry);
    if (!ctx) return;

    const selectedUnitName = units.find(u => u.id === selectedUnitId)?.name;
    const contextPrefix = selectedUnitId && selectedUnitName 
      ? `[Contexte: Unité "${selectedUnitName}"] ` 
      : '';

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
          ? `${contextPrefix}${m.content}`
          : m.content
      }));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/aqua-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'x-request-id': ctx.requestId,
        },
        body: JSON.stringify({ 
          messages: enrichedMessages,
          category: selectedCategory,
          unitId: selectedUnitId,
          unitName: selectedUnitName,
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

  const currentUnit = units.find((unit) => unit.id === selectedUnitId);
  const unitProfile = getAssistantUnitProfile(currentUnit?.type);
  const unitStocks = feedStocks;
  const outOfStocks = unitStocks.filter((stock) => Number(stock.quantity) <= 0);
  const lowStocks = unitStocks.filter(
    (stock) => Number(stock.quantity) > 0 &&
    (stock) => Number(stock.min_threshold) > 0 && Number(stock.quantity) <= Number(stock.min_threshold),
  );
  const unitLabel = currentUnit?.name || 'Toutes les unités';
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const scopedSales = allSales.filter((sale) => !selectedUnitId || sale.unitId === selectedUnitId);
  const monthlyRevenue = scopedSales
    .filter((sale) => new Date(sale.date).getTime() >= monthStart.getTime() && sale.status !== 'pending')
    .reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const monthlyProductTotals = scopedSales
    .filter((sale) => new Date(sale.date).getTime() >= monthStart.getTime() && sale.status !== 'pending')
    .flatMap((sale) => sale.products)
    .reduce<Record<string, number>>((totals, product) => {
      totals[product.name] = (totals[product.name] || 0) + Number(product.total || 0);
      return totals;
    }, {});
  const starProduct = Object.entries(monthlyProductTotals).sort(([, first], [, second]) => second - first)[0];
  const quickQuestions = unitProfile.suggestions.slice(0, 3);

  const chatStatus = chatError ? 'error' : isLoading ? 'streaming' : 'ready';

  return (
    <section
      aria-label="AquaAssistant, assistant de gestion aquacole"
      className={isFullscreen
        ? 'fixed inset-0 z-[10000] flex min-h-0 flex-col overflow-hidden bg-background'
        : 'min-w-0 space-y-4'}
      style={isFullscreen ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      } : undefined}
    >
      <header className="relative shrink-0 overflow-visible border-b bg-background">
        <div className="flex items-center justify-between gap-3 px-1 pb-3 sm:px-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground sm:text-xl">AquaAssistant</h1>
              <p className="truncate text-xs text-muted-foreground">{unitProfile.label} · {unitLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setShowHistory(true)} aria-label="Ouvrir l’historique" title="Historique">
              <History className="size-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setIsFullscreen((value) => !value)} aria-label={isFullscreen ? 'Réduire AquaAssistant' : 'Afficher AquaAssistant en plein écran'} title={isFullscreen ? 'Réduire' : 'Plein écran'}>
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-1 pb-3 sm:px-0">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Button variant="outline" onClick={() => { setShowUnitSelector(!showUnitSelector); setShowLanguageSelector(false); }} className="w-full justify-between bg-background">
              <span className="flex min-w-0 items-center gap-2"><Building2 className="size-4 shrink-0" /><span className="truncate">{unitLabel}</span></span>
              <ChevronDown className="size-4 shrink-0" />
            </Button>
            {showUnitSelector && (
              <div className="absolute left-0 top-full z-[10030] mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-xl">
                <Button variant="ghost" className="w-full justify-start" onClick={() => { setSelectedUnitId(null); setShowUnitSelector(false); }}>Toutes les unités</Button>
                {units.map((unit) => <Button key={unit.id} variant={selectedUnitId === unit.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setSelectedUnitId(unit.id); setShowUnitSelector(false); }}>{unit.name}</Button>)}
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="outline" onClick={() => { setShowLanguageSelector(!showLanguageSelector); setShowUnitSelector(false); }} className="bg-background" aria-label="Choisir la langue">
              <Globe className="size-4" /><span>{currentLang?.flag} {currentLang?.label}</span><ChevronDown className="size-4" />
            </Button>
            {showLanguageSelector && (
              <div className="absolute right-0 top-full z-[10030] mt-1 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl">
                {languages.map((language) => <Button key={language.id} variant={selectedLanguage === language.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setSelectedLanguage(language.id); setShowLanguageSelector(false); }}>{language.flag} {language.label}</Button>)}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={isFullscreen ? 'flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5' : 'space-y-3'}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: 'CA du mois', value: isDemoMode ? 'Indisponible' : formatMoney(monthlyRevenue), detail: isDemoMode ? 'Données réelles uniquement' : `${scopedSales.filter((sale) => new Date(sale.date).getTime() >= monthStart.getTime() && sale.status !== 'pending').length} vente(s)`, icon: WalletCards },
            { label: 'Ruptures', value: outOfStocks.length.toLocaleString('fr-FR'), detail: outOfStocks.length ? outOfStocks.slice(0, 2).map((stock) => stock.custom_name || stock.feed_type).join(', ') : 'Aucune rupture', icon: PackageX },
            { label: 'Stocks faibles', value: lowStocks.length.toLocaleString('fr-FR'), detail: lowStocks.length ? lowStocks.slice(0, 2).map((stock) => stock.custom_name || stock.feed_type).join(', ') : 'Aucun stock faible', icon: PackageSearch },
            { label: 'Produit star', value: isDemoMode ? 'Indisponible' : (starProduct?.[0] || 'Non renseigné'), detail: !isDemoMode && starProduct ? formatMoney(starProduct[1]) : 'Aucune vente exploitable', icon: Trophy },
          ].map((item) => (
            <div key={item.label} className="min-h-24 rounded-md border bg-card p-3 sm:p-4">
              <div className="flex items-center gap-2"><item.icon className="size-4 shrink-0 text-primary" /><p className="text-xs font-medium text-muted-foreground sm:text-sm">{item.label}</p></div>
              <p className="mt-2 break-words text-base font-bold leading-tight sm:text-xl">{item.value}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>

        <div className="py-1">
          <p className="text-sm font-semibold text-foreground">Que souhaitez-vous savoir sur votre unité ?</p>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {quickQuestions.map((suggestion) => (
              <Button
                key={suggestion.title}
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => sendMessage(suggestion.question, { retry: false })}
                className="h-9 shrink-0 bg-card px-3 text-xs"
              >
                {suggestion.title}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className={isFullscreen ? 'flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-md border bg-card' : 'flex h-[min(560px,calc(100dvh-15rem))] min-h-[360px] flex-col overflow-hidden rounded-md border bg-card'}>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <Bot className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">Poser une question</p><p className="truncate text-xs text-muted-foreground">Réponses basées sur {unitLabel}</p></div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => { startNew(currentUnit ? { id: currentUnit.id, name: currentUnit.name } : undefined); }} aria-label="Nouvelle conversation" title="Nouvelle conversation"><MessageSquarePlus className="size-4" /></Button>
          </div>

          <Conversation className="min-h-0">
            <ConversationContent className="gap-5 p-3 sm:p-5">
              {messages.map((message, index) => <AIMessage key={`${message.role}-${index}`} from={message.role}>
                {message.role === 'assistant' && <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground"><Bot className="size-4 text-primary" />AquaAssistant</div>}
                <MessageContent className={message.role === 'user' ? 'bg-sidebar-background text-sidebar-foreground' : undefined}>
                  {message.role === 'assistant' ? <MessageResponse>{message.content || ''}</MessageResponse> : <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                </MessageContent>
                {message.role === 'assistant' && message.content && <MessageActions><MessageAction tooltip="Écouter la réponse" label="Écouter" onClick={() => speakText(message.content)}><Volume2 className="size-4" /></MessageAction></MessageActions>}
              </AIMessage>)}
              {isLoading && messages[messages.length - 1]?.content === '' && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4 text-primary" /><Shimmer>Analyse des données de l’unité…</Shimmer></div>}
              <div ref={messagesEndRef} aria-hidden="true" />
            </ConversationContent>
            <ConversationScrollButton aria-label="Voir le dernier message" />
          </Conversation>

          <div className="shrink-0 border-t bg-background p-3 sm:p-4">
            {chatError && <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3" data-chat-error={chatError.cause}>
              <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-destructive">{CHAT_ERROR_LABEL[chatError.cause]}</p><p className="text-xs text-muted-foreground">{chatError.message}</p><div className="mt-2 flex flex-wrap gap-2">{chatError.retryable && lastAttempt && <Button size="sm" variant="outline" disabled={isLoading || !canRetryNow} onClick={() => sendMessage(lastAttempt)}><RefreshCw className="size-3.5" />{canRetryNow ? 'Réessayer' : `Dans ${retryIn}s`}</Button>}<Button size="sm" variant="ghost" onClick={clearChatError}>Fermer</Button></div></div></div>
            </div>}
            <PromptInput onSubmit={(message) => sendMessage(message.text, { retry: false })} className="rounded-md bg-card">
              <PromptInputTextarea ref={(element) => { if (element && document.activeElement === document.body) element.focus(); }} value={input} onChange={(event) => { setInput(event.target.value); if (chatError) clearChatError(); }} disabled={isLoading} placeholder={`Posez une question sur ${unitLabel}…`} className="min-h-14 text-base" data-chat-input />
              <PromptInputFooter>
                <PromptInputTools><PromptInputButton tooltip={isListening ? 'Arrêter l’écoute' : 'Dicter une question'} onClick={toggleListening} aria-label={isListening ? 'Arrêter l’écoute' : 'Dicter une question'}>{isListening ? <MicOff className="size-4 text-destructive" /> : <Mic className="size-4" />}</PromptInputButton><span className="hidden text-xs text-muted-foreground sm:inline">Entrée pour envoyer</span></PromptInputTools>
                <PromptInputSubmit status={chatStatus} disabled={!input.trim() && !isLoading} aria-label={isLoading ? 'Arrêter' : 'Envoyer la question'} />
              </PromptInputFooter>
            </PromptInput>
            {isListening && <p className="mt-2 text-center text-xs text-primary">Écoute en cours…</p>}
          </div>
          </div>

        </div>
      </div>

      {showHistory && <div className="fixed inset-0 z-[10020] flex" onClick={() => setShowHistory(false)}><div className="absolute inset-0 bg-foreground/40" /><div className="relative ml-auto flex h-full w-full flex-col bg-background shadow-2xl sm:w-96" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4"><div className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-primary" />Historique</div><div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => startNew(currentUnit ? { id: currentUnit.id, name: currentUnit.name } : undefined)} aria-label="Nouvelle conversation"><MessageSquarePlus className="size-4" /></Button><Button variant="outline" size="icon" onClick={() => { if (window.confirm('Effacer tout l’historique ?')) clearAll(); }} aria-label="Effacer l’historique"><Trash2 className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} aria-label="Fermer"><X className="size-4" /></Button></div></div>
        <ScrollArea className="flex-1"><div className="space-y-2 p-3">{conversations.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune conversation enregistrée.</p>}{conversations.map((conversation) => <div key={conversation.id} className={conversation.id === activeId ? 'rounded-md border border-primary bg-primary/5 p-3' : 'rounded-md border p-3'}><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left" onClick={() => { setActiveId(conversation.id); setShowHistory(false); }}><span className="min-w-0"><span className="block truncate text-sm font-medium">{conversation.title}</span><span className="mt-1 block text-xs text-muted-foreground">{conversation.messages.length} message(s) · {conversation.unit_name || 'Toutes unités'}</span></span></Button><div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteConversation(conversation.id)}><Trash2 className="size-3" />Supprimer</Button></div></div>)}</div></ScrollArea>
      </div></div>}
    </section>
  );
};

export default AquaAssistantModule;
