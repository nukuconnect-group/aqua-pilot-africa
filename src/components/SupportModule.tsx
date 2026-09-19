import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, Plus, Send, Clock, CheckCircle, AlertCircle, 
  HelpCircle, CreditCard, RefreshCw, Settings, User, Headphones,
  Trash2, Minus, Maximize2
} from 'lucide-react';
import { useSupportTickets, SupportTicket, SupportMessage } from '@/hooks/useSupportTickets';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const SUBJECT_SUGGESTIONS = [
  { category: 'technical', subjects: [
    "Problème de connexion",
    "Bug dans l'application",
    "Erreur lors de l'enregistrement",
    "Fonctionnalité ne fonctionne pas"
  ]},
  { category: 'subscription', subjects: [
    "Question sur mon abonnement",
    "Demande de renouvellement",
    "Changement de formule",
    "Problème de paiement"
  ]},
  { category: 'feature', subjects: [
    "Demande de nouvelle fonctionnalité",
    "Suggestion d'amélioration",
    "Question sur une fonctionnalité"
  ]},
  { category: 'general', subjects: [
    "Question générale",
    "Demande d'information",
    "Autre"
  ]}
];

const CATEGORIES = [
  { value: 'technical', label: 'Problème technique', icon: Settings },
  { value: 'subscription', label: 'Abonnement / Paiement', icon: CreditCard },
  { value: 'feature', label: 'Fonctionnalités', icon: HelpCircle },
  { value: 'general', label: 'Question générale', icon: MessageCircle }
];

