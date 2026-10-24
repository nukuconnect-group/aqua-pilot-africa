
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Trash2, Clock, Thermometer, BarChart3, Printer, Download, FileSpreadsheet, FileText, Plus, ChevronDown, ChevronUp, Calendar, User, Settings } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  exportFeedingToPDF,
  exportFeedingToWord,
  exportFeedingToExcel,
  exportFeedingToCSV
} from '@/lib/feedingExportUtils';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { resolveInfrastructureQr } from '@/lib/infrastructureQr';

interface FeedingSession {
  id: string;
  time: string;
  sessionType: string;
  quantity: number;
  feederName: string;
  notes?: string;
  temperature?: number;
  behavior?: string;
  mortality?: number;
}

interface FeedingRecord {
  infrastructure_id?: string | null;
  id: string;
  date: string;
  time: string;
  feedType: string;
  quantity: number;
  unit: string;
  temperature: number;
  notes: string;
  unitId: string;
  behavior?: string;
  feed_type?: string;
  feederName?: string;
  prescribedQuantity?: number;
  actualQuantity?: number;
  mortality?: number;
  feedingSession?: string;
  frequency?: number;
  sessions?: FeedingSession[];
}

interface FeedingHistoryProps {
  records: FeedingRecord[];
  onEdit: (record: FeedingRecord) => void;
  onDelete: (id: string) => void;
  onPrint: (record: FeedingRecord) => void;
  onAddSession?: (recordId: string, session: Partial<FeedingSession>) => void;
  unitName?: string;
  cycleName?: string;
}

// Sessions personnalisables par défaut
const DEFAULT_SESSION_TYPES = [
  { value: 'matin', label: 'Matin (6h-10h)', timeRange: '06:00-10:00' },
  { value: 'midi', label: 'Midi (11h-14h)', timeRange: '11:00-14:00' },
  { value: 'apres-midi', label: 'Après-midi (15h-17h)', timeRange: '15:00-17:00' },
  { value: 'soir', label: 'Soir (18h-20h)', timeRange: '18:00-20:00' },
];

