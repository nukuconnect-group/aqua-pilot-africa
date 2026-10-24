import React, { useMemo } from 'react';
import { printWhenReady } from '@/lib/printReady';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  User, 
  Thermometer, 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2,
  AlertTriangle,
  Utensils,
  Download,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FeedingRecord } from '@/hooks/useFeedingRecords';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useCycleInfrastructures } from '@/hooks/useCycleInfrastructures';
import { resolveInfrastructureQr, infrastructureQrHTML, infrastructureQrValue, infrastructureQrPng, infrastructureQrTableHTML } from '@/lib/infrastructureQr';

interface DailyFeedingSummaryProps {
  records: FeedingRecord[];
  unitName: string;
  onEdit: (record: FeedingRecord) => void;
  onDelete: (id: string) => void;
}

const SESSION_LABELS: Record<string, { label: string; icon: string }> = {
  matin: { label: 'Matin', icon: '🌅' },
  midi: { label: 'Midi', icon: '☀️' },
  'apres-midi': { label: 'Après-midi', icon: '🌤️' },
  soir: { label: 'Soir', icon: '🌆' },
  nuit: { label: 'Nuit', icon: '🌙' },
};

const BEHAVIOR_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'bg-green-100 text-green-800' },
  actif: { label: 'Très actifs', color: 'bg-blue-100 text-blue-800' },
  lent: { label: 'Peu actifs', color: 'bg-yellow-100 text-yellow-800' },
  refus_partiel: { label: 'Refus partiel', color: 'bg-orange-100 text-orange-800' },
  refus_total: { label: 'Refus total', color: 'bg-red-100 text-red-800' },
  stress: { label: 'Stress', color: 'bg-red-100 text-red-800' },
};

