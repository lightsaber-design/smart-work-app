import { Trash2 } from "lucide-react";

interface SettingsViewProps {
  onClearAll: () => void;
  entryCount: number;
}

export function SettingsView({ onClearAll, entryCount }: SettingsViewProps) {
  return (
    <div className="px-4 space-y-4 pb-24">
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Datos
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {entryCount} registros almacenados en este dispositivo
        </p>
        <button
          onClick={() => {
            if (confirm("¿Borrar todos los registros?")) {
              onClearAll();
            }
          }}
          className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
        >
          <Trash2 className="w-4 h-4" />
          Borrar todos los registros
        </button>
      </div>
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Acerca de
        </h3>
        <p className="text-sm text-muted-foreground">
          Gestión de Horas v1.0
        </p>
      </div>
    </div>
  );
}