const SupportModule = () => {
  const { user } = useAuth();
  const { t, language } = useSettings();
  const { 
    tickets, 
    messages, 
    loading, 
    createTicket, 
    sendMessage, 
    updateTicketStatus,
    deleteMessage,
    fetchMessages,
    markMessagesAsRead 
  } = useSupportTickets();

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);
  const dateLocale = language === 'fr' ? fr : enUS;

  const [formData, setFormData] = useState({
    category: '',
    subject: '',
    message: '',
    priority: 'normal'
  });

  const isAdmin = user?.role === 'admin';

  // Debug: Log when component mounts
  useEffect(() => {
    console.log('SupportModule mounted - user:', user?.id, 'loading:', loading, 'tickets:', tickets.length);
  }, [user?.id, loading, tickets.length]);

  // Charger les messages quand un ticket est sélectionné
  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
      markMessagesAsRead(selectedTicket.id);
    }
  }, [selectedTicket, fetchMessages, markMessagesAsRead]);

  // Scroll to bottom uniquement quand un nouveau message arrive (évite les "sauts" pendant le défilement)
  useEffect(() => {
    const prev = lastMessageCountRef.current;
    const next = messages.length;

    if (next > prev) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }

    lastMessageCountRef.current = next;
  }, [messages.length]);

  const handleCreateTicket = async () => {
    if (!formData.subject || !formData.category || !formData.message) return;

    const ticket = await createTicket({
      subject: formData.subject,
      category: formData.category,
      message: formData.message,
      priority: formData.priority
    });

    if (ticket) {
      setFormData({ category: '', subject: '', message: '', priority: 'normal' });
      setShowNewTicket(false);
      setSelectedTicket(ticket);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    setSending(true);
    const success = await sendMessage(selectedTicket.id, newMessage);
    if (success) {
      setNewMessage('');
    }
    setSending(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-sky-100 text-sky-800">{language === 'fr' ? 'Nouveau' : 'New'}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">{t('awaiting')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800">{t('in_progress')}</Badge>;
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800">{t('resolved')}</Badge>;
      case 'closed':
        return <Badge variant="secondary">{t('closed')}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat?.icon || MessageCircle;
  };

  const suggestedSubjects = SUBJECT_SUGGESTIONS.find(s => s.category === formData.category)?.subjects || [];

  // Filtrer les tickets selon le rôle, la recherche et le statut
  const visibleTickets = isAdmin
    ? tickets
    : tickets.filter(t => t.user_id === user?.id);

  const displayedTickets = visibleTickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.subject?.toLowerCase().includes(q) ||
      t.message?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.user_email?.toLowerCase().includes(q) ||
      (t.user_name || '').toLowerCase().includes(q)
    );
  });

  // Si pas d'utilisateur, afficher un message
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Headphones className="w-16 h-16 text-muted-foreground" />
        <p className="text-muted-foreground text-center">
          {language === 'fr' ? 'Veuillez vous connecter pour accéder au support' : 'Please log in to access support'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 min-h-[500px]">
      {/* En-tête */}
      <div className="border rounded-xl bg-card p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              <Headphones className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-semibold truncate">{t('support')}</h2>
              <p className="text-muted-foreground text-sm">
                {isAdmin
                  ? (language === 'fr' ? 'Demandes clients (vue admin)' : 'Customer requests (admin view)')
                  : (language === 'fr' ? 'Soumettez vos doléances et suivez les réponses' : 'Submit your request and track replies')}
              </p>
            </div>
          </div>

          <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
            <DialogTrigger asChild>
              <Button variant="default" className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                {t('new_ticket')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{language === 'fr' ? 'Nouvelle demande de support' : 'New support request'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{language === 'fr' ? 'Catégorie' : 'Category'}</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v, subject: '' })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'fr' ? 'Sélectionner une catégorie' : 'Select a category'} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.category && (
                  <div>
                    <Label>{language === 'fr' ? 'Sujet suggéré' : 'Suggested subject'}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {suggestedSubjects.map((subject) => (
                        <Button
                          key={subject}
                          variant={formData.subject === subject ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({ ...formData, subject })}
                        >
                          {subject}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label>{language === 'fr' ? 'Sujet' : 'Subject'}</Label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={language === 'fr' ? 'Décrivez votre problème en quelques mots' : 'Describe your issue in a few words'}
                  />
                </div>

                <div>
                  <Label>{language === 'fr' ? 'Message' : 'Message'}</Label>
                  <Textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={language === 'fr' ? 'Décrivez votre problème en détail...' : 'Describe your issue in detail...'}
                    rows={4}
                  />
                </div>

                <div>
                  <Label>{language === 'fr' ? 'Priorité' : 'Priority'}</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{language === 'fr' ? 'Basse' : 'Low'}</SelectItem>
                      <SelectItem value="normal">{language === 'fr' ? 'Normale' : 'Normal'}</SelectItem>
                      <SelectItem value="high">{language === 'fr' ? 'Haute' : 'High'}</SelectItem>
                      <SelectItem value="urgent">{language === 'fr' ? 'Urgente' : 'Urgent'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleCreateTicket} className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {language === 'fr' ? 'Envoyer' : 'Send'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats pour admin */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'open').length}</p>
                  <p className="text-sm text-muted-foreground">En attente</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'in_progress').length}</p>
                  <p className="text-sm text-muted-foreground">En cours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{tickets.filter(t => t.status === 'resolved').length}</p>
                  <p className="text-sm text-muted-foreground">Résolus</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{tickets.filter(t => t.priority === 'urgent').length}</p>
                  <p className="text-sm text-muted-foreground">Urgents</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Liste des tickets */}
        <Card className="md:col-span-1">
          <CardHeader className="p-4 space-y-3">
            <CardTitle className="text-lg">{language === 'fr' ? 'Mes demandes' : 'My requests'}</CardTitle>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === 'fr' ? 'Rechercher un ticket...' : 'Search a ticket...'}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'fr' ? 'Tous les statuts' : 'All statuses'}</SelectItem>
                <SelectItem value="open">{language === 'fr' ? 'Nouveaux' : 'New'}</SelectItem>
                <SelectItem value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</SelectItem>
                <SelectItem value="in_progress">{language === 'fr' ? 'En cours' : 'In progress'}</SelectItem>
                <SelectItem value="resolved">{language === 'fr' ? 'Résolus' : 'Resolved'}</SelectItem>
                <SelectItem value="closed">{language === 'fr' ? 'Fermés' : 'Closed'}</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">Chargement...</div>
              ) : displayedTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune demande</p>
                </div>
              ) : (
                <div className="divide-y">
                  {displayedTickets.map(ticket => {
                    const Icon = getCategoryIcon(ticket.category);
                    const isSelected = selectedTicket?.id === ticket.id;
                    
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{ticket.subject}</p>
                            {isAdmin && (
                              <p className="text-xs text-muted-foreground">{ticket.user_name || ticket.user_email}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {getStatusBadge(ticket.status)}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(ticket.created_at), 'dd MMM', { locale: dateLocale })}
                                </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="md:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {isAdmin && `De: ${selectedTicket.user_name || selectedTicket.user_email}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <Select 
                        value={selectedTicket.status} 
                        onValueChange={(v) => updateTicketStatus(selectedTicket.id, v)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">{language === 'fr' ? 'Nouveau' : 'New'}</SelectItem>
                          <SelectItem value="pending">{language === 'fr' ? 'En attente' : 'Pending'}</SelectItem>
                          <SelectItem value="in_progress">{language === 'fr' ? 'En cours' : 'In progress'}</SelectItem>
                          <SelectItem value="resolved">{language === 'fr' ? 'Résolu' : 'Resolved'}</SelectItem>
                          <SelectItem value="closed">{language === 'fr' ? 'Fermé' : 'Closed'}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={chatMinimized
                        ? (language === 'fr' ? 'Agrandir la conversation' : 'Expand conversation')
                        : (language === 'fr' ? 'Réduire la conversation' : 'Minimize conversation')}
                      onClick={() => setChatMinimized(v => !v)}
                    >
                      {chatMinimized ? <Maximize2 className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className={`p-0 ${chatMinimized ? 'hidden' : ''}`}>
                <ScrollArea className="h-[350px] p-4">
                  <div className="space-y-4">
                    {messages.map(msg => {
                      const isOwnMessage = msg.sender_id === user?.id;
                      const isAdminMessage = msg.sender_type === 'admin';
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${
                            isOwnMessage 
                              ? 'bg-primary text-primary-foreground' 
                              : isAdminMessage 
                                ? 'bg-purple-100 dark:bg-purple-900' 
                                : 'bg-muted'
                          } rounded-lg p-3`}>
                            <div className="flex items-center gap-2 mb-1">
                              {isAdminMessage && !isOwnMessage && (
                                <Badge variant="secondary" className="text-xs">Support</Badge>
                              )}
                              <span className="text-xs opacity-70">
                                {msg.sender_name}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className="text-xs opacity-50">
                                {format(new Date(msg.created_at), 'HH:mm', { locale: dateLocale })}
                              </p>
                              {(isOwnMessage || isAdmin) && (
                                <button
                                  type="button"
                                  aria-label={language === 'fr' ? 'Supprimer le message' : 'Delete message'}
                                  className="opacity-60 hover:opacity-100 transition-opacity"
                                  onClick={() => deleteMessage(msg.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {selectedTicket.status !== 'closed' && (
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tapez votre message..."
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <div className="h-[500px] flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Sélectionnez une conversation</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SupportModule;