const DailyFeedingSummary = ({ records, unitName, onEdit, onDelete }: DailyFeedingSummaryProps) => {
  const { infrastructures } = useProductionUnits();
  const { infrastructures: cycleInfrastructures } = useCycleInfrastructures(undefined, true);
  const recordQr = (record: FeedingRecord) => resolveInfrastructureQr(record.unit_id || '', record.infrastructure_id, infrastructures, cycleInfrastructures);
  const [expandedDates, setExpandedDates] = React.useState<Set<string>>(new Set());

  // Grouper par date
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
    
    // Trier les sessions par heure dans chaque jour
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (dateStr === today.toISOString().split('T')[0]) {
      return "Aujourd'hui";
    }
    if (dateStr === yesterday.toISOString().split('T')[0]) {
      return "Hier";
    }
    
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  };

  const formatDateFull = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMMM yyyy', { locale: fr });
    } catch {
      return dateStr;
    }
  };

  const getDaySummary = (dayRecords: FeedingRecord[]) => {
    const totalQuantity = dayRecords.reduce((sum, r) => sum + (r.quantity || r.actual_quantity || 0), 0);
    const totalMortality = dayRecords.reduce((sum, r) => sum + (r.mortality || 0), 0);
    const feeders = [...new Set(dayRecords.map(r => r.feeder_name).filter(Boolean))];
    
    return { totalQuantity, totalMortality, feeders, sessionCount: dayRecords.length };
  };

  const getSessionInfo = (record: FeedingRecord) => {
    // Handle both session_type (from DB) and sessionType (from old format)
    const sessionType = record.session_type || (record as any).sessionType || 'autre';
    return SESSION_LABELS[sessionType] || { label: sessionType || 'Session', icon: '📋' };
  };

  const getBehaviorInfo = (behavior: string | undefined) => {
    if (!behavior) return null;
    return BEHAVIOR_LABELS[behavior] || { label: behavior, color: 'bg-gray-100 text-gray-800' };
  };

  // Export functions for daily records
  const generateDailyHTML = (date: string, dayRecords: FeedingRecord[], qrImages: Record<string, string> = {}) => {
    const summary = getDaySummary(dayRecords);
    
    const sessionsHTML = dayRecords.map(record => {
      const sessionInfo = getSessionInfo(record);
      const behaviorInfo = getBehaviorInfo(record.behavior);
      
      return `
        <div class="session-card">
          ${infrastructureQrHTML(recordQr(record), qrImages[record.id])}
          <div class="session-header">
            <span class="session-badge">${sessionInfo.icon} ${sessionInfo.label} - ${record.time || '--:--'}</span>
          </div>
          <div class="session-grid">
            <div class="session-item">
              <span class="label">Nourrisseur</span>
              <span class="value">${record.feeder_name || '-'}</span>
            </div>
            <div class="session-item">
              <span class="label">Type d'aliment</span>
              <span class="value">${record.feed_type || '-'}</span>
            </div>
            <div class="session-item">
              <span class="label">Qté prescrite</span>
              <span class="value">${record.prescribed_quantity ? `${record.prescribed_quantity} kg` : '-'}</span>
            </div>
            <div class="session-item">
              <span class="label">Qté servie</span>
              <span class="value highlight">${record.actual_quantity || record.quantity} kg</span>
            </div>
            <div class="session-item">
              <span class="label">Qté restante</span>
              <span class="value ${(record.remaining_quantity || 0) > 0 ? 'warning' : ''}">${record.remaining_quantity ? `${record.remaining_quantity} kg` : '0 kg'}</span>
            </div>
            <div class="session-item">
              <span class="label">Température eau</span>
              <span class="value">${record.temperature ? `${record.temperature}°C` : '-'}</span>
            </div>
            <div class="session-item">
              <span class="label">Mortalité</span>
              <span class="value ${(record.mortality || 0) > 0 ? 'danger' : ''}">${record.mortality || 0}</span>
            </div>
            <div class="session-item">
              <span class="label">Comportement</span>
              <span class="value">${behaviorInfo?.label || record.behavior || '-'}</span>
            </div>
          </div>
          ${record.notes ? `<div class="session-notes"><strong>Notes:</strong> ${record.notes}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fiche de Nourrissage - ${formatDateFull(date)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            background: #f8fafc;
            color: #1e293b;
          }
          .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            border-bottom: 3px solid #f97316;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo { 
            font-size: 28px; 
            font-weight: 700; 
            color: #f97316;
          }
          .document-title { text-align: right; }
          .document-title h1 { font-size: 24px; color: #1e293b; margin-bottom: 5px; }
          .document-title p { color: #64748b; font-size: 14px; }
          
          .summary-section {
            background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 30px;
          }
          .summary-section h2 { font-size: 18px; margin-bottom: 15px; }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
          }
          .summary-item { text-align: center; }
          .summary-item .value { font-size: 24px; font-weight: 700; }
          .summary-item .label { font-size: 12px; opacity: 0.9; }
          
          .sessions-title { 
            font-size: 18px; 
            color: #f97316; 
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #fed7aa;
          }
          
          .session-card {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            background: #fafafa;
          }
          .session-header {
            margin-bottom: 15px;
          }
          .session-badge {
            background: #f97316;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
          }
          .session-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .session-item {
            background: white;
            padding: 10px;
            border-radius: 8px;
            border-left: 3px solid #f97316;
          }
          .session-item .label { 
            display: block;
            font-size: 11px; 
            color: #64748b; 
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .session-item .value { 
            font-size: 14px; 
            font-weight: 600;
            color: #1e293b;
          }
          .session-item .value.highlight { color: #16a34a; }
          .session-item .value.warning { color: #ea580c; }
          .session-item .value.danger { color: #dc2626; }
          
          .session-notes {
            margin-top: 15px;
            padding: 12px;
            background: #fffbeb;
            border-radius: 8px;
            font-size: 13px;
            color: #78350f;
            border-left: 3px solid #f59e0b;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            color: #94a3b8;
            font-size: 12px;
          }
          
          .signature-section {
            margin-top: 40px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
          }
          .signature-box {
            text-align: center;
            padding-top: 60px;
            border-top: 1px dashed #94a3b8;
          }
          .signature-label { font-size: 12px; color: #64748b; }
          
          @media print {
            body { padding: 20px; background: white; }
            .container { box-shadow: none; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">AquaPilot</div>
            <div class="document-title">
              <h1>Fiche de Nourrissage Journalière</h1>
              <p>${unitName}</p>
            </div>
          </div>

          <div class="summary-section">
            <h2>📅 ${formatDateFull(date)}</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="value">${summary.sessionCount}</div>
                <div class="label">Sessions</div>
              </div>
              <div class="summary-item">
                <div class="value">${summary.totalQuantity.toFixed(1)} kg</div>
                <div class="label">Total servi</div>
              </div>
              <div class="summary-item">
                <div class="value">${summary.totalMortality}</div>
                <div class="label">Mortalité</div>
              </div>
              <div class="summary-item">
                <div class="value">${summary.feeders.length}</div>
                <div class="label">Nourrisseurs</div>
              </div>
            </div>
          </div>

          <h3 class="sessions-title">🍽️ Détail des sessions (${summary.sessionCount})</h3>
          ${sessionsHTML}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Signature du Responsable</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Visa du Superviseur</div>
            </div>
          </div>

          <div class="footer">
            <span>Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
            <span>AquaPilot - Gestion Aquacole</span>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const exportToPDF = (date: string, dayRecords: FeedingRecord[]) => {
    const html = generateDailyHTML(date, dayRecords);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      void printWhenReady(printWindow);
    }
  };

  const exportToWord = async (date: string, dayRecords: FeedingRecord[]) => {
    const qrImages: Record<string, string> = {};
    for (const record of dayRecords) {
      const qr = recordQr(record);
      if (qr) qrImages[record.id] = await infrastructureQrPng(qr);
    }
    const html = generateDailyHTML(date, dayRecords, qrImages);
    const blob = new Blob([`
      <!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:w="urn:schemas-microsoft-com:office:word" 
            xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>${html}</body>
      </html>
    `], { type: 'application/msword' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiche-nourrissage-${date}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = async (date: string, dayRecords: FeedingRecord[]) => {
    const summary = getDaySummary(dayRecords);
    
    const rows = [
      ['FICHE DE NOURRISSAGE JOURNALIÈRE'],
      [''],
      ['Unité', unitName],
      ['Date', formatDateFull(date)],
      ['Nombre de sessions', summary.sessionCount.toString()],
      ['Total quantité servie', `${summary.totalQuantity.toFixed(1)} kg`],
      ['Mortalité totale', summary.totalMortality.toString()],
      ['Nourrisseurs', summary.feeders.join(', ')],
      [''],
      ['DÉTAIL DES SESSIONS'],
      ['Session', 'Heure', 'Nourrisseur', 'Type aliment', 'Qté prescrite (kg)', 'Qté servie (kg)', 'Qté restante (kg)', 'Température (°C)', 'Mortalité', 'Comportement', 'Notes', 'Infrastructure', 'QR infrastructure'],
      ...dayRecords.map(r => {
        const sessionInfo = getSessionInfo(r);
        const behaviorInfo = getBehaviorInfo(r.behavior);
        const qr = recordQr(r);
        return [
          sessionInfo.label,
          r.time || '-',
          r.feeder_name || '-',
          r.feed_type || '-',
          r.prescribed_quantity?.toString() || '-',
          (r.actual_quantity || r.quantity).toString(),
          r.remaining_quantity?.toString() || '0',
          r.temperature?.toString() || '-',
          r.mortality?.toString() || '0',
          behaviorInfo?.label || r.behavior || '-',
          (r.notes || '').replace(/\n/g, ' '),
          qr?.name || '',
          qr ? infrastructureQrValue(qr) : ''
        ];
      })
    ];
    
    const figures = new Map<string, string>();
    for (const record of dayRecords) {
      const qr = recordQr(record);
      if (qr && !figures.has(qr.id)) figures.set(qr.id, infrastructureQrHTML(qr, await infrastructureQrPng(qr)));
    }
    const blob = new Blob(['\ufeff' + infrastructureQrTableHTML(rows, [...figures.values()].join(''))], { type: 'application/vnd.ms-excel;charset=utf-8' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiche-nourrissage-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = (date: string, dayRecords: FeedingRecord[]) => {
    const headers = ['Date', 'Heure', 'Session', 'Nourrisseur', 'Type aliment', 'Qté prescrite (kg)', 'Qté servie (kg)', 'Qté restante (kg)', 'Température (°C)', 'Mortalité', 'Comportement', 'Notes', 'Infrastructure', 'QR infrastructure'];
    
    const csvRows = dayRecords.map(r => {
      const sessionInfo = getSessionInfo(r);
      const behaviorInfo = getBehaviorInfo(r.behavior);
      const qr = recordQr(r);
      return [
        date,
        r.time || '',
        sessionInfo.label,
        r.feeder_name || '',
        r.feed_type || '',
        r.prescribed_quantity?.toString() || '',
        (r.actual_quantity || r.quantity).toString(),
        r.remaining_quantity?.toString() || '0',
        r.temperature?.toString() || '',
        r.mortality?.toString() || '0',
        behaviorInfo?.label || r.behavior || '',
        (r.notes || '').replace(/\n/g, ' ').replace(/,/g, ';'),
        qr?.name || '',
        qr ? infrastructureQrValue(qr) : ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fiche-nourrissage-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Utensils className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Aucune session de nourrissage enregistrée</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {recordsByDate.sortedDates.map((date) => {
        const dayRecords = recordsByDate.grouped[date];
        const isExpanded = expandedDates.has(date);
        const summary = getDaySummary(dayRecords);

        return (
          <Card key={date} className="overflow-hidden">
            <Collapsible open={isExpanded} onOpenChange={() => toggleDate(date)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold capitalize">{formatDate(date)}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{summary.sessionCount} session(s)</span>
                          <span>•</span>
                          <span className="font-medium text-primary">{summary.totalQuantity.toFixed(1)} kg</span>
                          {summary.totalMortality > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-red-600">⚠️ {summary.totalMortality} mort(s)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Download button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Télécharger</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportToPDF(date, dayRecords); }}>
                            <FileText className="w-4 h-4 mr-2 text-red-600" />
                            Exporter en PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportToWord(date, dayRecords); }}>
                            <FileText className="w-4 h-4 mr-2 text-blue-600" />
                            Exporter en Word
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportToExcel(date, dayRecords); }}>
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                            Exporter en Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); exportToCSV(date, dayRecords); }}>
                            <FileSpreadsheet className="w-4 h-4 mr-2 text-orange-600" />
                            Exporter en CSV
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {summary.feeders.length > 0 && (
                        <Badge variant="outline" className="text-xs hidden sm:flex">
                          <User className="w-3 h-3 mr-1" />
                          {summary.feeders.slice(0, 2).join(', ')}
                          {summary.feeders.length > 2 && ` +${summary.feeders.length - 2}`}
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="p-3 pt-0 space-y-2">
                  {dayRecords.map((record) => {
                    const sessionInfo = getSessionInfo(record);
                    const behaviorInfo = getBehaviorInfo(record.behavior);
                    
                    return (
                      <div 
                        key={record.id} 
                        className="p-3 rounded-lg bg-muted/30 border border-border/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {/* En-tête de session */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs font-medium">
                                {sessionInfo.icon} {sessionInfo.label}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {record.time || '--:--'}
                              </Badge>
                              <Badge className="text-xs bg-primary/10 text-primary border-0">
                                {(record.quantity || record.actual_quantity || 0).toFixed(1)} kg
                              </Badge>
                            </div>
                            
                            {/* Détails */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              {record.feeder_name && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <User className="w-3 h-3" />
                                  <span className="font-medium text-foreground">{record.feeder_name}</span>
                                </div>
                              )}
                              {record.feed_type && (
                                <div className="flex items-center gap-1 text-muted-foreground col-span-2 sm:col-span-1">
                                  <Utensils className="w-3 h-3" />
                                  <span className="truncate">{record.feed_type}</span>
                                </div>
                              )}
                              {record.temperature != null && record.temperature > 0 && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Thermometer className="w-3 h-3" />
                                  <span>{record.temperature}°C</span>
                                </div>
                              )}
                              {behaviorInfo && record.behavior && (
                                <Badge className={`text-xs ${behaviorInfo.color} border-0`}>
                                  {behaviorInfo.label}
                                </Badge>
                              )}
                            </div>

                            {/* Quantités prescrites/servies */}
                            {record.prescribed_quantity && (
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Prescrit: {record.prescribed_quantity} kg</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-medium">Servi: {record.actual_quantity || record.quantity} kg</span>
                                {(record.remaining_quantity || 0) > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    Reste: {record.remaining_quantity} kg
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Mortalité */}
                            {(record.mortality || 0) > 0 && (
                              <div className="mt-2">
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Mortalité: {record.mortality}
                                </Badge>
                              </div>
                            )}

                            {/* Notes */}
                            {record.notes && (
                              <p className="mt-2 text-xs text-muted-foreground italic line-clamp-2">
                                {record.notes}
                              </p>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(record)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => onDelete(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};

export default DailyFeedingSummary;