
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useProductionCycles } from '@/hooks/useProductionCycles';

const ProductionCycles = () => {
  const { cycles, loading, createCycle, deleteCycle: deleteCycleFromDB } = useProductionCycles();

  const [newCycle, setNewCycle] = useState({
    bassin: '',
    espece: '',
    dateDebut: '',
    duree: '6',
    nbPoissons: '',
    poidsInitial: ''
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const bassinsDisponibles = [
    'Bassin A1', 'Bassin A2', 'Bassin B1', 'Bassin B2', 'Bassin C1', 'Bassin C2',
    'Étang Nord', 'Étang Sud', 'Cage Flottante 1', 'Cage Flottante 2'
  ];

  const especesDisponibles = [
    'Carpe commune', 'Tilapia', 'Truite arc-en-ciel', 'Saumon', 'Bar', 'Dorade',
    'Brochet', 'Perche', 'Sandre', 'Silure'
  ];

  const addCycle = async () => {
    const dateDebut = new Date(newCycle.dateDebut);
    const datePrevue = new Date(dateDebut);
    datePrevue.setMonth(datePrevue.getMonth() + parseInt(newCycle.duree));

    await createCycle({
      unit_id: newCycle.bassin,
      unit_name: newCycle.bassin,
      unit_type: 'bassin',
      name: `Cycle ${newCycle.espece}`,
      species: newCycle.espece,
      start_date: newCycle.dateDebut,
      end_date: datePrevue.toISOString().split('T')[0],
      status: 'planned',
      current_quantity: 0,
      target_quantity: parseInt(newCycle.nbPoissons),
      initial_quantity: parseInt(newCycle.nbPoissons),
      fingerlings_count: parseInt(newCycle.nbPoissons),
      duration_months: parseInt(newCycle.duree)
    });

    setNewCycle({
      bassin: '',
      espece: '',
      dateDebut: '',
      duree: '6',
      nbPoissons: '',
      poidsInitial: ''
    });
    setIsDialogOpen(false);
  };

  const handleDeleteCycle = async (id: string) => {
    await deleteCycleFromDB(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Cycles de Production</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-aqua hover:bg-gradient-aqua/90">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Cycle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer un nouveau cycle de production</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="bassin">Infrastructure</Label>
                <Select onValueChange={(value) => setNewCycle({...newCycle, bassin: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une infrastructure" />
                  </SelectTrigger>
                  <SelectContent>
                    {bassinsDisponibles.map((bassin) => (
                      <SelectItem key={bassin} value={bassin}>{bassin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="espece">Espèce</Label>
                <Select onValueChange={(value) => setNewCycle({...newCycle, espece: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une espèce" />
                  </SelectTrigger>
                  <SelectContent>
                    {especesDisponibles.map((espece) => (
                      <SelectItem key={espece} value={espece}>{espece}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateDebut">Date de début</Label>
                  <Input
                    id="dateDebut"
                    type="date"
                    value={newCycle.dateDebut}
                    onChange={(e) => setNewCycle({...newCycle, dateDebut: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="duree">Durée (mois)</Label>
                  <Select value={newCycle.duree} onValueChange={(value) => setNewCycle({...newCycle, duree: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 mois</SelectItem>
                      <SelectItem value="6">6 mois</SelectItem>
                      <SelectItem value="9">9 mois</SelectItem>
                      <SelectItem value="12">12 mois</SelectItem>
                      <SelectItem value="18">18 mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nbPoissons">Nombre de poissons</Label>
                  <Input
                    id="nbPoissons"
                    type="number"
                    placeholder="1000"
                    value={newCycle.nbPoissons}
                    onChange={(e) => setNewCycle({...newCycle, nbPoissons: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="poidsInitial">Poids initial (kg)</Label>
                  <Input
                    id="poidsInitial"
                    type="number"
                    placeholder="500"
                    value={newCycle.poidsInitial}
                    onChange={(e) => setNewCycle({...newCycle, poidsInitial: e.target.value})}
                  />
                </div>
              </div>
              
              <Button onClick={addCycle} className="w-full bg-gradient-aqua">
                Créer le cycle
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Chargement...</span>
          </CardContent>
        </Card>
      ) : cycles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Aucun cycle de production. Créez-en un pour commencer.
          </CardContent>
        </Card>
      ) : (
        cycles.map((cycle) => {
          const progression = cycle.end_date && cycle.start_date
            ? (() => {
                const now = new Date().getTime();
                const start = new Date(cycle.start_date).getTime();
                const end = new Date(cycle.end_date).getTime();
                const totalDuration = end - start;
                const elapsed = now - start;
                return Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
              })()
            : 0;
          
          const statusLabel = {
            'active': 'En cours',
            'planned': 'Planifié',
            'completed': 'Terminé',
            'cancelled': 'Annulé'
          }[cycle.status] || cycle.status;

          return (
            <Card key={cycle.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{cycle.unit_name}</h3>
                    <p className="text-sm text-muted-foreground">{cycle.species || 'Non spécifié'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      cycle.status === 'active' ? 'default' :
                      cycle.status === 'planned' ? 'outline' : 
                      'secondary'
                    }>
                      {statusLabel}
                    </Badge>
                    <Button size="sm" variant="outline">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="text-red-600"
                      onClick={() => handleDeleteCycle(cycle.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Quantité actuelle</p>
                    <p className="font-semibold">{cycle.current_quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quantité cible</p>
                    <p className="font-semibold">{cycle.target_quantity.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Durée</p>
                    <p className="font-semibold">{cycle.duration_months || 'N/A'} mois</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Progression</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(Math.max(progression, 0), 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{Math.min(Math.max(progression, 0), 100)}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                  <div>
                    <span>Début: </span>
                    <span className="font-medium">
                      {new Date(cycle.start_date).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  {cycle.end_date && (
                    <div>
                      <span>Fin prévue: </span>
                      <span className="font-medium">
                        {new Date(cycle.end_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default ProductionCycles;
