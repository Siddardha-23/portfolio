/**
 * RecruiterMatch – Paste a JD → get instant radar chart + match %
 *
 * Client-side keyword extraction + matching against the user's actual skills.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Target, Brain, Clipboard, Sparkles, CheckCircle2,
  AlertTriangle, ArrowRight, RotateCcw, Loader2,
} from 'lucide-react';

// ── Skill categories with keywords ──
interface SkillCategory {
  name: string;
  color: string;
  skills: { keyword: string; aliases: string[] }[];
}

const SKILL_CATEGORIES: SkillCategory[] = [
  {
    name: 'Cloud & AWS',
    color: '#f59e0b',
    skills: [
      { keyword: 'AWS', aliases: ['amazon web services', 'aws cloud', 'amazon cloud'] },
      { keyword: 'EC2', aliases: ['elastic compute'] },
      { keyword: 'S3', aliases: ['simple storage', 's3 bucket'] },
      { keyword: 'Lambda', aliases: ['aws lambda', 'serverless'] },
      { keyword: 'CloudFront', aliases: ['cdn', 'cloudfront', 'content delivery'] },
      { keyword: 'VPC', aliases: ['virtual private cloud', 'networking'] },
      { keyword: 'ECS', aliases: ['elastic container service', 'fargate'] },
      { keyword: 'CloudWatch', aliases: ['monitoring', 'cloud watch', 'logging'] },
      { keyword: 'CloudFormation', aliases: ['cfn', 'cloud formation'] },
      { keyword: 'Route 53', aliases: ['route53', 'dns'] },
      { keyword: 'API Gateway', aliases: ['api gateway', 'apigw'] },
      { keyword: 'IAM', aliases: ['identity access management', 'iam roles', 'iam policies'] },
      { keyword: 'CloudTrail', aliases: ['audit', 'cloud trail'] },
      { keyword: 'CodePipeline', aliases: ['code pipeline', 'codebuild', 'codecommit'] },
      { keyword: 'ACM', aliases: ['certificate manager', 'ssl', 'tls'] },
      { keyword: 'KMS', aliases: ['key management'] },
      { keyword: 'SSM', aliases: ['systems manager', 'parameter store'] },
      { keyword: 'X-Ray', aliases: ['xray', 'tracing', 'distributed tracing'] },
      { keyword: 'ECR', aliases: ['elastic container registry'] },
      { keyword: 'RDS', aliases: ['relational database service'] },
    ],
  },
  {
    name: 'DevOps & IaC',
    color: '#8b5cf6',
    skills: [
      { keyword: 'Terraform', aliases: ['tf', 'hashicorp terraform', 'iac'] },
      { keyword: 'Docker', aliases: ['container', 'containerization', 'dockerfile'] },
      { keyword: 'CI/CD', aliases: ['cicd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'pipeline'] },
      { keyword: 'Git', aliases: ['github', 'git actions', 'version control'] },
      { keyword: 'GitHub Actions', aliases: ['gh actions', 'github workflow'] },
      { keyword: 'Kubernetes', aliases: ['k8s', 'kubectl', 'helm'] },
      { keyword: 'Nginx', aliases: ['reverse proxy', 'web server'] },
      { keyword: 'Linux', aliases: ['unix', 'centos', 'ubuntu', 'rhel'] },
      { keyword: 'Bash', aliases: ['shell', 'shell scripting', 'bash scripting'] },
      { keyword: 'DevOps', aliases: ['dev ops', 'sre', 'site reliability'] },
      { keyword: 'Infrastructure as Code', aliases: ['iac', 'infra as code'] },
      { keyword: 'Ansible', aliases: ['ansible playbook'] },
    ],
  },
  {
    name: 'Programming',
    color: '#3b82f6',
    skills: [
      { keyword: 'Python', aliases: ['python3', 'py'] },
      { keyword: 'JavaScript', aliases: ['js', 'ecmascript', 'es6'] },
      { keyword: 'TypeScript', aliases: ['ts'] },
      { keyword: 'Java', aliases: ['jdk', 'jvm'] },
      { keyword: 'SQL', aliases: ['mysql', 'postgresql', 'postgres', 'database query'] },
      { keyword: 'HTML', aliases: ['html5'] },
      { keyword: 'CSS', aliases: ['css3', 'tailwind', 'styling'] },
      { keyword: 'React', aliases: ['reactjs', 'react.js', 'react native'] },
      { keyword: 'Flask', aliases: ['flask api', 'python flask'] },
      { keyword: 'Spring Boot', aliases: ['spring', 'spring framework'] },
      { keyword: 'REST API', aliases: ['restful', 'api development', 'api design'] },
    ],
  },
  {
    name: 'Security',
    color: '#ef4444',
    skills: [
      { keyword: 'Security', aliases: ['cybersecurity', 'infosec', 'information security'] },
      { keyword: 'IAM', aliases: ['access management', 'identity'] },
      { keyword: 'Compliance', aliases: ['nist', 'iso 27001', 'soc2', 'gdpr'] },
      { keyword: 'Encryption', aliases: ['kms', 'tls', 'ssl', 'encryption at rest'] },
      { keyword: 'VPC Security', aliases: ['security groups', 'nacl', 'firewall'] },
      { keyword: 'WAF', aliases: ['web application firewall'] },
      { keyword: 'Penetration Testing', aliases: ['pen test', 'vulnerability assessment'] },
      { keyword: 'HSTS', aliases: ['transport security'] },
      { keyword: 'CSP', aliases: ['content security policy'] },
    ],
  },
  {
    name: 'Data & DBs',
    color: '#10b981',
    skills: [
      { keyword: 'MongoDB', aliases: ['mongo', 'nosql', 'mongodb atlas'] },
      { keyword: 'PostgreSQL', aliases: ['postgres', 'pg'] },
      { keyword: 'DynamoDB', aliases: ['dynamo'] },
      { keyword: 'RDS', aliases: ['relational database'] },
      { keyword: 'Redis', aliases: ['caching', 'in-memory'] },
      { keyword: 'Data Modeling', aliases: ['schema design', 'database design'] },
    ],
  },
  {
    name: 'Soft Skills',
    color: '#ec4899',
    skills: [
      { keyword: 'Agile', aliases: ['scrum', 'kanban', 'sprint'] },
      { keyword: 'Communication', aliases: ['documentation', 'technical writing'] },
      { keyword: 'Problem Solving', aliases: ['troubleshooting', 'debugging'] },
      { keyword: 'Team', aliases: ['collaboration', 'teamwork', 'cross-functional'] },
      { keyword: 'Leadership', aliases: ['lead', 'mentor', 'manage'] },
    ],
  },
];

interface MatchResult {
  category: string;
  color: string;
  matched: string[];
  total: number;
  percentage: number;
}

function analyzeJD(text: string): { results: MatchResult[]; overallMatch: number; matchedKeywords: string[] } {
  const lower = text.toLowerCase();
  const allMatched: string[] = [];

  const results = SKILL_CATEGORIES.map(cat => {
    const matched: string[] = [];
    for (const skill of cat.skills) {
      const allTerms = [skill.keyword.toLowerCase(), ...skill.aliases.map(a => a.toLowerCase())];
      if (allTerms.some(term => lower.includes(term))) {
        matched.push(skill.keyword);
        allMatched.push(skill.keyword);
      }
    }
    return {
      category: cat.name,
      color: cat.color,
      matched,
      total: cat.skills.length,
      percentage: cat.skills.length > 0 ? (matched.length / cat.skills.length) * 100 : 0,
    };
  });

  // Overall weighted match
  const totalSkills = results.reduce((s, r) => s + r.total, 0);
  const totalMatched = results.reduce((s, r) => s + r.matched.length, 0);
  const overallMatch = totalSkills > 0 ? (totalMatched / totalSkills) * 100 : 0;

  return { results, overallMatch, matchedKeywords: allMatched };
}

// SVG Radar Chart
function RadarChart({ results }: { results: MatchResult[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 95;
  const levels = 4;
  const n = results.length;

  const getPoint = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // Build filled polygon path
  const polygonPoints = results.map((r, i) => {
    const pct = r.percentage / 100;
    const p = getPoint(i, maxR * pct);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px] mx-auto">
      {/* Grid levels */}
      {Array.from({ length: levels }, (_, lvl) => {
        const r = maxR * ((lvl + 1) / levels);
        const points = Array.from({ length: n }, (_, i) => {
          const p = getPoint(i, r);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon
            key={lvl}
            points={points}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            opacity={0.4}
          />
        );
      })}

      {/* Axis lines */}
      {results.map((_, i) => {
        const p = getPoint(i, maxR);
        return (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy} x2={p.x} y2={p.y}
            stroke="hsl(var(--border))"
            strokeWidth="0.5"
            opacity={0.3}
          />
        );
      })}

      {/* Fill area */}
      <motion.polygon
        points={Array.from({ length: n }, () => `${cx},${cy}`).join(' ')}
        animate={{ points: polygonPoints }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        fill="url(#radarGrad)"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        opacity={0.85}
      />

      {/* Point dots */}
      {results.map((r, i) => {
        const pct = r.percentage / 100;
        const p = getPoint(i, maxR * pct);
        return (
          <motion.circle
            key={`dot-${i}`}
            initial={{ cx: cx, cy: cy, r: 0 }}
            animate={{ cx: p.x, cy: p.y, r: 3.5 }}
            transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
            fill={r.color}
            stroke="hsl(var(--background))"
            strokeWidth="1.5"
          />
        );
      })}

      {/* Labels */}
      {results.map((r, i) => {
        const labelR = maxR + 18;
        const p = getPoint(i, labelR);
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[8px] fill-muted-foreground font-medium"
          >
            {r.category}
          </text>
        );
      })}

      <defs>
        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.15" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function RecruiterMatch({ isOpen, onClose }: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [jdText, setJdText] = useState('');
  const [results, setResults] = useState<ReturnType<typeof analyzeJD> | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAi, setIsAi] = useState(false);

  const analyze = useCallback(async () => {
    if (jdText.trim().length < 20) return;
    
    setLoading(true);
    setIsAi(false);
    try {
      const apiBase = window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : `${window.location.origin}/api`;
      const res = await fetch(`${apiBase}/infra/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd: jdText }),
      });
      const json = await res.json();
      
      if (json.success && json.data) {
        // Map AI format to our MatchResult format
        const mappedResults = json.data.categories.map((c: any) => ({
           category: c.name,
           color: SKILL_CATEGORIES.find(sc => c.name.includes(sc.name) || sc.name.includes(c.name.split(' ')[0]))?.color || '#3b82f6',
           matched: c.matched || [],
           total: (c.matched?.length || 0) + (c.missing?.length || 0) || 10,
           percentage: c.score || 0
        }));
        
        setResults({
          results: mappedResults,
          overallMatch: json.data.overallMatch,
          matchedKeywords: json.data.categories.flatMap((c: any) => c.matched || [])
        });
        setIsAi(true);
      } else {
        // Fallback
        setResults(analyzeJD(jdText));
      }
    } catch {
      // Fallback
      setResults(analyzeJD(jdText));
    } finally {
      setLoading(false);
    }
  }, [jdText]);

  const reset = () => {
    setJdText('');
    setResults(null);
    setIsAi(false);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJdText(text);
    } catch {
      // Clipboard API may not be available
    }
  };

  const matchGrade = results
    ? results.overallMatch >= 70 ? { label: 'Strong Match', color: '#10b981', emoji: '🎯' }
    : results.overallMatch >= 45 ? { label: 'Good Match', color: '#f59e0b', emoji: '✨' }
    : results.overallMatch >= 25 ? { label: 'Partial Match', color: '#f97316', emoji: '📊' }
    : { label: 'Low Match', color: '#ef4444', emoji: '🔍' }
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-8 lg:inset-12 z-[61] flex items-start justify-center overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-5xl my-4 flex flex-col">
              <div className="absolute -inset-1 bg-gradient-to-br from-violet-500/15 via-blue-500/5 to-violet-500/15 rounded-3xl blur-xl opacity-60 pointer-events-none" />

              <div className="relative flex flex-col max-h-[90vh] bg-background/95 backdrop-blur-2xl rounded-3xl border border-border/50 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 bg-background/90 border-b border-border/50 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">Recruiter Match</h2>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-violet-500 to-blue-600 text-white rounded-full">AI</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Paste a JD → instant skill match analysis</p>
                      </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {!results ? (
                    <>
                      {/* Input Area */}
                      <div className="relative">
                        <textarea
                          value={jdText}
                          onChange={(e) => setJdText(e.target.value)}
                          placeholder="Paste a job description here...&#10;&#10;Example: We are looking for a Cloud/DevOps Engineer with experience in AWS, Terraform, Docker, CI/CD pipelines, Python..."
                          className="w-full h-48 p-4 pr-12 rounded-xl bg-secondary/20 border border-border/50 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none transition-all font-mono text-xs leading-relaxed"
                        />
                        <button
                          onClick={handlePaste}
                          className="absolute top-3 right-3 p-2 rounded-lg bg-secondary/50 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                          title="Paste from clipboard"
                        >
                          <Clipboard className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={analyze}
                          disabled={jdText.trim().length < 20 || loading}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-blue-600 text-white font-medium text-sm hover:opacity-90 transition-opacity shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Running AI Analysis...
                            </>
                          ) : (
                            <>
                              <Brain className="h-4 w-4" />
                              Analyze Match
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center">
                        Analyzes {SKILL_CATEGORIES.reduce((s, c) => s + c.skills.length, 0)} skills across {SKILL_CATEGORIES.length} categories • 100% client-side, nothing stored
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Match Score */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 15 }}
                        className="text-center"
                      >
                        <div className="text-3xl mb-1">{matchGrade?.emoji}</div>
                        <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-blue-600">
                          {results.overallMatch.toFixed(0)}%
                        </div>
                        <p className="text-sm font-bold mt-1" style={{ color: matchGrade?.color }}>
                          {matchGrade?.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {results.matchedKeywords.length} skills matched across {results.results.filter(r => r.matched.length > 0).length} categories
                        </p>
                      </motion.div>

                      {/* Radar Chart */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        <RadarChart results={results.results} />
                      </motion.div>

                      {/* Category Breakdown */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Category Breakdown
                        </h3>
                        {results.results.map((r, i) => (
                          <motion.div
                            key={r.category}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + i * 0.05 }}
                            className="p-3 rounded-xl bg-secondary/15 border border-border/40"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: r.color }}
                              />
                              <span className="text-xs font-semibold text-foreground flex-1">{r.category}</span>
                              <span className="text-xs font-mono" style={{ color: r.color }}>
                                {r.matched.length}/{r.total}
                              </span>
                              <div className="w-20 h-1.5 bg-secondary/30 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{ background: r.color }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${r.percentage}%` }}
                                  transition={{ duration: 0.6, delay: 0.3 + i * 0.05 }}
                                />
                              </div>
                            </div>
                            {r.matched.length > 0 && (
                              <div className="flex flex-wrap gap-1 ml-5">
                                {r.matched.map(skill => (
                                  <span
                                    key={skill}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                                    style={{ background: r.color + '15', color: r.color }}
                                  >
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                            {r.matched.length === 0 && (
                              <p className="text-[10px] text-muted-foreground/50 ml-5 flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                No skills from this category found in the JD
                              </p>
                            )}
                          </motion.div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-center">
                        <button
                          onClick={reset}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Try another JD
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-3 border-t border-border/50 bg-background/80 flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    {isAi 
                      ? 'Semantic matching powered by Google Gemini 2.5' 
                      : `Keyword matching against ${SKILL_CATEGORIES.reduce((s, c) => s + c.skills.length, 0)} tracked skills`}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Privacy: {isAi ? 'JD sent to API' : '100% client-side'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
