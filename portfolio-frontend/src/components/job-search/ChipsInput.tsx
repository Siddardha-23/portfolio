import { useRef, useState } from 'react';
import { X, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChipsInputProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helperText?: string;
  maxItems?: number;
  defaultValues?: string[];
  suggestionValues?: string[];
  accentClass?: string;
  emptyState?: string;
  searchable?: boolean;
}

export function ChipsInput({
  values,
  onChange,
  placeholder = 'Type and press Enter…',
  helperText,
  maxItems,
  defaultValues,
  suggestionValues,
  accentClass = 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  emptyState = 'No items yet — start typing or paste a comma-separated list.',
  searchable = true,
}: ChipsInputProps) {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

  const addItems = (raw: string) => {
    const parts = raw
      .split(/[\n,]/)
      .map(norm)
      .filter(Boolean);
    if (!parts.length) return;
    const dedup = new Set(values.map((v) => v.toLowerCase()));
    const next = [...values];
    for (const p of parts) {
      if (dedup.has(p.toLowerCase())) continue;
      if (maxItems && next.length >= maxItems) break;
      next.push(p);
      dedup.add(p.toLowerCase());
    }
    onChange(next);
    setDraft('');
  };

  const removeItem = (item: string) => {
    onChange(values.filter((v) => v !== item));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) addItems(draft);
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const txt = e.clipboardData.getData('text');
    if (/[,\n]/.test(txt)) {
      e.preventDefault();
      addItems(txt);
    }
  };

  const filtered = filter
    ? values.filter((v) => v.toLowerCase().includes(filter.toLowerCase()))
    : values;

  const newSuggestions = (suggestionValues || []).filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={placeholder}
            className="pr-10 border-gray-200 bg-white/80 dark:border-white/10 dark:bg-gray-950/60 focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
          />
          {draft.trim() && (
            <button
              type="button"
              onClick={() => addItems(draft)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-purple-500/15 p-1 text-purple-600 transition hover:bg-purple-500/25 dark:text-purple-300"
              aria-label="Add"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {defaultValues && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(defaultValues)}
            className="gap-1 text-[11px] border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-300 hover:border-purple-500/30"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
        {newSuggestions.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addItems(newSuggestions.join(','))}
            className="gap-1 text-[11px] text-purple-600 dark:text-purple-300"
          >
            <Sparkles className="h-3 w-3" />
            Add {newSuggestions.length} suggested
          </Button>
        )}
        <Badge variant="outline" className="ml-auto text-[10px]">
          {values.length}{maxItems ? ` / ${maxItems}` : ''}
        </Badge>
      </div>

      {helperText && (
        <p className="text-[10px] text-muted-foreground">{helperText}</p>
      )}

      {searchable && values.length > 8 && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${values.length} items…`}
          className="h-8 text-xs border-gray-200 bg-white/80 dark:border-white/10 dark:bg-gray-950/60 focus-visible:border-purple-500/40 focus-visible:ring-purple-500/40"
        />
      )}

      <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-200/80 dark:border-white/[0.08] bg-gray-50/50 dark:bg-gray-900/40 p-2 min-h-[3.5rem]">
        {filtered.length === 0 ? (
          <p className="m-auto text-xs italic text-muted-foreground">{emptyState}</p>
        ) : (
          filtered.map((v) => (
            <span
              key={v}
              className={cn(
                'group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition',
                accentClass,
              )}
            >
              {v}
              <button
                type="button"
                onClick={() => removeItem(v)}
                className="rounded-full p-0.5 opacity-50 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                aria-label={`Remove ${v}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
