import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Github, Linkedin, Cloud, Server, Layers, Shield, Zap, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PERSONAL_INFO, TECH_STACK_CATEGORIES, ROLES } from '@/lib/constants';
import { ResumeViewer } from '@/components/ResumeViewer';

interface RecruiterQuickViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecruiterQuickView({ open, onOpenChange }: RecruiterQuickViewProps) {
  const cloudSkills = TECH_STACK_CATEGORIES.cloud.join(' · ');
  const topRoles = ROLES.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border border-border bg-card">
        <DialogTitle className="sr-only">60-Second Technical Summary</DialogTitle>
        <DialogDescription className="sr-only">Quick recruiter summary: headline, skills, and resume.</DialogDescription>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">60-Second Technical Summary</h2>
              <p className="text-sm text-muted-foreground">Cloud & DevOps · Architecture-focused</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Headline */}
          <div className="rounded-xl bg-secondary/50 border border-border p-4">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {PERSONAL_INFO.headline}
            </p>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {PERSONAL_INFO.summaryShort}
            </p>
          </div>

          {/* Target roles */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Target Roles</h3>
            <div className="flex flex-wrap gap-2">
              {topRoles.map((role, i) => (
                <Badge key={i} variant="outline" className="text-xs border-primary/40 text-primary">
                  {role}
                </Badge>
              ))}
            </div>
          </div>

          {/* Skills snapshot */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tech Stack</h3>
            <div className="flex flex-wrap gap-2 text-xs text-foreground/90">
              <span><strong>Cloud:</strong> {cloudSkills}</span>
              <span className="text-muted-foreground">|</span>
              <span><strong>IaC:</strong> {TECH_STACK_CATEGORIES.infrastructureAsCode.join(', ')}</span>
              <span className="text-muted-foreground">|</span>
              <span><strong>Tools:</strong> Docker, Git, Linux</span>
            </div>
          </div>

          {/* Mini architecture icons */}
          <div className="flex items-center justify-center gap-6 py-2 text-muted-foreground">
            <div className="flex flex-col items-center gap-1">
              <Cloud className="h-8 w-8 text-primary/80" />
              <span className="text-[10px]">Multi-Cloud</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex flex-col items-center gap-1">
              <Server className="h-8 w-8 text-primary/80" />
              <span className="text-[10px]">IaC</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex flex-col items-center gap-1">
              <Layers className="h-8 w-8 text-primary/80" />
              <span className="text-[10px]">Containers</span>
            </div>
            <ArrowRight className="h-4 w-4" />
            <div className="flex flex-col items-center gap-1">
              <Shield className="h-8 w-8 text-primary/80" />
              <span className="text-[10px]">Security</span>
            </div>
          </div>

          {/* CTA row */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <ResumeViewer>
              <Button size="sm" className="btn-premium flex-1 min-w-[140px]">
                <Download className="h-4 w-4 mr-2" />
                Resume
              </Button>
            </ResumeViewer>
            <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" asChild>
              <a href={`https://${PERSONAL_INFO.github}`} target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
            <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" asChild>
              <a href={`https://${PERSONAL_INFO.linkedin}`} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
