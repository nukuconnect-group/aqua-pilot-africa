import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Image as ImageIcon,
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  Download
} from 'lucide-react';
import { useOfflineContext } from '@/contexts/OfflineContext';
import { supabase } from '@/integrations/supabase/appClient';
import { formatFileSize } from '@/lib/imageCompression';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export const OfflineFilesSync = () => {
  const { isOnline, getCachedData, setCachedData } = useOfflineContext();
  const [pendingUploads, setPendingUploads] = useState<any[]>([]);
  const [syncedFiles, setSyncedFiles] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  useEffect(() => {
    loadPendingFiles();
    loadSyncedFiles();
  }, []);

  const loadPendingFiles = async () => {
    const cached = (await getCachedData('pending_file_uploads')) || [];
    setPendingUploads(cached);
  };

  const loadSyncedFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSyncedFiles(data);
        await setCachedData('user_files_cache', data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error);
      // Fallback sur le cache
      const cached = (await getCachedData('user_files_cache')) || [];
      setSyncedFiles(cached);
    }
  };

  const syncPendingFiles = async () => {
    if (!isOnline || pendingUploads.length === 0) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      const total = pendingUploads.length;
      let completed = 0;

      for (const pendingFile of pendingUploads) {
        try {
          // Convertir base64 en Blob
          const base64Data = pendingFile.fileData.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: pendingFile.fileType });
          
          // Upload vers Supabase
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(pendingFile.filePath, blob, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Enregistrer les métadonnées
          const { error: recordError } = await supabase
            .from('user_files')
            .insert({
              file_name: pendingFile.fileName,
              file_path: uploadData.path,
              file_type: pendingFile.fileType,
              file_size: pendingFile.fileSize,
              compressed_size: pendingFile.compressedSize,
              module: pendingFile.module,
              metadata: pendingFile.metadata,
            } as any);

          if (recordError) throw recordError;

          // Supprimer du cache
          const updated = pendingUploads.filter(f => f.id !== pendingFile.id);
          setPendingUploads(updated);
          await setCachedData('pending_file_uploads', updated);

          completed++;
          setSyncProgress((completed / total) * 100);
        } catch (error) {
          console.error(`Erreur sync fichier ${pendingFile.fileName}:`, error);
        }
      }

      await loadSyncedFiles();
    } finally {
      setIsSyncing(false);
      setSyncProgress(0);
    }
  };

  const deletePendingFile = async (fileId: string) => {
    const updated = pendingUploads.filter(f => f.id !== fileId);
    setPendingUploads(updated);
    await setCachedData('pending_file_uploads', updated);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const pendingSize = pendingUploads.reduce((sum, f) => sum + (f.compressedSize || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{pendingUploads.length}</p>
            <p className="text-xs sm:text-sm text-gray-600">Fichiers en attente</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{syncedFiles.length}</p>
            <p className="text-xs sm:text-sm text-gray-600">Fichiers synchronisés</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold truncate">{formatFileSize(pendingSize)}</p>
            <p className="text-xs sm:text-sm text-gray-600">À synchroniser</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {pendingUploads.length > 0 && (
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base break-words">
                    {pendingUploads.length} fichier(s) en attente de synchronisation
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground break-words">
                    {isOnline 
                      ? 'Cliquez sur synchroniser pour uploader vos fichiers'
                      : 'Seront synchronisés automatiquement quand vous serez en ligne'
                    }
                  </p>
                </div>
              </div>
              <Button
                onClick={syncPendingFiles}
                disabled={isSyncing || !isOnline}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Synchroniser maintenant
                  </>
                )}
              </Button>
            </div>
            
            {isSyncing && (
              <div className="mt-4 space-y-2">
                <Progress value={syncProgress} />
                <p className="text-xs text-center text-muted-foreground">
                  {Math.round(syncProgress)}% complété
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglets */}
      <Tabs defaultValue="pending" className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="w-full sm:w-auto inline-flex">
            <TabsTrigger value="pending" className="text-xs sm:text-sm">
              En attente ({pendingUploads.length})
            </TabsTrigger>
            <TabsTrigger value="synced" className="text-xs sm:text-sm">
              Synchronisés ({syncedFiles.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="space-y-3">
          {pendingUploads.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-green-600" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  Aucun fichier en attente de synchronisation
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingUploads.map((file) => (
              <Card key={file.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(file.fileType)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {file.fileName}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs text-muted-foreground">
                          <span>{formatFileSize(file.fileSize)}</span>
                          {file.compressedSize && (
                            <>
                              <span>→</span>
                              <span className="text-green-600">
                                {formatFileSize(file.compressedSize)}
                              </span>
                            </>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {file.module}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletePendingFile(file.id)}
                      className="h-7 w-7 p-0 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="synced" className="space-y-3">
          {syncedFiles.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  Aucun fichier synchronisé
                </p>
              </CardContent>
            </Card>
          ) : (
            syncedFiles.map((file) => (
              <Card key={file.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(file.file_type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {file.file_name}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          {file.compressed_size && file.compressed_size !== file.file_size && (
                            <>
                              <span>→</span>
                              <span className="text-green-600">
                                {formatFileSize(file.compressed_size)}
                              </span>
                            </>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {file.module}
                          </Badge>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(file.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OfflineFilesSync;
