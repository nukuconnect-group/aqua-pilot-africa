import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, HeartPulse, ArrowRight, Stethoscope, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useSettings } from '@/contexts/SettingsContext';

interface BatchHealthActionsProps {
  batch: {
    id: string;
    species: string;
    variety?: string;
    quantity: number;
    status: 'healthy' | 'sick' | 'quarantine' | 'sold';
    unitName: string;
  };
  onStatusChange: (batchId: string, newStatus: 'healthy' | 'sick' | 'quarantine' | 'sold', notes?: string) => Promise<void>;
}

const BatchHealthActions: React.FC<BatchHealthActionsProps> = ({ batch, onStatusChange }) => {
  const [showQuarantineDialog, setShowQuarantineDialog] = useState(false);
  const [showDiseaseDialog, setShowDiseaseDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'quarantine' | 'sick' | 'healthy' | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useSettings();

  const handleQuarantine = async () => {
    setIsSubmitting(true);
    try {
      await onStatusChange(batch.id, 'quarantine', notes);
      toast({
        title: t('quarantine_applied'),
        description: `${batch.species} - ${batch.quantity} ${t('individuals_quarantined')}`,
      });
      setShowQuarantineDialog(false);
      setNotes('');
    } catch (error) {
      toast({
        title: t('error'),
        description: t('quarantine_error'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclareSick = async () => {
    setIsSubmitting(true);
    try {
      await onStatusChange(batch.id, 'sick', notes);
      toast({
        title: t('disease_declared'),
        description: `${batch.species} ${t('marked_as_sick')}`,
      });
      setShowDiseaseDialog(false);
      setNotes('');
      return true;
    } catch (error) {
      toast({
        title: t('error'),
        description: t('disease_declaration_error'),
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkHealthy = async () => {
    setIsSubmitting(true);
    try {
      await onStatusChange(batch.id, 'healthy', notes);
      toast({
        title: t('batch_recovered'),
        description: `${batch.species} ${t('marked_as_healthy')}`,
      });
      setNotes('');
    } catch (error) {
      toast({
        title: t('error'),
        description: t('status_update_error'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToProphylaxis = () => {
    navigate('/dashboard?module=prophylaxis');
  };

  const getStatusBadge = () => {
    switch (batch.status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('status_healthy')}</Badge>;
      case 'sick':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('status_sick')}</Badge>;
      case 'quarantine':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">{t('status_quarantine')}</Badge>;
      case 'sold':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">{t('status_sold')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="mobile-action-grid grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {/* Current Status */}
      {getStatusBadge()}
      
      {/* Action Buttons based on current status */}
      {batch.status === 'healthy' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={() => setShowQuarantineDialog(true)}
          >
            <Shield className="w-3 h-3 mr-1" />
            {t('put_in_quarantine')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => setShowDiseaseDialog(true)}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            {t('declare_sick')}
          </Button>
        </>
      )}

      {batch.status === 'quarantine' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={() => setShowDiseaseDialog(true)}
          >
            <AlertTriangle className="w-3 h-3 mr-1" />
            {t('declare_sick')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-300 hover:bg-green-50"
            onClick={handleMarkHealthy}
            disabled={isSubmitting}
          >
            <HeartPulse className="w-3 h-3 mr-1" />
            {t('mark_healthy')}
          </Button>
        </>
      )}

      {batch.status === 'sick' && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-300 hover:bg-orange-50"
            onClick={() => setShowQuarantineDialog(true)}
          >
            <Shield className="w-3 h-3 mr-1" />
            {t('put_in_quarantine')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 border-green-300 hover:bg-green-50"
            onClick={handleMarkHealthy}
            disabled={isSubmitting}
          >
            <HeartPulse className="w-3 h-3 mr-1" />
            {t('mark_recovered')}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-primary"
            onClick={goToProphylaxis}
          >
            <Stethoscope className="w-3 h-3 mr-1" />
            {t('go_to_prophylaxis')}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </>
      )}

      {/* Quarantine Dialog */}
      <Dialog open={showQuarantineDialog} onOpenChange={setShowQuarantineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Shield className="w-5 h-5" />
              {t('put_in_quarantine')}
            </DialogTitle>
            <DialogDescription>
              {t('quarantine_description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-orange-800 dark:text-orange-200">{t('batch_info')}</span>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {batch.species} {batch.variety ? `(${batch.variety})` : ''} - {batch.quantity} {t('individuals')}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                {t('unit')}: {batch.unitName}
              </p>
            </div>

            <div>
              <Label htmlFor="quarantine-notes">{t('quarantine_reason')}</Label>
              <Textarea
                id="quarantine-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('quarantine_notes_placeholder')}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowQuarantineDialog(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleQuarantine}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? t('processing') : t('confirm_quarantine')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disease Declaration Dialog */}
      <Dialog open={showDiseaseDialog} onOpenChange={setShowDiseaseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {t('declare_disease')}
            </DialogTitle>
            <DialogDescription>
              {t('disease_declaration_description')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-medium text-red-800 dark:text-red-200">{t('batch_info')}</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">
                {batch.species} {batch.variety ? `(${batch.variety})` : ''} - {batch.quantity} {t('individuals')}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {t('unit')}: {batch.unitName}
              </p>
            </div>

            <div>
              <Label htmlFor="disease-notes">{t('symptoms_observed')}</Label>
              <Textarea
                id="disease-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('disease_notes_placeholder')}
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                {t('prophylaxis_link_info')}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDiseaseDialog(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleDeclareSick}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? t('processing') : t('confirm_disease')}
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                if (await handleDeclareSick()) goToProphylaxis();
              }}
              disabled={isSubmitting}
            >
              {t('declare_and_go_prophylaxis')}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BatchHealthActions;
