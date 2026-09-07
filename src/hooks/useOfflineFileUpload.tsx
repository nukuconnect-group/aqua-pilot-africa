import { useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { compressImage, isImageFile, formatFileSize } from '@/lib/imageCompression';
import { offlineStorage } from '@/lib/offlineStorage';

interface UploadOptions {
  module: string; // Module où le fichier est utilisé
  compress?: boolean; // Compresser les images (défaut: true)
  metadata?: Record<string, any>; // Métadonnées supplémentaires
}

interface UploadedFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  compressedSize?: number;
  publicUrl?: string;
  offline?: boolean;
}

export const useOfflineFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { isOnline, setCachedData, getCachedData } = useOfflineContext();
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Upload un fichier avec support hors ligne et compression
   */
  const uploadFile = async (
    file: File,
    options: UploadOptions
  ): Promise<UploadedFile | null> => {
    if (!user) {
      toast({
        title: '❌ Erreur',
        description: 'Vous devez être connecté pour uploader des fichiers',
        variant: 'destructive',
      });
      return null;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      let processedFile = file;
      let compressionRatio = 1;
      
      // Compression automatique des images
      if (options.compress !== false && isImageFile(file)) {
        setUploadProgress(10);
        toast({
          title: '🔄 Compression en cours...',
          description: `Compression de ${file.name}`,
        });
        
        const result = await compressImage(file);
        processedFile = result.file;
        compressionRatio = result.compressionRatio;
        
        setUploadProgress(30);
      }

      const fileName = `${Date.now()}_${processedFile.name}`;
      const filePath = `${user.id}/${options.module}/${fileName}`;

      if (isOnline) {
        // Mode en ligne : upload direct vers Supabase
        setUploadProgress(40);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('user-files')
          .upload(filePath, processedFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        setUploadProgress(70);

        // Récupérer l'URL publique
        const { data: urlData } = supabase.storage
          .from('user-files')
          .getPublicUrl(filePath);

        // Enregistrer les métadonnées dans la table
        const fileRecord = {
          user_id: user.id,
          file_name: processedFile.name,
          file_path: uploadData.path,
          file_type: processedFile.type,
          file_size: file.size,
          compressed_size: processedFile.size,
          module: options.module,
          metadata: {
            ...options.metadata,
            compression_ratio: compressionRatio,
            original_size: file.size,
          },
        };

        const { data: recordData, error: recordError } = await supabase
          .from('user_files')
          .insert(fileRecord as any)
          .select()
          .single();

        if (recordError) throw recordError;
        if (!recordData) throw new Error('No data returned');

        setUploadProgress(100);

        toast({
          title: '✅ Fichier uploadé',
          description: `${processedFile.name} (${formatFileSize(processedFile.size)})`,
        });

        return {
          id: recordData.id as string,
          fileName: processedFile.name,
          filePath: uploadData.path,
          fileType: processedFile.type,
          fileSize: file.size,
          compressedSize: processedFile.size,
          publicUrl: urlData.publicUrl,
        };
      } else {
        // Mode hors ligne : sauvegarder en IndexedDB
        setUploadProgress(50);
        
        // Convertir le fichier en base64 pour le stockage
        const fileData = await fileToBase64(processedFile);
        
        const pendingFile = {
          id: `pending_${Date.now()}`,
          fileName: processedFile.name,
          filePath,
          fileType: processedFile.type,
          fileSize: file.size,
          compressedSize: processedFile.size,
          fileData,
          module: options.module,
          metadata: {
            ...options.metadata,
            compression_ratio: compressionRatio,
            original_size: file.size,
          },
          userId: user.id,
        };

        // Sauvegarder dans le cache offline
        const cachedFiles = (await getCachedData('pending_file_uploads')) || [];
        cachedFiles.push(pendingFile);
        await setCachedData('pending_file_uploads', cachedFiles);

        // Ajouter une action en attente pour synchronisation
        await offlineStorage.addPendingAction({
          type: 'file_upload',
          data: pendingFile,
          endpoint: `${supabase.storage.from('user-files').getPublicUrl('').data.publicUrl}`,
          method: 'POST',
        });

        setUploadProgress(100);

        toast({
          title: '💾 Fichier enregistré hors ligne',
          description: `${processedFile.name} sera synchronisé quand vous serez en ligne`,
        });

        return {
          id: pendingFile.id,
          fileName: processedFile.name,
          filePath,
          fileType: processedFile.type,
          fileSize: file.size,
          compressedSize: processedFile.size,
          offline: true,
        };
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
      toast({
        title: '❌ Erreur d\'upload',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  /**
   * Upload multiple fichiers
   */
  const uploadFiles = async (
    files: File[],
    options: UploadOptions
  ): Promise<UploadedFile[]> => {
    const results: UploadedFile[] = [];
    
    for (const file of files) {
      const result = await uploadFile(file, options);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  };

  /**
   * Supprimer un fichier
   */
  const deleteFile = async (filePath: string, fileId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      if (isOnline) {
        // Supprimer du storage
        const { error: storageError } = await supabase.storage
          .from('user-files')
          .remove([filePath]);

        if (storageError) throw storageError;

        // Supprimer l'enregistrement
        const { error: recordError } = await supabase
          .from('user_files')
          .delete()
          .eq('id', fileId as any);

        if (recordError) throw recordError;

        toast({
          title: '✅ Fichier supprimé',
        });

        return true;
      } else {
        // Mode hors ligne : marquer pour suppression
        await offlineStorage.addPendingAction({
          type: 'file_delete',
          data: { filePath, fileId },
          endpoint: `${supabase.storage.from('user-files').getPublicUrl('').data.publicUrl}`,
          method: 'DELETE',
        });

        toast({
          title: '💾 Suppression enregistrée',
          description: 'Le fichier sera supprimé quand vous serez en ligne',
        });

        return true;
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast({
        title: '❌ Erreur de suppression',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        variant: 'destructive',
      });
      return false;
    }
  };

  /**
   * Récupérer les fichiers d'un module
   */
  const getModuleFiles = async (module: string): Promise<any[]> => {
    if (!user) return [];

    try {
      if (isOnline) {
        const { data, error } = await supabase
          .from('user_files')
          .select('*')
          .eq('module', module as any)
          .eq('user_id', user.id as any)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } else {
        // Récupérer du cache
        const cached = (await getCachedData('user_files_cache')) || [];
        return cached.filter((f: any) => f.module === module && f.user_id === user.id);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des fichiers:', error);
      return [];
    }
  };

  return {
    uploadFile,
    uploadFiles,
    deleteFile,
    getModuleFiles,
    isUploading,
    uploadProgress,
    isOnline,
  };
};

// Utilitaire pour convertir un fichier en base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
