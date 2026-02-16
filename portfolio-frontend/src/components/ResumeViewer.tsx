/**
 * ResumeViewer - View resume in a modal first, then optionally download.
 * Use as wrapper around the button/link that should open the viewer.
 */
import { useEffect, useState } from 'react';
import { Download, ExternalLink, X } from 'lucide-react';
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
const RESUME_URL = `${import.meta.env.BASE_URL}${RESUME_FILENAME}`;
// Fit to viewer width so no horizontal scroll; zoom for readability
const RESUME_VIEW_HASH = '#view=FitW&zoom=120';

interface ResumeViewerProps {
  children: React.ReactNode;
  /** Optional class for the trigger wrapper */
  className?: string;
}

export function ResumeViewer({ children, className }: ResumeViewerProps) {
  const [open, setOpen] = useState(false);

  // Only lock body scroll while the dialog is open so page scroll works when closed
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
      <ResumeDialogContent />
    </Dialog>
  );
}

function ResumeDialogContent() {

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
        <iframe
          src={`${RESUME_URL}${RESUME_VIEW_HASH}`}
          title="Resume PDF preview"
          className="h-full min-h-[70vh] w-full flex-1 border-0"
        />
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
