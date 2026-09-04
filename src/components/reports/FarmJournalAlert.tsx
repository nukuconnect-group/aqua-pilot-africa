import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, X } from 'lucide-react';
import { JOURNAL_EVENT, markJournalsRead, unreadJournals, type JournalEntry } from '@/lib/farmJournal';

interface Props {
  onOpenJournal?: () => void;
}

const FarmJournalAlert: React.FC<Props> = ({ onOpenJournal }) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(unreadJournals());
    refresh();
    window.addEventListener(JOURNAL_EVENT, refresh);
    const i = setInterval(refresh, 60000);
    return () => { window.removeEventListener(JOURNAL_EVENT, refresh); clearInterval(i); };
  }, []);

  if (entries.length === 0) return null;

  const dismiss = () => { markJournalsRead(); setEntries([]); };

  return (
    <Card className="border-emerald-500/40 bg-emerald-500/5">
      <CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/15">
          <BookOpen className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-sm font-semibold">
            Journal de ferme prêt
            <Badge variant="outline" className="ml-2">{entries.length}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {entries.slice(0, 3).map(e => `${e.unitName} (${e.data.period})`).join(' · ')}
            {entries.length > 3 ? ` +${entries.length - 3}` : ''}
          </p>
        </div>
        {onOpenJournal && (
          <Button size="sm" onClick={() => { markJournalsRead(); setEntries([]); onOpenJournal(); }}>
            Ouvrir le journal
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Masquer l'alerte">
          <X className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default FarmJournalAlert;
