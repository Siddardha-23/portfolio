import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Layers } from 'lucide-react';

interface Layer {
  name: string;
  color: string;
  components: string[];
}

interface ArchitectureDiagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  layers?: Layer[];
}

export function ArchitectureDiagramModal({
  open,
  onOpenChange,
  title,
  layers = [],
}: ArchitectureDiagramModalProps) {
  if (!layers.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border border-border bg-card">
        <DialogTitle className="sr-only">{title} — Architecture</DialogTitle>
        <DialogDescription className="sr-only">Architecture diagram with layers and components.</DialogDescription>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
          </div>

          <div className="space-y-4">
            {layers.map((layer, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border overflow-hidden"
                style={{ borderLeftWidth: '4px', borderLeftColor: layer.color }}
              >
                <div
                  className="px-4 py-2 text-sm font-semibold text-foreground"
                  style={{ background: `${layer.color}15` }}
                >
                  {layer.name}
                </div>
                <ul className="px-4 py-3 bg-muted/30 text-sm text-muted-foreground space-y-1">
                  {layer.components.map((comp, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: layer.color }} />
                      {comp}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
