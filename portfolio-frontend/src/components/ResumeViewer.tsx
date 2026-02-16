/**
 * ResumeViewer - View resume in a modal first, then optionally download.
 * Loads PDF via fetch + blob URL so preview works regardless of X-Frame-Options.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Actual filename in public/; UI shows "Resume", download keeps this name
const RESUME_FILENAME = 'Harshith_Manne_Cloud_DevOps_Engineer_Resume.pdf';
const RESUME_URL = `/${RESUME_FILENAME}`;
const RESUME_VIEW_HASH = '#view=FitW&zoom=120';

interface ResumeViewerProps {
  children: React.ReactNode;
  className?: string;
}

export function ResumeViewer({ children, className }: ResumeViewerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className={className}>
        {children}
      </DialogTrigger>
      <ResumeDialogContent open={open} />
    </Dialog>
  );
}

function ResumeDialogContent({ open: isOpen }: { open: boolean }) {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // Fetch PDF and show in iframe via blob URL (bypasses X-Frame-Options)
  useEffect(() => {
    if (!isOpen) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setIframeSrc(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(RESUME_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Resume failed to load');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setIframeSrc(url + RESUME_VIEW_HASH);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [isOpen]);

  return (
    <DialogContent
      className="flex h-[90vh] max-h-[90vh] w-[min(3200px,99.5vw)] max-w-[99.5vw] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
    >
      <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 pr-14 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <DialogTitle className="text-base font-semibold">Resume</DialogTitle>
          <DialogDescription className="sr-only">View or download Harshith&apos;s resume as PDF. If the preview does not load, use Open in new tab or Download.</DialogDescription>
          <span className="hidden text-xs text-muted-foreground sm:inline">— click outside to close</span>
        </div>
        <div className="flex items-center gap-2">
          <DialogClose asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogClose>
          <a href={RESUME_URL} download={RESUME_FILENAME} className="inline-flex shrink-0">
            <Button size="sm" variant="default" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </a>
        </div>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-xl bg-muted/20">
        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="text-sm">Loading resume…</span>
          </div>
        )}
        {error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
            <span className="text-sm">Preview couldn&apos;t be loaded. Use the buttons below.</span>
          </div>
        )}
        {iframeSrc && !loading && !error && (
          <iframe
            src={iframeSrc}
            title="Resume PDF preview"
            className="h-full min-h-[70vh] w-full flex-1 border-0"
          />
        )}
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>If the preview doesn&apos;t load,</span>
          <a href={RESUME_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 hover:no-underline">
            <ExternalLink className="h-3 w-3" />
            open in new tab
          </a>
          <span>or use Download above.</span>
        </div>
      </div>
    </DialogContent>
  );
}
