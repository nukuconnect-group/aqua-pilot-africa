import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ProfileAvatar from '@/components/ProfileAvatar';
import { Camera, Loader2, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { t } = useSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.name || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t('error'),
        description: t('invalid_file_type'),
        variant: 'destructive'
      });
      return;
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('error'),
        description: t('file_too_large'),
        variant: 'destructive'
      });
      return;
    }

    setSelectedFile(file);
    
    // Créer une prévisualisation
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!selectedFile || !user) return null;

    setIsUploading(true);
    
    try {
      // Supprimer l'ancien avatar s'il existe
      if (user.avatar) {
        const oldPath = user.avatar.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload du nouveau fichier
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: t('error'),
        description: t('upload_failed'),
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      let avatarUrl = user.avatar;

      // Upload de la nouvelle photo si sélectionnée
      if (selectedFile) {
        const newAvatarUrl = await uploadAvatar();
        if (newAvatarUrl) {
          avatarUrl = newAvatarUrl;
        }
      }

      // Mise à jour du profil
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: t('success'),
        description: t('profile_updated')
      });

      // Fermer le dialogue - la mise à jour se fera automatiquement via realtime
      handleClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('error'),
        description: t('update_failed'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFullName(user?.name || '');
    setAvatarPreview(null);
    setSelectedFile(null);
    onClose();
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('profile')}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <ProfileAvatar src={avatarPreview || user.avatar} name={user.name} className="h-28 w-28 sm:h-32 sm:w-32" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="rounded-md"
            >
              {isUploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('saving')}</>
              ) : (
                <><Camera className="mr-2 h-4 w-4" /> {t('click_camera_to_change')}</>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <p className="text-[11px] text-muted-foreground">JPG, PNG, WEBP (max 5MB)</p>
          </div>

          {/* Informations */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('full_name')}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('enter_full_name')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {t('email_cannot_be_changed')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('role')}</Label>
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 bg-muted rounded-md text-sm flex-1">
                  {user.role === 'admin' ? t('admin_role') : 
                   user.role === 'manager' ? t('manager_role') : 
                   user.role === 'operator' ? t('operator_role') : 
                   t('user_role')}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isSaving || isUploading}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1"
              disabled={isSaving || isUploading || !fullName.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('save_changes')}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
