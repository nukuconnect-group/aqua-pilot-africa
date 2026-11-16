import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2, Mail } from 'lucide-react';
import { TeamMember } from '@/hooks/useTeamMembers';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  isResetting: boolean;
  onReset: (member: TeamMember) => void;
}

const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({
  open,
  onOpenChange,
  member,
  isResetting,
  onReset,
}) => {
  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            Réinitialiser le mot de passe
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm">
              Envoyer à <strong>{member.member_name}</strong> ({member.member_email}) un lien sécurisé pour choisir un nouveau mot de passe.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => onReset(member)} disabled={isResetting} className="w-full">
              {isResetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Envoyer le lien par email
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isResetting} className="w-full">
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;
