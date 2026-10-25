import { CartesianGrid, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

/** Empty axes, never simulated measurements or a zero-valued series. */
export function EmptyChart({ height = 180 }: { height?: number }) {
  return (
    <div className="relative min-w-0" role="img" aria-label="Graphique sans données enregistrées">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={[]}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis tick={false} stroke="hsl(var(--muted-foreground))" />
          <YAxis tick={false} stroke="hsl(var(--muted-foreground))" width={32} />
        </LineChart>
      </ResponsiveContainer>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Aucune donnée enregistrée</span>
    </div>
  );
}