const FeedingHistory = ({ records, onEdit, onDelete, onPrint, onAddSession, unitName = '', cycleName }: FeedingHistoryProps) => {
  const { infrastructures } = useProductionUnits();
  const { infrastructures: cycleInfrastructures } = useCycleInfrastructures(undefined, true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [editingRecord, setEditingRecord] = useState<FeedingRecord | null>(null);
  const [addSessionDialogOpen, setAddSessionDialogOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [customSessionTypes, setCustomSessionTypes] = useState<typeof DEFAULT_SESSION_TYPES>(() => {
    const saved = localStorage.getItem('customFeedingSessionTypes');
    return saved ? JSON.parse(saved) : DEFAULT_SESSION_TYPES;
  });
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const [newSessionType, setNewSessionType] = useState({ value: '', label: '', timeRange: '' });
  
  const [newSessionData, setNewSessionData] = useState({
    time: new Date().toTimeString().slice(0, 5),
    sessionType: '',
    quantity: '',
    feederName: '',
    notes: '',
    temperature: '',
    behavior: '',
    mortality: ''
  });

  // Grouper les enregistrements par date
  const recordsByDate = useMemo(() => {
    const grouped: Record<string, FeedingRecord[]> = {};
    
    records.forEach(record => {
      const date = record.date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(record);
    });
    
    // Trier par date décroissante
    const sortedDates = Object.keys(grouped).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
    
    // Trier les enregistrements par heure pour chaque date
    sortedDates.forEach(date => {
      grouped[date].sort((a, b) => {
        const timeA = a.time || '00:00';
        const timeB = b.time || '00:00';
        return timeA.localeCompare(timeB);
      });
    });
    
    return { grouped, sortedDates };
  }, [records]);

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const handleExport = (record: FeedingRecord, format: 'pdf' | 'word' | 'excel' | 'csv') => {
    const exportOptions = {
      infrastructureQr: resolveInfrastructureQr(record.unitId, record.infrastructure_id, infrastructures, cycleInfrastructures),
      record: {
        ...record,
        feed_type: record.feed_type || record.feedType,
      },
      unitName,
      cycleName,
      companyName: 'AquaPilot'
    };

    switch (format) {
      case 'pdf':
        exportFeedingToPDF(exportOptions);
        break;
      case 'word':
        exportFeedingToWord(exportOptions);
        break;
      case 'excel':
        exportFeedingToExcel(exportOptions);
        break;
      case 'csv':
        exportFeedingToCSV(exportOptions);
        break;
    }
  };

  const handleAddSession = (recordId: string) => {
    setSelectedRecordId(recordId);
    setNewSessionData({
      time: new Date().toTimeString().slice(0, 5),
      sessionType: '',
      quantity: '',
      feederName: '',
      notes: '',
      temperature: '',
      behavior: '',
      mortality: ''
    });
    setAddSessionDialogOpen(true);
  };

  const handleSaveSession = () => {
    if (selectedRecordId && onAddSession) {
      onAddSession(selectedRecordId, {
        time: newSessionData.time,
        sessionType: newSessionData.sessionType,
        quantity: parseFloat(newSessionData.quantity) || 0,
        feederName: newSessionData.feederName,
        notes: newSessionData.notes,
        temperature: newSessionData.temperature ? parseFloat(newSessionData.temperature) : undefined,
        behavior: newSessionData.behavior,
        mortality: newSessionData.mortality ? parseInt(newSessionData.mortality) : undefined
      });
    }
    setAddSessionDialogOpen(false);
    setSelectedRecordId(null);
  };

  const handleAddCustomSession = () => {
    if (newSessionType.value && newSessionType.label) {
      const updated = [...customSessionTypes, { ...newSessionType }];
      setCustomSessionTypes(updated);
      localStorage.setItem('customFeedingSessionTypes', JSON.stringify(updated));
      setNewSessionType({ value: '', label: '', timeRange: '' });
    }
  };

  const handleRemoveCustomSession = (value: string) => {
    const updated = customSessionTypes.filter(s => s.value !== value);
    setCustomSessionTypes(updated);
    localStorage.setItem('customFeedingSessionTypes', JSON.stringify(updated));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getSessionLabel = (value: string) => {
    const session = customSessionTypes.find(s => s.value === value);
    return session?.label || value;
  };

  const getTotalQuantityForDate = (dateRecords: FeedingRecord[]) => {
    return dateRecords.reduce((sum, r) => sum + (r.quantity || 0), 0);
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 sm:p-8 text-center">
          <p className="text-muted-foreground text-sm sm:text-base">Aucun enregistrement d'alimentation</p>
        </CardContent>
      </Card>
    );
  }

  // Données pour le graphique
  const feedingChartData = records
    .slice()
    .sort((a, b) => new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime())
    .map(record => ({
      date: new Date(`${record.date} ${record.time}`).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
      quantite: record.quantity,
      temperature: record.temperature
    }));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Bouton de personnalisation des sessions */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowSessionSettings(!showSessionSettings)}
          className="text-xs"
        >
          <Settings className="w-3 h-3 mr-1" />
          Sessions personnalisées
        </Button>
      </div>

      {/* Paramètres des sessions personnalisées */}
      {showSessionSettings && (
        <Card className="border-dashed">
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm">Personnaliser les sessions de nourrissage</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {customSessionTypes.map((session) => (
                <Badge 
                  key={session.value} 
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {session.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                    onClick={() => handleRemoveCustomSession(session.value)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input
                placeholder="ID (ex: nuit)"
                value={newSessionType.value}
                onChange={(e) => setNewSessionType({ ...newSessionType, value: e.target.value })}
                className="text-xs h-8"
              />
              <Input
                placeholder="Libellé (ex: Nuit 22h-6h)"
                value={newSessionType.label}
                onChange={(e) => setNewSessionType({ ...newSessionType, label: e.target.value })}
                className="text-xs h-8"
              />
              <Input
                placeholder="Plage horaire (ex: 22:00-06:00)"
                value={newSessionType.timeRange}
                onChange={(e) => setNewSessionType({ ...newSessionType, timeRange: e.target.value })}
                className="text-xs h-8"
              />
              <Button size="sm" onClick={handleAddCustomSession} className="h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graphique d'évolution */}
      <Card>
        <CardHeader className="p-3 sm:p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
            Évolution de l'Alimentation
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={feedingChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 10 }} 
                  label={{ value: 'Quantité (kg)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Température (°C)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }}
                />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="quantite" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  name="Quantité (kg)"
                  dot={{ r: 3 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Température (°C)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Historique groupé par date */}
      {recordsByDate.sortedDates.map((date) => {
        const dateRecords = recordsByDate.grouped[date];
        const isExpanded = expandedDates.has(date);
        const totalQuantity = getTotalQuantityForDate(dateRecords);

        return (
          <Card key={date} className="overflow-hidden">
            <Collapsible open={isExpanded} onOpenChange={() => toggleDate(date)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="p-3 sm:p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base capitalize">
                          {formatDate(date)}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {dateRecords.length} session(s) • Total: {totalQuantity.toFixed(1)} kg
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSession(dateRecords[0].id);
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Session
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                  {dateRecords.map((record, index) => (
                    <div 
                      key={record.id} 
                      className={`p-3 rounded-lg bg-muted/30 ${index > 0 ? 'border-t' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {record.time || 'N/A'}
                            </Badge>
                            {record.feedingSession && (
                              <Badge variant="secondary" className="text-xs">
                                {getSessionLabel(record.feedingSession)}
                              </Badge>
                            )}
                            <Badge className="text-xs bg-primary/10 text-primary">
                              {record.quantity} {record.unit || 'kg'}
                            </Badge>
                          </div>
                          
                          <h4 className="font-medium text-sm break-words">
                            {record.feedType || record.feed_type}
                          </h4>
                          
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-2">
                            {record.feederName && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {record.feederName}
                              </div>
                            )}
                            {record.temperature && (
                              <div className="flex items-center gap-1">
                                <Thermometer className="w-3 h-3" />
                                {record.temperature}°C
                              </div>
                            )}
                            {record.mortality && record.mortality > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                Mortalité: {record.mortality}
                              </Badge>
                            )}
                          </div>
                          
                          {record.notes && (
                            <p className="text-xs text-muted-foreground mt-2 break-words whitespace-pre-line">
                              {record.notes}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-7 w-7 p-0"
                                title="Télécharger"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-background">
                              <DropdownMenuItem onClick={() => handleExport(record, 'pdf')}>
                                <Printer className="w-4 h-4 mr-2 text-red-500" />
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(record, 'word')}>
                                <FileText className="w-4 h-4 mr-2 text-blue-500" />
                                Word
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(record, 'excel')}>
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" />
                                Excel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExport(record, 'csv')}>
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-gray-500" />
                                CSV
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onPrint(record)}
                            className="h-7 w-7 p-0"
                            title="Imprimer"
                          >
                            <Printer className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditingRecord(record)}
                            className="h-7 w-7 p-0"
                            title="Modifier"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onDelete(record.id)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {/* Dialog pour ajouter une session */}
      <Dialog open={addSessionDialogOpen} onOpenChange={setAddSessionDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              Ajouter une session de nourrissage
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="session-time" className="text-xs">Heure</Label>
                <Input
                  id="session-time"
                  type="time"
                  value={newSessionData.time}
                  onChange={(e) => setNewSessionData({ ...newSessionData, time: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Label htmlFor="session-type" className="text-xs">Type de session</Label>
                <Select 
                  value={newSessionData.sessionType}
                  onValueChange={(value) => setNewSessionData({ ...newSessionData, sessionType: value })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Choisir..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customSessionTypes.map((session) => (
                      <SelectItem key={session.value} value={session.value} className="text-xs">
                        {session.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="session-feeder" className="text-xs">Nom de la personne</Label>
              <Input
                id="session-feeder"
                value={newSessionData.feederName}
                onChange={(e) => setNewSessionData({ ...newSessionData, feederName: e.target.value })}
                placeholder="Qui a nourri?"
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="session-quantity" className="text-xs">Quantité (kg)</Label>
                <Input
                  id="session-quantity"
                  type="number"
                  step="0.1"
                  value={newSessionData.quantity}
                  onChange={(e) => setNewSessionData({ ...newSessionData, quantity: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <Label htmlFor="session-temp" className="text-xs">Température (°C)</Label>
                <Input
                  id="session-temp"
                  type="number"
                  step="0.1"
                  value={newSessionData.temperature}
                  onChange={(e) => setNewSessionData({ ...newSessionData, temperature: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="session-mortality" className="text-xs">Mortalité observée</Label>
              <Input
                id="session-mortality"
                type="number"
                min="0"
                value={newSessionData.mortality}
                onChange={(e) => setNewSessionData({ ...newSessionData, mortality: e.target.value })}
                placeholder="Nombre"
                className="text-xs h-9"
              />
            </div>

            <div>
              <Label htmlFor="session-behavior" className="text-xs">Comportement</Label>
              <Select 
                value={newSessionData.behavior}
                onValueChange={(value) => setNewSessionData({ ...newSessionData, behavior: value })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comportement normal" className="text-xs">Comportement normal</SelectItem>
                  <SelectItem value="Très actifs" className="text-xs">Très actifs</SelectItem>
                  <SelectItem value="Peu actifs" className="text-xs">Peu actifs</SelectItem>
                  <SelectItem value="Refus partiel" className="text-xs">Refus partiel de nourriture</SelectItem>
                  <SelectItem value="Refus total" className="text-xs">Refus total de nourriture</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="session-notes" className="text-xs">Notes</Label>
              <Textarea
                id="session-notes"
                value={newSessionData.notes}
                onChange={(e) => setNewSessionData({ ...newSessionData, notes: e.target.value })}
                placeholder="Observations..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveSession} className="flex-1 h-9 text-xs">
                Enregistrer
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setAddSessionDialogOpen(false)}
                className="h-9 text-xs"
              >
                Annuler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pour modifier un enregistrement */}
      {editingRecord && (
        <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
          <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                Modifier la fiche
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={editingRecord.date}
                    onChange={(e) => setEditingRecord({ ...editingRecord, date: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Heure</Label>
                  <Input
                    type="time"
                    value={editingRecord.time}
                    onChange={(e) => setEditingRecord({ ...editingRecord, time: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Session</Label>
                <Select 
                  value={editingRecord.feedingSession || ''}
                  onValueChange={(value) => setEditingRecord({ ...editingRecord, feedingSession: value })}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder="Choisir session..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customSessionTypes.map((session) => (
                      <SelectItem key={session.value} value={session.value} className="text-xs">
                        {session.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Type d'aliment</Label>
                <Input
                  value={editingRecord.feedType || editingRecord.feed_type || ''}
                  onChange={(e) => setEditingRecord({ 
                    ...editingRecord, 
                    feedType: e.target.value,
                    feed_type: e.target.value 
                  })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantité</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingRecord.quantity}
                    onChange={(e) => setEditingRecord({ 
                      ...editingRecord, 
                      quantity: parseFloat(e.target.value) || 0 
                    })}
                    className="text-xs h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Température (°C)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editingRecord.temperature || ''}
                    onChange={(e) => setEditingRecord({ 
                      ...editingRecord, 
                      temperature: parseFloat(e.target.value) || 0 
                    })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Personne</Label>
                <Input
                  value={editingRecord.feederName || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, feederName: e.target.value })}
                  placeholder="Nom de la personne"
                  className="text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Mortalité</Label>
                <Input
                  type="number"
                  min="0"
                  value={editingRecord.mortality || ''}
                  onChange={(e) => setEditingRecord({ 
                    ...editingRecord, 
                    mortality: parseInt(e.target.value) || 0 
                  })}
                  className="text-xs h-9"
                />
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={editingRecord.notes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                  rows={3}
                  className="text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => {
                    onEdit(editingRecord);
                    setEditingRecord(null);
                  }} 
                  className="flex-1 h-9 text-xs"
                >
                  Sauvegarder
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingRecord(null)}
                  className="h-9 text-xs"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default FeedingHistory;
