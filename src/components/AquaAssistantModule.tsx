import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Volume2, Building2, ChevronDown, Globe, History, MessageSquarePlus, Trash2, X, Maximize2, Minimize2, AlertTriangle, RefreshCw, Bot, LayoutDashboard, MessageSquare, Sparkles, FileText } from 'lucide-react';
import { CHAT_ERROR_LABEL } from '@/lib/chatErrors';
import { useChatGuard } from '@/hooks/useChatGuard';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAquaAssistantConversations, AquaMessage } from '@/hooks/useAquaAssistantConversations';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message as AIMessage, MessageContent, MessageResponse, MessageActions, MessageAction } from '@/components/ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools, PromptInputButton } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import AssistantKpis from '@/components/assistant/AssistantKpis';
import { getAssistantUnitProfile } from '@/lib/assistantUnitProfiles';
import AssistantOverview from '@/components/assistant/AssistantOverview';
import { useAssistantVoice } from '@/hooks/useAssistantVoice';
import AssistantVoicePanel from '@/components/assistant/AssistantVoicePanel';
import assistantIcon from '@/assets/aqua-assistant-icon.png';

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

const AquaAssistantModule = ({ onClose, presentation = 'floating', visible = true, canNavigate = () => false }: { onClose?: () => void; presentation?: 'page' | 'floating'; visible?: boolean; canNavigate?: (tab:string)=>boolean } = {}) => {
  const { units, activeUnit, setActiveUnit } = useProductionUnits();
  const { isDemoMode } = useAuth();
  const { t } = useSettings();
  const greeting = "Bonjour et bienvenue. Comment puis-je vous aider aujourd’hui avec votre ferme ?";
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
  const [view,setView]=useState<'conversation'|'overview'>('conversation');
  const [showQuestions,setShowQuestions]=useState(true);
  const requestAbort=useRef<AbortController|null>(null);
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(activeUnit?.id || null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('fr');
  const [showUnitSelector, setShowUnitSelector] = useState(false);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  // Ordinateur : fenêtre miniature agrandissable ; téléphone : plein écran.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isPage = presentation === 'page';
  useEffect(() => { setIsFullscreen(false); }, [presentation]);

  // Changer d'unité ouvre une nouvelle conversation propre à cette unité (historique séparé).
  const switchUnit = async (unitId: string | null) => {
    if (isLoading) return;
    setShowUnitSelector(false);
    if (unitId === selectedUnitId) return;
    setSelectedUnitId(unitId);
    const target = units.find((u) => u.id === unitId);
    await startNew(target ? { id: target.id, name: target.name } : undefined);
    const otherThanActive = target && activeUnit && target.id !== activeUnit.id;
    setMessages([{ role: 'assistant', content: target
      ? `Vous posez maintenant vos questions sur l’unité « ${target.name} ».${otherThanActive ? ` Attention : votre unité active dans l’application est « ${activeUnit?.name} ». Mes réponses porteront uniquement sur « ${target.name} ».` : ''} Que voulez-vous savoir ?`
      : 'Vous posez maintenant vos questions sur l’ensemble de vos unités.' }]);
  };

  // Charge les messages de la conversation active depuis Supabase
  useEffect(() => {
    if (activeConversation && !isLoading) setSelectedUnitId(activeConversation.unit_id);
  }, [activeConversation?.id]);

  useEffect(() => {
    if (isLoading) return;
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
  }, [activeId, activeConversation?.messages, isLoading]);

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
      requestAbort.current?.abort();
      setSelectedUnitId(activeUnit.id);
      setMessages([{role:'assistant',unitId:activeUnit.id,content:`Bonjour. Que souhaitez-vous analyser pour « ${activeUnit.name} » ?`}]);
    }
  }, [activeUnit?.id]);

  // Données réelles
  const { records: healthRecords, loading: healthLoading, error: healthError } = useHealthRecords(undefined, selectedUnitId || undefined);

  const currentLang = languages.find(l => l.id === selectedLanguage);
  
  const voice = useAssistantVoice(currentLang?.code || 'fr-FR');
  useEffect(() => { if (!visible) voice.cancel(); }, [visible, voice.cancel]);
  useEffect(() => { voice.cancel(); }, [selectedUnitId, activeId, voice.cancel]);
  const sendVoice = async () => {
    const dictated = await voice.finish();
    if (!dictated) return;
    voice.cancel();
    setInput(dictated);
    void sendMessage(dictated, { retry: false });
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = currentLang?.code || 'fr-FR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
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
    const scopedHistory = messages.filter(m=>!m.unitId||m.unitId===selectedUnitId);
    const last=scopedHistory[scopedHistory.length-1];
    const newMessages = isRetry && last?.role==='user' && last.content===textToSend ? scopedHistory : [...scopedHistory, userMessage];
    setMessages(newMessages);
    setView('conversation');
    setShowQuestions(false);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';
    let placeholderAdded = false;
    const controller=new AbortController();
    requestAbort.current=controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const authErr = new Error("Session expirée. Reconnectez-vous pour utiliser l'assistant.");
        (authErr as unknown as { status: number }).status = 401;
        failFromError(authErr, ctx.attempt);
        throw authErr;
      }

      const enrichedMessages = newMessages.map(m => ({
        role: m.role,
        content: m.role === 'user' && m === userMessage 
          ? `${contextPrefix}${m.content}`
          : m.content
      }));

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aqua-assistant`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'x-request-id': ctx.requestId,
        },
        body: JSON.stringify({ 
          messages: enrichedMessages.slice(-50),
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
      placeholderAdded = true;

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
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent, unitId:selectedUnitId||undefined };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
      if(!assistantContent.trim()) throw new Error('L’assistant n’a pas renvoyé de réponse.');
      markChatSuccess();
    } catch (error) {
      console.error('Assistant error:', error);
      if(!(error instanceof DOMException && error.name==='AbortError')) failFromError(error, ctx.attempt);
      if (!assistantContent) {
        if(placeholderAdded) setMessages(prev => prev.slice(0, -1));
        setInput(textToSend);
      }
    } finally {
      requestAbort.current=null;
      // Persiste la conversation après chaque échange
      try {
        const finalMessages: AquaMessage[] = [
            ...newMessages.map((m) => ({
              role: m.role,
              content: m.content,
              category: m.category,
              unitId: m.unitId,
              unitName: units.find((u) => u.id === m.unitId)?.name ?? null,
            })),
            ...(assistantContent ? [{ role: 'assistant' as const, content: assistantContent, unitId:selectedUnitId||undefined, createdAt: new Date().toISOString() }] : []),
          ];
        let convId = activeConversation?.unit_id===selectedUnitId?activeId:null;
        if (!convId) {
          const target=units.find(u=>u.id===selectedUnitId);
          const created = await startNew(target ? { id: target.id, name: target.name } : undefined, finalMessages);
          convId = created?.id ?? null;
        }
        if (convId) {
          await persistMessages(convId, finalMessages, selectedCategory ?? null);
        }
      } catch (e) {
        console.warn('Persistance historique chat échouée', e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const currentUnit = units.find((unit) => unit.id === selectedUnitId);
  const unitProfile = getAssistantUnitProfile(currentUnit?.type);
  const unitLabel = currentUnit?.name || 'Toutes les unités';
  const latestControl = !isDemoMode && selectedUnitId && !healthLoading && !healthError
    ? healthRecords.find((record) => record.unit_id === selectedUnitId &&
      [record.ph, record.temperature, record.oxygen].some((value) => value != null && Number.isFinite(Number(value))))
    : undefined;
  const measuredParameters = latestControl ? [
    latestControl.ph != null ? `pH : ${Number(latestControl.ph).toLocaleString('fr-FR')}` : null,
    latestControl.temperature != null ? `Température : ${Number(latestControl.temperature).toLocaleString('fr-FR')} °C` : null,
    latestControl.oxygen != null ? `Oxygène : ${Number(latestControl.oxygen).toLocaleString('fr-FR')} mg/L` : null,
  ].filter(Boolean).join(' · ') : '';

  const chatStatus = chatError ? 'error' : isLoading ? 'streaming' : 'ready';
  const navigate=(tab:string)=>{
    if(!canNavigate(tab)||isLoading)return;
    if(currentUnit)setActiveUnit(currentUnit);
    if(!isPage)onClose?.();
    window.dispatchEvent(new CustomEvent('aquapilote:navigate',{detail:tab}));
  };
  const ask=(question:string)=>{setView('conversation');setInput(question);setShowQuestions(false);};

  const surface = (
    <section
      aria-label="AquaAssistant, assistant de gestion aquacole"
      className={isPage ? 'relative flex h-[max(460px,calc(100dvh-7rem))] sm:h-[max(460px,calc(100dvh-9rem))] w-full min-w-0 flex-col overflow-hidden bg-background' : isFullscreen
        ? 'fixed inset-0 z-[10000] flex min-h-0 flex-col overflow-hidden bg-background'
        : 'fixed inset-0 z-[10000] flex min-h-0 flex-col overflow-hidden border bg-background shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(680px,calc(100dvh-2rem))] sm:w-[min(440px,calc(100vw-2rem))] sm:rounded-lg'}
      style={!isPage && isFullscreen ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      } : undefined}
    >
      <header className="assistant-masthead relative z-10 shrink-0 overflow-visible border-b px-3 pt-3 sm:px-4">
        <div className="relative flex flex-wrap items-center justify-between gap-2 px-1 pb-3 sm:px-0">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex size-9 sm:size-12 shrink-0 items-center justify-center rounded-lg border bg-background">
              <img src={assistantIcon} alt="" width={48} height={48} className="size-8 object-contain sm:size-10" />
            </div>
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg text-foreground">AquaAssistant</h1>
              <p className="truncate text-xs text-muted-foreground">{unitProfile.label} · {unitLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setShowHistory(true)} aria-label="Ouvrir l’historique" title="Historique">
              <History className="size-4" />
            </Button>
            {!isPage && <Button variant="outline" size="icon" className="shrink-0" onClick={() => setIsFullscreen((value) => !value)} aria-label={isFullscreen ? 'Réduire AquaAssistant' : 'Agrandir AquaAssistant'} title={isFullscreen ? 'Réduire' : 'Agrandir'}>
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>}
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => { requestAbort.current?.abort(); voice.cancel(); setIsFullscreen(false); if (onClose) onClose(); else window.dispatchEvent(new CustomEvent('aquapilote:navigate', { detail: 'dashboard' })); }} aria-label="Fermer AquaAssistant" title="Fermer">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-1 pb-3 sm:px-0">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Button variant="outline" disabled={isLoading} onClick={() => { setShowUnitSelector(!showUnitSelector); setShowLanguageSelector(false); }} className="w-full justify-between bg-background">
              <span className="flex min-w-0 items-center gap-2"><Building2 className="size-4 shrink-0" /><span className="truncate">{unitLabel}</span></span>
              <ChevronDown className="size-4 shrink-0" />
            </Button>
            {showUnitSelector && (
              <div className="absolute left-0 top-full z-[10030] mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-xl">
                <Button variant="ghost" className="w-full justify-start" onClick={() => switchUnit(null)}>Toutes les unités</Button>
                {units.map((unit) => <Button key={unit.id} variant={selectedUnitId === unit.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => switchUnit(unit.id)}>{unit.name}</Button>)}
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="outline" onClick={() => { setShowLanguageSelector(!showLanguageSelector); setShowUnitSelector(false); }} className="bg-background px-2 sm:px-4" aria-label="Choisir la langue">
              <Globe className="size-4" /><span className="hidden sm:inline">{currentLang?.flag} {currentLang?.label}</span><span className="sm:hidden">{currentLang?.flag}</span><ChevronDown className="size-4" />
            </Button>
            {showLanguageSelector && (
              <div className="absolute right-0 top-full z-[10030] mt-1 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-xl">
                {languages.map((language) => <Button key={language.id} variant={selectedLanguage === language.id ? 'secondary' : 'ghost'} className="w-full justify-start" onClick={() => { setSelectedLanguage(language.id); setShowLanguageSelector(false); }}>{language.flag} {language.label}</Button>)}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AssistantKpis unitId={selectedUnitId} />
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-3 py-2" role="tablist" aria-label="Vues AquaAssistant"><Button role="tab" aria-selected={view==='conversation'} variant={view==='conversation'?'secondary':'ghost'} size="sm" onClick={()=>setView('conversation')}><MessageSquare className="size-4"/>Conversation</Button><Button role="tab" aria-selected={view==='overview'} variant={view==='overview'?'secondary':'ghost'} size="sm" onClick={()=>{voice.cancel();setView('overview');}}><LayoutDashboard className="size-4"/>Synthèse</Button>{canNavigate('reports')&&<Button size="icon" variant="ghost" className="ml-auto" title="Consulter les rapports" aria-label="Consulter les rapports" onClick={()=>navigate('reports')}><FileText className="size-4"/></Button>}</div>
        {view==='overview'?<div className="min-h-0 flex-1 overflow-y-auto"><AssistantOverview unitId={selectedUnitId} onQuestion={ask} onNavigate={navigate} canNavigate={canNavigate}/></div>:<>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-hidden">
          <Conversation className="min-h-24 flex-1" aria-label="Messages AquaAssistant">
            <ConversationContent className="gap-4 p-3 sm:p-4">
        {messages.length <= 1 && currentUnit?.type !== 'commercialisation' && <div className="border-b pb-2">
          <p className="text-sm text-muted-foreground">
            {latestControl
              ? `Dernier contrôle du ${new Date(`${latestControl.date}T00:00:00`).toLocaleDateString('fr-FR')} : ${measuredParameters}.`
              : healthLoading ? 'Chargement du dernier contrôle…'
              : healthError ? 'Le dernier contrôle est indisponible pour le moment.'
              : 'Aucun contrôle de l’eau disponible pour cette unité.'}
          </p>
        </div>}
            <div className="flex shrink-0 items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={()=>setShowQuestions(v=>!v)}><Sparkles className="size-4 text-ocean-secondary"/>Questions rapides</Button>
              <Button type="button" disabled={isLoading} variant="ghost" size="icon" onClick={() => startNew(currentUnit ? { id: currentUnit.id, name: currentUnit.name } : undefined)} aria-label="Nouvelle conversation" title="Nouvelle conversation"><MessageSquarePlus className="size-4" /></Button>
            </div>
            {showQuestions&&<div className="max-h-32 shrink-0 overflow-y-auto border-b px-3 py-2 sm:max-h-40"><div className="flex flex-wrap gap-2">{[...unitProfile.suggestions,{title:'Rapport hebdomadaire',question:'Génère mon rapport hebdomadaire pour cette unité : faits datés, chiffres enregistrés, limites et recommandations.'}].map(s=><Button key={s.title} variant="outline" size="sm" className="assistant-question h-auto max-w-full whitespace-normal bg-background text-left" onClick={()=>ask(s.question)}><Sparkles className="size-3 shrink-0 text-ocean-primary"/>{s.title}</Button>)}</div></div>}

              {messages.map((message, index) => <AIMessage key={`${message.role}-${index}`} from={message.role}>
                {message.role === 'assistant' && <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground"><img src={assistantIcon} alt="" width={28} height={28} className="size-7 object-contain"/>AquaAssistant</div>}
                <MessageContent className={message.role === 'user' ? 'bg-ocean-primary text-sidebar-foreground break-words [overflow-wrap:anywhere]' : 'min-w-0 rounded-lg border bg-card p-3 text-sm sm:p-4 sm:text-base break-words [overflow-wrap:anywhere] [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_strong]:text-ocean-primary [&_strong]:tabular-nums'}>
                  {message.role === 'assistant' ? <MessageResponse>{message.content || ''}</MessageResponse> : <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                </MessageContent>
                {message.role === 'assistant' && message.content && <MessageActions><MessageAction tooltip="Écouter la réponse" label="Écouter" onClick={() => speakText(message.content)}><Volume2 className="size-4" /></MessageAction></MessageActions>}
              </AIMessage>)}
              {isLoading && !messages[messages.length - 1]?.content?.trim() && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4 text-primary" /><Shimmer>Analyse des données de l’unité…</Shimmer></div>}
            </ConversationContent>
            <ConversationScrollButton aria-label="Voir le dernier message" />
          </Conversation>

          <div className="max-h-[45%] shrink-0 overflow-y-auto border-t bg-background p-2 sm:p-3">
            {chatError && <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3" data-chat-error={chatError.cause}>
              <div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-destructive">{CHAT_ERROR_LABEL[chatError.cause]}</p><p className="text-xs text-muted-foreground">{chatError.message}</p><div className="mt-2 flex flex-wrap gap-2">{chatError.retryable && lastAttempt && <Button size="sm" variant="outline" disabled={isLoading || !canRetryNow} onClick={() => sendMessage(lastAttempt)}><RefreshCw className="size-3.5" />{canRetryNow ? 'Réessayer' : `Dans ${retryIn}s`}</Button>}<Button size="sm" variant="ghost" onClick={clearChatError}>Fermer</Button></div></div></div>
            </div>}
            {voice.error && <p role="alert" className="mb-2 text-xs text-destructive">{voice.error}</p>}
            {voice.phase !== 'idle' ? <AssistantVoicePanel voice={voice} onSend={() => void sendVoice()} onCancel={() => { voice.cancel(); }} /> : <PromptInput onSubmit={(message) => sendMessage(message.text, { retry: false })} className="rounded-md bg-card">
              <PromptInputTextarea ref={(element) => { if (element && document.activeElement === document.body) element.focus(); }} value={input} onChange={(event) => { setInput(event.target.value); if (chatError) clearChatError(); }} disabled={isLoading} placeholder={`Posez une question sur ${unitLabel}…`} className="min-h-14 text-base" data-chat-input />
              <PromptInputFooter>
                <PromptInputTools><PromptInputButton tooltip="Dicter une question" disabled={isLoading} onClick={() => void voice.start(input)} aria-label="Dicter une question"><Mic className="size-4" /></PromptInputButton></PromptInputTools>
                <PromptInputSubmit status={chatStatus} disabled={!input.trim() && !isLoading} onClick={isLoading?(e)=>{e.preventDefault();requestAbort.current?.abort();}:undefined} aria-label={isLoading ? 'Arrêter' : 'Envoyer la question'} />
              </PromptInputFooter>
            </PromptInput>}
          </div>
          </div>

        </div>
        </>}
      </div>

      {showHistory && <div className="fixed inset-0 z-[10020] flex" onClick={() => setShowHistory(false)}><div className="absolute inset-0 bg-foreground/40" /><div className="relative ml-auto flex h-full w-full flex-col bg-background shadow-2xl sm:w-96" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4"><div className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-primary" />Historique</div><div className="flex gap-1"><Button variant="outline" size="icon" onClick={() => startNew(currentUnit ? { id: currentUnit.id, name: currentUnit.name } : undefined)} aria-label="Nouvelle conversation"><MessageSquarePlus className="size-4" /></Button><Button variant="outline" size="icon" onClick={() => { if (window.confirm('Effacer tout l’historique ?')) clearAll(); }} aria-label="Effacer l’historique"><Trash2 className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} aria-label="Fermer"><X className="size-4" /></Button></div></div>
        <ScrollArea className="flex-1"><div className="space-y-2 p-3">{conversations.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune conversation enregistrée.</p>}{conversations.map((conversation) => <div key={conversation.id} className={conversation.id === activeId ? 'rounded-md border border-primary bg-primary/5 p-3' : 'rounded-md border p-3'}><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-0 text-left" onClick={() => { setActiveId(conversation.id); setShowHistory(false); }}><span className="min-w-0"><span className="block truncate text-sm font-medium">{conversation.title}</span><span className="mt-1 block text-xs text-muted-foreground">{conversation.messages.length} message(s) · {conversation.unit_name || 'Toutes unités'}</span></span></Button><div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteConversation(conversation.id)}><Trash2 className="size-3" />Supprimer</Button></div></div>)}</div></ScrollArea>
      </div></div>}
    </section>
  );
  if (!visible) return null;
  return isPage ? surface : createPortal(surface, document.body);
};

export default AquaAssistantModule;
