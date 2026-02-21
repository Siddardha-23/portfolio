import { Globe, MapPin } from 'lucide-react';

export function VisitorMapTrigger({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            aria-label="View global visitor map"
            className="flex items-center gap-2 w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all cursor-pointer group"
        >
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md group-hover:shadow-lg transition-shadow">
                <Globe className="h-4 w-4 text-white" />
            </div>
            <div className="text-left flex-1">
                <div className="text-sm font-medium text-foreground">Global Reach</div>
                <div className="text-[10px] text-muted-foreground">View visitor map</div>
            </div>
            <MapPin className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
}
