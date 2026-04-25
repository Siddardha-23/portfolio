import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, Play, X, Loader2, CheckCircle2, ChevronRight, Hash, 
  Github, Cloud, Server, Globe, ExternalLink
} from 'lucide-react';
import { apiService } from '@/lib/api';

interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
}

interface Job {
  name: string;
  status: string;
  conclusion: string | null;
  steps: JobStep[];
}

interface SandboxStatus {
  status: string;
  conclusion: string | null;
  run_id: number;
  html_url?: string;
  jobs: Job[];
}

interface SandboxDeployerProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  { id: 'text-primary', label: 'Primary', hex: 'bg-primary' },
  { id: 'text-violet-500', label: 'Violet', hex: 'bg-violet-500' },
  { id: 'text-emerald-500', label: 'Emerald', hex: 'bg-emerald-500' },
  { id: 'text-rose-500', label: 'Rose', hex: 'bg-rose-500' },
  { id: 'text-amber-500', label: 'Amber', hex: 'bg-amber-500' },
  { id: 'text-cyan-500', label: 'Cyan', hex: 'bg-cyan-500' },
];

export default function SandboxDeployer({ isOpen, onClose }: SandboxDeployerProps) {
  const [message, setMessage] = useState('');
  const [color, setColor] = useState(COLORS[0].id);
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [runStatus, setRunStatus] = useState<SandboxStatus | null>(null);
  
  const [latestMessage, setLatestMessage] = useState<{message: string, color: string, timestamp: string} | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);

  // Poll for the latest deployed message on mount
  useEffect(() => {
    if (isOpen) {
      fetchLatest();
    }
  }, [isOpen]);

  // Prevent background scrolling while modal is open.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Handle auto-scroll in terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [runStatus]);

  const fetchLatest = async () => {
    try {
      const res = await (apiService as any).getLatestSandboxMessage();
      if (res.data && res.data.success) {
        setLatestMessage(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch latest deployed message:", err);
    } finally {
      setIsLoadingLatest(false);
    }
  };

  // Improved polling logic to avoid React stale closures
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const pollStatus = async () => {
      try {
        const res = await (apiService as any).getSandboxStatus();
        if (res.data && res.data.success) {
          const data = res.data.data as SandboxStatus;
          setRunStatus(data);
          
          // If it's completed, stop polling and refresh the board
          if (data.status === 'completed') {
            setIsDeploying(false);
            await fetchLatest();
            return;
          }
        }
      } catch (err) {
        console.error("Failed to poll status:", err);
      }
      
      if (isDeploying) {
        timeoutId = setTimeout(pollStatus, 2000);
      }
    };

    if (isDeploying) {
      // Delay first poll slightly to allow GitHub Actions to register the run
      timeoutId = setTimeout(pollStatus, 3000);
    }

    return () => clearTimeout(timeoutId);
  }, [isDeploying]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.length > 50) return;
    
    setIsDeploying(true);
    setRunStatus(null);
    
    try {
      const res = await (apiService as any).deploySandboxMessage(message, color);
      if (!res.data || !res.data.success) {
        setIsDeploying(false);
        alert("Failed to trigger deployment.");
      }
    } catch (err) {
      setIsDeploying(false);
      console.error(err);
      alert("Error triggering deployment.");
    }
  };

  // Build the terminal log lines from the jobs data
  const terminalLines: React.ReactNode[] = [];
  if (runStatus?.status === 'queued') {
    terminalLines.push(<div key="queued" className="text-yellow-400">Waiting for runner to pick up job...</div>);
  }
  
  if (runStatus?.jobs) {
    runStatus.jobs.forEach((job, jIdx) => {
      terminalLines.push(
        <div key={`job-${jIdx}`} className="mt-2 mb-1 text-primary font-bold">
          {job.name} [{job.status}]
        </div>
      );
      job.steps.forEach((step, sIdx) => {
        let icon = <Loader2 className="h-3 w-3 animate-spin inline mr-2 text-blue-400" />;
        let colorClass = "text-gray-300";
        if (step.status === 'completed') {
          if (step.conclusion === 'success') {
            icon = <CheckCircle2 className="h-3 w-3 inline mr-2 text-green-500" />;
            colorClass = "text-green-400";
          } else if (step.conclusion === 'skipped') {
            icon = <ChevronRight className="h-3 w-3 inline mr-2 text-gray-500" />;
            colorClass = "text-gray-500";
          } else {
            icon = <X className="h-3 w-3 inline mr-2 text-red-500" />;
            colorClass = "text-red-400";
          }
        }
        
        terminalLines.push(
          <div key={`step-${jIdx}-${sIdx}`} className={`flex items-start text-xs sm:text-sm ${colorClass}`}>
            <span className="mt-0.5 w-5 shrink-0">{icon}</span>
            <span>{step.name}</span>
          </div>
        );
      });
    });
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-secondary/30 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Terminal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Interactive CI/CD Sandbox
                </h3>
                <p className="text-xs text-muted-foreground">Trigger a real GitHub Action workflow</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              disabled={isDeploying}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Form & Architecture */}
            <div className="space-y-6">
              
              {/* Graffiti Wall Result */}
              <div className="bg-background/50 rounded-xl border border-border p-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] uppercase font-bold text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Live Production
                </div>
                <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Guestbook / Graffiti Wall
                </h4>
                
                {isLoadingLatest ? (
                  <div className="h-24 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  </div>
                ) : latestMessage ? (
                  <div className="text-center py-4">
                    <motion.div 
                      key={latestMessage.timestamp}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring" }}
                      className={`text-2xl sm:text-3xl font-bold ${latestMessage.color} drop-shadow-lg`}
                    >
                      "{latestMessage.message}"
                    </motion.div>
                    <div className="text-xs text-muted-foreground mt-4">
                      Deployed on {new Date(latestMessage.timestamp).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground italic">
                    No messages deployed yet. Be the first!
                  </div>
                )}
              </div>

              {/* Deployment Form */}
              <form onSubmit={handleDeploy} className="bg-secondary/20 rounded-xl border border-border p-6">
                <h4 className="text-sm font-medium mb-4">Deploy a New Message</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Message (max 50 chars)</label>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={isDeploying}
                      maxLength={50}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                      placeholder="E.g., Hire me!"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Brand Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={isDeploying}
                          onClick={() => setColor(c.id)}
                          className={`w-8 h-8 rounded-full ${c.hex} transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-foreground ${color === c.id ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : ''}`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isDeploying || !message.trim()}
                    className="w-full py-3 px-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Pipeline Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5 group-hover:scale-110 transition-transform" fill="currentColor" />
                        Trigger CI/CD Pipeline
                      </>
                    )}
                  </button>
                </div>
              </form>
              
            </div>

            {/* Right Column: Terminal UI */}
            <div className="flex flex-col rounded-xl overflow-hidden border border-border shadow-xl">
              {/* Terminal Header */}
              <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 mr-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-2 shrink-0">
                    <Github className="h-4 w-4" /> sandbox.yml
                  </div>
                </div>
                {runStatus?.html_url && (
                  <a href={runStatus.html_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors" title="View the real pipeline run directly on GitHub">
                    View Live on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              
              {/* Terminal Body */}
              <div 
                ref={terminalRef}
                className="flex-1 bg-[#0d1117] p-4 font-mono text-sm overflow-y-auto w-full min-h-[300px]"
              >
                {!isDeploying && !runStatus ? (
                  <div className="text-slate-500 h-full flex flex-col items-center justify-center space-y-4">
                    <Terminal className="h-12 w-12 opacity-50" />
                    <p>Ready to deploy. Awaiting trigger...</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-blue-400 mb-4">$ gh workflow run sandbox.yml -f message="{message}"</div>
                    {terminalLines}
                    {isDeploying && (!runStatus || runStatus.status !== 'completed') && (
                      <div className="text-slate-500 mt-2 animate-pulse">_</div>
                    )}
                    {runStatus?.status === 'completed' && (
                      <div className="mt-4 text-green-400 font-bold">
                        Pipeline completed successfully.
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Architecture diagram mapping */}
              <div className="bg-slate-800 p-3 grid grid-cols-4 gap-2 text-center text-xs text-slate-300">
                <div className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${runStatus && !['completed'].includes(runStatus.status) ? 'bg-blue-500/20 text-blue-400' : ''}`}>
                  <Github className="h-4 w-4" /> Action
                </div>
                <div className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${runStatus?.jobs?.some(j => j.name.includes('Build') && j.status === 'in_progress') ? 'bg-yellow-500/20 text-yellow-500' : ''}`}>
                  <Server className="h-4 w-4" /> Build
                </div>
                <div className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${runStatus?.jobs?.some(j => j.name.includes('Deploy') && j.status === 'in_progress') ? 'bg-orange-500/20 text-orange-500' : ''}`}>
                  <Cloud className="h-4 w-4" /> S3
                </div>
                <div className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${runStatus?.status === 'completed' ? 'bg-green-500/20 text-green-400' : ''}`}>
                  <Globe className="h-4 w-4" /> Edge
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
