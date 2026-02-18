/**
 * ResumeViewer - View resume in a modal first, then optionally download.
 * Loads PDF via fetch + blob URL so preview works regardless of X-Frame-Options.
 * On mobile, skips the iframe (most mobile browsers can't render PDFs inline)
 * and shows a direct open/download experience instead.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Loader2, X } from 'lucide-react';
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
const RESUME_PATH = `/${RESUME_FILENAME}`;
const RESUME_VIEW_HASH = '#view=FitW&zoom=120';

function getResumeUrl(): string {
  if (typeof window === 'undefined') return RESUME_PATH;
  return window.location.origin + RESUME_PATH;
}

/** Detect mobile/tablet where inline PDF iframes typically show a blank page */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

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
  const [mobile] = useState(isMobileDevice);

  // Fetch PDF and show in iframe via blob URL (desktop only)
  useEffect(() => {
    if (!isOpen || mobile) {
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

    fetch(getResumeUrl())
      .then((res) => {
        if (!res.ok) throw new Error('Resume failed to load');
        const ct = res.headers.get('Content-Type') || '';
        if (!ct.toLowerCase().includes('application/pdf')) throw new Error('Not a PDF (wrong Content-Type)');
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
  }, [isOpen, mobile]);

  return (
    <DialogContent
      className={`flex flex-col gap-0 overflow-hidden p-0 sm:rounded-xl ${
        mobile
          ? 'h-auto w-[92vw] max-w-md'
          : 'h-[90vh] max-h-[90vh] w-[min(3200px,99.5vw)] max-w-[99.5vw]'
      }`}
    >
      <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 pr-14 sm:rounded-t-xl">
        <div className="flex items-center gap-2">
          <DialogTitle className="text-base font-semibold">Resume</DialogTitle>
          <DialogDescription className="sr-only">View or download Harshith&apos;s resume as PDF. If the preview does not load, use Open in new tab or Download.</DialogDescription>
          {!mobile && <span className="hidden text-xs text-muted-foreground sm:inline">— click outside to close</span>}
        </div>
        <div className="flex items-center gap-2">
          <DialogClose asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <X className="h-4 w-4" />
              Close
            </Button>
          </DialogClose>
          <a href={RESUME_PATH} download={RESUME_FILENAME} className="inline-flex shrink-0">
            <Button size="sm" variant="default" className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </a>
        </div>
      </DialogHeader>

      {/* Mobile: show action buttons instead of iframe (mobile browsers can't render inline PDFs) */}
      {mobile ? (
        <div className="flex flex-col items-center gap-4 px-6 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Tap below to view or download the resume.
          </p>
          <div className="flex w-full flex-col gap-3">
            <a href={getResumeUrl()} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full gap-2" size="lg">
                <ExternalLink className="h-4 w-4" />
                Open Resume
              </Button>
            </a>
            <a href={RESUME_PATH} download={RESUME_FILENAME} className="w-full">
              <Button variant="outline" className="w-full gap-2" size="lg">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </a>
          </div>
        </div>
      ) : (
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
            <a href={getResumeUrl()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 hover:no-underline">
              <ExternalLink className="h-3 w-3" />
              open in new tab
            </a>
            <span>or use Download above.</span>
          </div>
        </div>
      )}
    </DialogContent>
  );
}
