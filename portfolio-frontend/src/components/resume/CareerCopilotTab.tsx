import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  History,
  Layers,
  Lightbulb,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Pin,
  Play,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

type CopilotMessage = {
  role: string;
  content: string;
  at?: string;
  id?: string;
  meta?: {
    pipeline?: PipelineStep[];
    citations?: Citation[];
    tool_calls?: ToolCall[];
    deliverable?: Deliverable | null;
  };
};

type PipelineStep = { agent: string; label: string; summary: string };
type Citation = { id: string; snippet: string };
type ToolCall = { tool: string; agent: string; summary: string };
type NextAction = { title: string; reason: string; priority?: number };

type Deliverable = {
  type: "ppt" | "pdf" | "project";
  data: Record<string, unknown>;
};

type PlaygroundState = {
  active_track?: string;
  custom_title?: string | null;
  custom_topic?: string | null;
  current_step?: number;
  steps?: Array<{ title: string; type: string; body: string }>;
  completed?: number[];
  finished_at?: string;
  xp?: number;
  streak?: number;
};

type Track = {
  id: string;
  title: string;
  description: string;
  steps: Array<{ title: string; type: string; body: string }>;
};

type KpiCard = { label: string; value: string | number; trend?: string; icon?: string };

type TimelineEvent = { type: string; description: string; timestamp: string };

type OutreachCampaign = {
  campaign_id: string;
  target_company: string;
  target_role: string;
  channel: string;
  contacts: Array<{ name: string; title: string; notes: string }>;
  sequence: Array<{
    step: number;
    action: string;
    template: string;
    status: string;
    sent_at: string | null;
    notes: string;
  }>;
  status: string;
  created_at: string;
};

type QuizQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

// ─── Agent theming ──────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { grad: string; text: string }> = {
  memory:     { grad: "from-violet-500/20 to-fuchsia-500/10", text: "text-violet-700 dark:text-violet-300" },
  strategist: { grad: "from-sky-500/20 to-cyan-500/10",       text: "text-sky-700 dark:text-sky-300" },
  tailor:     { grad: "from-amber-500/20 to-orange-500/10",    text: "text-amber-700 dark:text-amber-300" },
  interview:  { grad: "from-emerald-500/20 to-teal-500/10",    text: "text-emerald-700 dark:text-emerald-300" },
  outreach:   { grad: "from-rose-500/20 to-pink-500/10",       text: "text-rose-700 dark:text-rose-300" },
  project:    { grad: "from-indigo-500/20 to-blue-500/10",     text: "text-indigo-700 dark:text-indigo-300" },
  deliverable:{ grad: "from-teal-500/20 to-emerald-500/10",    text: "text-teal-700 dark:text-teal-300" },
  router:     { grad: "from-slate-500/20 to-gray-500/10",      text: "text-slate-600 dark:text-slate-400" },
};

const CHANNEL_ICON: Record<string, typeof Mail> = {
  email: Mail,
  linkedin: Linkedin,
  twitter: MessageSquare,
};

// ─── Small shared components ────────────────────────────────────────────────

function PipelineChips({ steps }: { steps: PipelineStep[] }) {
  if (!steps?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {steps.map((s, i) => {
        const c = AGENT_COLORS[(s.agent || "router").toLowerCase()] ?? AGENT_COLORS.router;
        return (
          <span
            key={`${s.agent}-${i}`}
            title={s.summary}
            className={`inline-flex max-w-full items-center gap-1 rounded-lg border border-white/10 bg-gradient-to-r ${c.grad} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-800 dark:text-gray-200`}
          >
            <span className="shrink-0 text-[9px] opacity-80">{s.agent}</span>
            <span className="truncate font-normal normal-case">{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}

function ToolCallLog({ calls }: { calls: ToolCall[] }) {
  if (!calls?.length) return null;
  return (
    <details className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
      <summary className="cursor-pointer font-semibold hover:text-indigo-600 dark:hover:text-indigo-300">
        {calls.length} tool call{calls.length !== 1 ? "s" : ""} executed
      </summary>
      <ul className="mt-1 ml-3 space-y-1 list-disc">
        {calls.map((t, i) => (
          <li key={i}>
            <span className="font-mono">{t.tool}</span>
            <span className="mx-1 opacity-60">→</span>
            <span>{t.summary}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function DeliverableCard({ d }: { d: Deliverable }) {
  if (!d?.data) return null;
  const data = d.data as Record<string, unknown>;
  if (d.type === "ppt") {
    const slides = (data.slides || []) as Array<{ title: string; bullets: string[]; speaker_notes?: string }>;
    return (
      <div className="mt-3 rounded-xl border border-teal-500/20 bg-teal-500/[0.04] p-3 text-xs">
        <p className="font-bold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" /> PPT Outline — {String(data.title || "")}
        </p>
        {(data.subtitle as string) && <p className="text-gray-500 text-[11px] mt-0.5">{String(data.subtitle)}</p>}
        <ol className="mt-2 ml-4 list-decimal space-y-1.5">
          {slides.map((s, i) => (
            <li key={i}>
              <span className="font-semibold text-gray-900 dark:text-white">{s.title}</span>
              {s.bullets?.length > 0 && (
                <ul className="ml-3 list-disc text-gray-600 dark:text-gray-400">
                  {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              )}
              {s.speaker_notes && <p className="italic text-gray-400 mt-0.5">{s.speaker_notes}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (d.type === "pdf") {
    const sections = (data.sections || []) as Array<{ heading: string; body: string }>;
    return (
      <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3 text-xs">
        <p className="font-bold text-blue-800 dark:text-blue-200 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> PDF One-Pager — {String(data.title || "")}
        </p>
        {sections.map((s, i) => (
          <div key={i} className="mt-2">
            <p className="font-semibold text-gray-900 dark:text-white">{s.heading}</p>
            <p className="text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed whitespace-pre-wrap">{s.body}</p>
          </div>
        ))}
      </div>
    );
  }
  if (d.type === "project") {
    const milestones = (data.milestones || []) as Array<{ title: string; deliverable: string; duration: string }>;
    return (
      <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-3 text-xs">
        <p className="font-bold text-indigo-800 dark:text-indigo-200 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Project Scaffold — {String(data.name || "")}
        </p>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{String(data.description || "")}</p>
        {(data.tech_stack as string) && <p className="mt-1 text-gray-500">Stack: {String(data.tech_stack)}</p>}
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          {milestones.map((m, i) => (
            <li key={i}>
              <span className="font-semibold">{m.title}</span>
              <span className="text-gray-400 ml-1">({m.duration})</span>
              <span className="block text-gray-500">{m.deliverable}</span>
            </li>
          ))}
        </ol>
        {(data.folder_structure as string) && (
          <pre className="mt-2 rounded bg-gray-100 dark:bg-gray-800 p-2 text-[10px] text-gray-700 dark:text-gray-300 overflow-auto whitespace-pre-wrap">
            {String(data.folder_structure)}
          </pre>
        )}
      </div>
    );
  }
  return null;
}

function KpiRow({ cards }: { cards: KpiCard[] }) {
  if (!cards?.length) return null;
  const icons: Record<string, typeof Zap> = {
    messages: MessageSquare,
    outreach: Mail,
    tracks: GraduationCap,
    days: Calendar,
    streak: Flame,
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {cards.map((k) => {
        const Ic = icons[(k.icon || "").toLowerCase()] || Zap;
        return (
          <div
            key={k.label}
            className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2">
              <Ic className="h-4 w-4 text-indigo-500" />
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{k.value}</span>
              {k.trend && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{k.trend}</span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">{k.label}</p>
          </div>
        );
      })}
    </div>
  );
}

function TimelineList({ events }: { events: TimelineEvent[] }) {
  if (!events?.length) return null;
  const iconFor = (t: string) => {
    if (t.includes("chat") || t.includes("copilot")) return MessageSquare;
    if (t.includes("outreach")) return Mail;
    if (t.includes("playground") || t.includes("track")) return GraduationCap;
    if (t.includes("memory")) return Brain;
    return Clock;
  };
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {events.map((e, i) => {
        const Ic = iconFor(e.type);
        return (
          <div key={i} className="flex gap-2 text-xs">
            <Ic className="h-3.5 w-3.5 shrink-0 text-gray-400 mt-0.5" />
            <div className="min-w-0">
              <p className="text-gray-700 dark:text-gray-300">{e.description}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{new Date(e.timestamp).toLocaleString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

type SubTab = "chat" | "outreach" | "playground" | "dashboard" | "network" | "offers";

type MomentumData = {
  streak: number;
  momentum_score: number;
  trend: "up" | "down";
  this_week: number;
  last_week: number;
  milestones: Array<{ id: string; label: string; earned: boolean }>;
  heatmap: Array<{ date: string; count: number }>;
};

type NetworkContact = {
  contact_id: string;
  name: string;
  company?: string;
  role?: string;
  platform?: string;
  relationship_strength?: string;
  notes?: string;
  referral_status?: string;
};

type OfferItem = {
  offer_id: string;
  company: string;
  role: string;
  base: number;
  bonus: number;
  equity: number;
  location?: string;
  remote?: boolean;
  status?: string;
  notes?: string;
};

export default function CareerCopilotTab() {
  // Core state
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [jdPaste, setJdPaste] = useState("");
  const [showJd, setShowJd] = useState(false);
  const [hasResume, setHasResume] = useState(true);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [nba, setNba] = useState<NextAction[]>([]);
  const [compliance, setCompliance] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);

  // Dashboard
  const [kpiCards, setKpiCards] = useState<KpiCard[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [focusDist, setFocusDist] = useState<Record<string, number>>({});
  const [memoryCtx, setMemoryCtx] = useState<Record<string, unknown>>({});

  // Playground
  const [playground, setPlayground] = useState<PlaygroundState | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [pgBusy, setPgBusy] = useState(false);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Outreach
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ company: "", role: "", channel: "email" });
  const [showNewCampaign, setShowNewCampaign] = useState(false);

  // Memory
  const [memoryNotes, setMemoryNotes] = useState<Record<string, string>>({});
  const [newMemKey, setNewMemKey] = useState("");
  const [newMemVal, setNewMemVal] = useState("");
  const [momentum, setMomentum] = useState<MomentumData | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<{
    headline: string;
    summary: string;
    wins: string[];
    focus_for_next_week: string[];
  } | null>(null);

  const [networkContacts, setNetworkContacts] = useState<NetworkContact[]>([]);
  const [networkInsights, setNetworkInsights] = useState<{ headline: string; analysis: string; actions: string[] } | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    company: "",
    role: "",
    platform: "linkedin",
    relationship_strength: "cold",
    notes: "",
  });
  const [networkBusy, setNetworkBusy] = useState(false);
  const [introByContact, setIntroByContact] = useState<Record<string, string>>({});

  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [offerCompare, setOfferCompare] = useState<{
    headline: string;
    recommendation: string;
    pros_cons: Array<{ company: string; pros: string[]; cons: string[] }>;
    total_comp_table: Array<{ company: string; total_comp: number }>;
  } | null>(null);
  const [newOffer, setNewOffer] = useState({
    company: "",
    role: "",
    base: "",
    bonus: "",
    equity: "",
    location: "",
    remote: false,
    notes: "",
  });
  const [offerBusy, setOfferBusy] = useState(false);
  const [negotiationByOffer, setNegotiationByOffer] = useState<Record<string, string>>({});

  // Navigation
  const [subTab, setSubTab] = useState<SubTab>("chat");
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => endRef.current?.scrollIntoView({ behavior: "smooth" });

  // ─── Data fetchers ──────────────────────────────────────────────────────

  const loadState = useCallback(async () => {
    setLoading(true);
    const r = await apiService.getCareerCopilotState();
    setLoading(false);
    if (r.error) { toast.error(r.error); return; }
    const d = r.data!;
    setMessages((d.messages || []) as CopilotMessage[]);
    setHasResume(!!d.has_resume);
    setSuggested(d.suggested_prompts || []);
    setNba(d.next_best_actions || []);
    setPlayground((d.playground as PlaygroundState) || null);
    setTracks(d.tracks || []);
    if ((d as any).kpi_cards) setKpiCards((d as any).kpi_cards);
    if ((d as any).activity_timeline) setTimeline((d as any).activity_timeline);
    if ((d as any).focus_distribution) setFocusDist((d as any).focus_distribution);
    if ((d as any).memory_context) setMemoryCtx((d as any).memory_context);
  }, []);

  const loadTimeline = useCallback(async () => {
    const r = await apiService.getCopilotTimeline(20);
    if (r.data?.events) setTimeline(r.data.events);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const r = await apiService.getOutreachCampaigns();
    if (r.data?.campaigns) setCampaigns(r.data.campaigns);
  }, []);

  const loadMemory = useCallback(async () => {
    const r = await apiService.getMemoryNotes();
    if (r.data?.notes) setMemoryNotes(r.data.notes);
  }, []);

  const loadMomentum = useCallback(async () => {
    const [m, d] = await Promise.all([
      apiService.getMomentumData(),
      apiService.getWeeklyDigest(),
    ]);
    if (m.data?.ok) setMomentum(m.data);
    if (d.data?.digest) setWeeklyDigest(d.data.digest);
  }, []);

  const loadNetworkData = useCallback(async () => {
    const [contactsResp, insightsResp] = await Promise.all([
      apiService.getNetworkContacts(),
      apiService.getNetworkingInsights(),
    ]);
    if (contactsResp.data?.contacts) setNetworkContacts(contactsResp.data.contacts as NetworkContact[]);
    if (insightsResp.data?.insights) setNetworkInsights(insightsResp.data.insights);
  }, []);

  const loadOffersData = useCallback(async () => {
    const [offersResp, compareResp] = await Promise.all([
      apiService.getOffers(),
      apiService.compareOffers(),
    ]);
    if (offersResp.data?.offers) setOffers(offersResp.data.offers as OfferItem[]);
    if (compareResp.data?.comparison) setOfferCompare(compareResp.data.comparison);
  }, []);

  useEffect(() => { void loadState(); }, [loadState]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (subTab === "outreach") void loadCampaigns();
    if (subTab === "dashboard") { void loadTimeline(); void loadMemory(); void loadMomentum(); }
    if (subTab === "network") void loadNetworkData();
    if (subTab === "offers") void loadOffersData();
  }, [subTab, loadCampaigns, loadTimeline, loadMemory, loadMomentum, loadNetworkData, loadOffersData]);

  // ─── Chat ───────────────────────────────────────────────────────────────

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    const r = await apiService.sendCareerCopilotMessage(msg, showJd && jdPaste.trim() ? jdPaste : undefined);
    setSending(false);
    if (r.error) { toast.error(r.error); return; }
    const d = r.data!;
    if (d.messages) setMessages(d.messages as CopilotMessage[]);
    if (d.citations) setCitations(d.citations);
    if (d.compliance) setCompliance(d.compliance);
    if (d.suggested_prompts?.length) setSuggested(d.suggested_prompts);
    if (d.next_best_actions?.length) setNba(d.next_best_actions);
  };

  const onReset = async () => {
    if (!window.confirm("Clear this chat history?")) return;
    await apiService.resetCareerCopilotChat();
    setMessages([]); setCitations([]); setCompliance("");
    void loadState();
  };

  // ─── Playground ─────────────────────────────────────────────────────────

  const startTrack = async (trackId?: string) => {
    setPgBusy(true);
    const r = await apiService.startPlaygroundTrack(
      trackId ? { track_id: trackId } : { custom_topic: customTopic.trim() || undefined },
    );
    setPgBusy(false);
    if (r.error || !r.data?.ok) { toast.error(r.data?.error || r.error || "Failed"); return; }
    setPlayground((r.data.playground as PlaygroundState) || null);
    setCustomTopic("");
    setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false);
    toast.success("Track started");
  };

  const advance = async () => {
    setPgBusy(true);
    const r = await apiService.advancePlaygroundStep();
    setPgBusy(false);
    if (r.error || !r.data?.ok) { toast.error(r.data?.error || r.error); return; }
    setPlayground((r.data.playground as PlaygroundState) || null);
  };

  const resetPlay = async () => {
    if (!window.confirm("Reset learning progress?")) return;
    await apiService.resetPlaygroundTrack();
    setPlayground(null); setQuiz(null); setQuizAnswers({}); setQuizSubmitted(false);
  };

  const runQuiz = async () => {
    const topic = playground?.custom_topic || playground?.active_track || "general";
    setPgBusy(true);
    const r = await apiService.generatePlaygroundQuiz({ topic, difficulty: "medium", count: 4 });
    setPgBusy(false);
    if (r.data?.questions) { setQuiz(r.data.questions); setQuizAnswers({}); setQuizSubmitted(false); }
    else toast.error(r.error || "Could not generate quiz");
  };

  const currentStep = playground?.steps?.[playground.current_step ?? 0];
  const pgProgress = playground?.steps?.length && playground.current_step != null
    ? Math.min(100, (playground.current_step / playground.steps.length) * 100) : 0;

  // ─── Outreach ───────────────────────────────────────────────────────────

  const createCampaign = async () => {
    if (!newCampaign.company.trim() || !newCampaign.role.trim()) {
      toast.error("Company and role required"); return;
    }
    setOutreachBusy(true);
    const r = await apiService.createOutreachCampaign({
      target_company: newCampaign.company,
      target_role: newCampaign.role,
      channel: newCampaign.channel,
    });
    setOutreachBusy(false);
    if (r.error || !r.data?.ok) { toast.error(r.error || "Failed"); return; }
    setShowNewCampaign(false);
    setNewCampaign({ company: "", role: "", channel: "email" });
    toast.success("Campaign created");
    void loadCampaigns();
  };

  const markStep = async (campId: string, stepIdx: number, status: string) => {
    const r = await apiService.updateOutreachStep(campId, { step_index: stepIdx, status });
    if (r.error) { toast.error(r.error); return; }
    void loadCampaigns();
  };

  // ─── Memory ─────────────────────────────────────────────────────────────

  const addMemory = async () => {
    if (!newMemKey.trim() || !newMemVal.trim()) { toast.error("Key and value required"); return; }
    const r = await apiService.saveMemoryNote(newMemKey.trim(), newMemVal.trim());
    if (r.error) { toast.error(r.error); return; }
    setNewMemKey(""); setNewMemVal("");
    void loadMemory();
    toast.success("Memory saved");
  };

  const delMemory = async (key: string) => {
    await apiService.deleteMemoryNote(key);
    void loadMemory();
  };

  const addContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setNetworkBusy(true);
    const r = await apiService.addNetworkContact(newContact);
    setNetworkBusy(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setNewContact({
      name: "",
      company: "",
      role: "",
      platform: "linkedin",
      relationship_strength: "cold",
      notes: "",
    });
    void loadNetworkData();
  };

  const removeContact = async (contactId: string) => {
    const r = await apiService.deleteNetworkContact(contactId);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    void loadNetworkData();
  };

  const makeIntro = async (contactId: string) => {
    const r = await apiService.generateNetworkIntro(contactId);
    if (r.error || !r.data?.intro?.message) {
      toast.error(r.error || "Could not generate intro");
      return;
    }
    setIntroByContact((prev) => ({ ...prev, [contactId]: r.data!.intro.message }));
  };

  const addOffer = async () => {
    if (!newOffer.company.trim() || !newOffer.role.trim()) {
      toast.error("Company and role are required");
      return;
    }
    setOfferBusy(true);
    const r = await apiService.addOffer({
      company: newOffer.company,
      role: newOffer.role,
      base: Number(newOffer.base || 0),
      bonus: Number(newOffer.bonus || 0),
      equity: Number(newOffer.equity || 0),
      location: newOffer.location,
      remote: newOffer.remote,
      notes: newOffer.notes,
      status: "active",
    });
    setOfferBusy(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    setNewOffer({
      company: "",
      role: "",
      base: "",
      bonus: "",
      equity: "",
      location: "",
      remote: false,
      notes: "",
    });
    void loadOffersData();
  };

  const removeOffer = async (offerId: string) => {
    const r = await apiService.deleteOffer(offerId);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    void loadOffersData();
  };

  const generateNegotiation = async (offerId: string) => {
    const ask = "Request a higher base compensation while staying collaborative.";
    const r = await apiService.generateNegotiationScript(offerId, ask);
    if (r.error || !r.data?.script?.email_body) {
      toast.error(r.error || "Failed to generate script");
      return;
    }
    setNegotiationByOffer((prev) => ({ ...prev, [offerId]: r.data!.script.email_body }));
  };

  // ─── Focus distribution chart (simple bar) ─────────────────────────────

  const focusItems = useMemo(() => {
    const entries = Object.entries(focusDist);
    if (!entries.length) return [];
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    return entries
      .map(([k, v]) => ({ topic: k, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [focusDist]);

  // ─── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[50vh] rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white/60 p-4 dark:bg-gray-900/40">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="h-20 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
        </div>
        <div className="mt-4 h-64 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  const SUB_TABS: Array<{ id: SubTab; label: string; icon: typeof Bot }> = [
    { id: "chat", label: "Copilot", icon: Bot },
    { id: "outreach", label: "Outreach", icon: Mail },
    { id: "playground", label: "Playground", icon: GraduationCap },
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "network", label: "Network", icon: Linkedin },
    { id: "offers", label: "Offers", icon: Award },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600/90 dark:text-indigo-300">
              Multi-agent agentic RAG
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-950 dark:text-white">
              Career Copilot
            </h2>
            <p className="max-w-2xl text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Ask naturally and get grounded responses from your resume context. Use this workspace for outreach, interview drills,
              application strategy, networking, and offer decisions — all in one guided flow.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">Resume-grounded answers</span>
              <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">Multi-agent tools</span>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">Actionable next steps</span>
            </div>
            {!hasResume && (
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                No parsed resume — upload in <strong>My Resumes</strong> for grounded answers.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void loadState()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white/80 px-3 text-xs font-semibold text-gray-700 transition hover:border-indigo-500/30 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"
            >
              <History className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      {kpiCards.length > 0 && <KpiRow cards={kpiCards} />}

      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200/80 bg-white/60 p-1 dark:border-white/10 dark:bg-gray-900/40">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
              subTab === t.id
                ? "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-500/20 shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main area */}
        <div className="min-w-0 space-y-4">

          {/* ═══════════ CHAT TAB ═══════════ */}
          {subTab === "chat" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/50">
              <div className="flex items-center justify-between border-b border-gray-200/80 px-4 py-2.5 dark:border-white/10">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Bot className="h-4 w-4 text-indigo-500" /> Agentic chat
                </span>
                <button type="button" onClick={() => void onReset()}
                  className="text-xs text-red-600/80 dark:text-red-400 font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  <Trash2 className="inline h-3 w-3 mr-1" />Clear
                </button>
              </div>
              <div className="max-h-[min(56vh,620px)] overflow-y-auto p-4 sm:p-5 space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { title: "Tailor for a role", prompt: "Tailor my resume strategy for a backend engineer role at Stripe." },
                    { title: "Practice interview", prompt: "Run a quick mock behavioral interview for senior backend roles." },
                    { title: "Create outreach", prompt: "Draft a 3-step outreach sequence for a recruiter at Google." },
                  ].map((quick) => (
                    <button
                      key={quick.title}
                      type="button"
                      onClick={() => void send(quick.prompt)}
                      className="rounded-lg border border-gray-200/80 bg-white/80 px-3 py-2 text-left text-xs transition hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <p className="font-semibold text-gray-900 dark:text-white">{quick.title}</p>
                      <p className="mt-0.5 text-gray-500 dark:text-gray-400">One-click starter</p>
                    </button>
                  ))}
                </div>
                {messages.length === 0 && (
                  <div className="rounded-xl border border-dashed border-indigo-500/25 bg-indigo-500/[0.04] p-5 text-sm text-gray-600 dark:text-gray-400">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300">
                      <Sparkles className="h-4 w-4" /> Start with a play or ask anything
                    </div>
                    <ul className="ml-1 list-inside list-disc space-y-1.5 text-[13px]">
                      <li>Tailor bullets to a JD (paste one below).</li>
                      <li>Generate a cold email + LinkedIn connect sequence for a target company.</li>
                      <li>Scaffold a portfolio project with milestones.</li>
                      <li>Create a PPT outline for a presentation.</li>
                      <li>Practice STAR answers for behavioral interviews.</li>
                    </ul>
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {messages.map((m) => {
                    const isUser = m.role === "user";
                    const pipe = m.meta?.pipeline;
                    const tools = m.meta?.tool_calls;
                    const deliv = m.meta?.deliverable;
                    return (
                      <motion.div
                        key={m.id || `${m.role}-${m.at}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          isUser
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-100/90 text-gray-900 dark:bg-white/10 dark:text-gray-100"
                        }`}>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          {!isUser && pipe?.length ? <PipelineChips steps={pipe} /> : null}
                          {!isUser && tools?.length ? <ToolCallLog calls={tools} /> : null}
                          {!isUser && deliv ? <DeliverableCard d={deliv} /> : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {sending && (
                  <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-300">
                    <Loader2 className="h-4 w-4 animate-spin" /> Orchestrating agents…
                  </div>
                )}
                <div ref={endRef} />
              </div>
              {citations.length > 0 && (
                <div className="border-t border-gray-200/80 px-4 py-3 text-xs text-gray-500 dark:text-gray-400 dark:border-white/10">
                  <p className="mb-1 font-semibold text-gray-700 dark:text-gray-300">RAG sources</p>
                  <ul className="space-y-1">
                    {citations.slice(0, 4).map((c) => (
                      <li key={c.id}>
                        <span className="font-mono text-[10px] text-indigo-500">{c.id}</span> {c.snippet}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t border-gray-200/90 p-3 sm:p-4 space-y-3 dark:border-white/10">
                <button type="button" onClick={() => setShowJd((s) => !s)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  {showJd ? "Hide" : "Attach"} job description
                </button>
                {showJd && (
                  <textarea value={jdPaste} onChange={(e) => setJdPaste(e.target.value)} rows={3}
                    placeholder="Paste JD — agents use it for tailoring, outreach, and interview prep."
                    className="w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-950/50 dark:text-white"
                  />
                )}
                {compliance && <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80">{compliance}</p>}
                {suggested.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggested.map((s) => (
                      <button key={s} type="button" onClick={() => void send(s)}
                        className="rounded-full border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-1 text-[11px] font-medium text-indigo-800 dark:text-indigo-200 hover:bg-indigo-500/10 transition"
                      >{s}</button>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    rows={2}
                    placeholder="Ask: outreach, PPT, project scaffold, STAR answers, tailoring…"
                    className="min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white/90 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-gray-950/60 dark:text-white"
                  />
                  <button type="button" disabled={sending || !input.trim()} onClick={() => void send()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 dark:shadow-indigo-500/10 transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/40 dark:hover:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-md"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ OUTREACH TAB ═══════════ */}
          {subTab === "outreach" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-4 w-4 text-rose-500" /> Outreach campaigns
                </h3>
                <button type="button" onClick={() => setShowNewCampaign(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> New campaign
                </button>
              </div>
              {showNewCampaign && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 space-y-3">
                  <input value={newCampaign.company} onChange={(e) => setNewCampaign((p) => ({ ...p, company: e.target.value }))}
                    placeholder="Target company" className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                  <input value={newCampaign.role} onChange={(e) => setNewCampaign((p) => ({ ...p, role: e.target.value }))}
                    placeholder="Target role" className="w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                  <div className="flex gap-2">
                    {["email", "linkedin", "twitter"].map((ch) => (
                      <button key={ch} type="button" onClick={() => setNewCampaign((p) => ({ ...p, channel: ch }))}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${
                          newCampaign.channel === ch
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            : "border-gray-200 text-gray-500 dark:border-white/10"
                        }`}
                      >{ch}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={outreachBusy} onClick={() => void createCampaign()}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >{outreachBusy ? "Creating…" : "Create & auto-generate sequence"}</button>
                    <button type="button" onClick={() => setShowNewCampaign(false)} className="text-xs text-gray-500 dark:text-gray-400">Cancel</button>
                  </div>
                </div>
              )}
              {campaigns.length === 0 && !showNewCampaign && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/10 p-6 text-center text-sm text-gray-500">
                  No campaigns yet. Create one to get an AI-generated outreach sequence.
                </div>
              )}
              {campaigns.map((c) => {
                const ChIcon = CHANNEL_ICON[c.channel] || Mail;
                return (
                  <div key={c.campaign_id} className="rounded-xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{c.target_role} @ {c.target_company}</p>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <ChIcon className="h-3 w-3" /> {c.channel} · {c.status}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        c.status === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : c.status === "completed" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "bg-gray-500/10 text-gray-600 dark:text-gray-400"
                      }`}>{c.status}</span>
                    </div>
                    {c.sequence?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {c.sequence.map((s, si) => (
                          <div key={si} className="flex items-start gap-2 text-xs">
                            <div className={`mt-1 h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              s.status === "sent" ? "bg-emerald-500 text-white"
                              : s.status === "replied" ? "bg-blue-500 text-white"
                              : s.status === "skipped" ? "bg-gray-400 text-white"
                              : "border-2 border-gray-300 dark:border-gray-600 text-gray-400"
                            }`}>
                              {s.status === "sent" || s.status === "replied" ? <Check className="h-2.5 w-2.5" /> : s.step}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-800 dark:text-gray-200">{s.action}</p>
                              {s.template && (
                                <p className="mt-1 text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">{s.template}</p>
                              )}
                              <div className="mt-1.5 flex gap-1.5">
                                {s.status === "pending" && (
                                  <>
                                    <button type="button" onClick={() => void markStep(c.campaign_id, si, "sent")}
                                      className="rounded px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                                    >Mark sent</button>
                                    <button type="button" onClick={() => void markStep(c.campaign_id, si, "skipped")}
                                      className="rounded px-2 py-0.5 bg-gray-500/10 text-gray-600 dark:text-gray-400 font-semibold"
                                    >Skip</button>
                                  </>
                                )}
                                {s.status === "sent" && (
                                  <button type="button" onClick={() => void markStep(c.campaign_id, si, "replied")}
                                    className="rounded px-2 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                                  >Got reply</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════ PLAYGROUND TAB ═══════════ */}
          {subTab === "playground" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50 space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-500" /> Guided learning paths
                    </h3>
                    {playground?.xp != null && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-300">
                        <Trophy className="h-3.5 w-3.5" /> {playground.xp} XP
                        {(playground.streak ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5 ml-2 text-orange-600 dark:text-orange-300">
                            <Flame className="h-3.5 w-3.5" /> {playground.streak}d streak
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Theory → practice, basic → advanced. Complete tracks, earn XP, take assessments. Or type any topic below.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input value={customTopic} onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="e.g. Kubernetes for interviews, React performance patterns"
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                    <button type="button" disabled={pgBusy} onClick={() => void startTrack()}
                      className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >{pgBusy ? "Generating…" : "Generate custom track"}</button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {tracks.map((t) => (
                    <button key={t.id} type="button" onClick={() => void startTrack(t.id)} disabled={pgBusy}
                      className="text-left rounded-xl border border-gray-200/80 p-3 text-xs transition hover:border-indigo-500/30 hover:shadow-sm dark:border-white/10"
                    >
                      <span className="block font-bold text-gray-900 dark:text-white text-[13px] leading-snug">{t.title}</span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{t.description}</span>
                      <span className="mt-1.5 inline-block text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                        {t.steps.length} steps
                      </span>
                    </button>
                  ))}
                </div>
                {tracks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                    No tracks yet. Generate a custom track to get started.
                  </div>
                )}

                {playground?.steps && playground.steps.length > 0 && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-4 space-y-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                        style={{ width: `${pgProgress}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-indigo-800 dark:text-indigo-200">
                        {playground.custom_title || tracks.find((x) => x.id === playground.active_track)?.title || "Track"}
                        {playground.finished_at && " — complete"}
                      </p>
                      <span className="text-[10px] text-gray-500">
                        {playground.current_step ?? 0}/{playground.steps.length} steps
                      </span>
                    </div>
                    {playground.finished_at && !currentStep && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Track complete. Take the assessment or send results to the copilot.
                        </p>
                        <button type="button" disabled={pgBusy} onClick={() => void runQuiz()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          <Award className="h-3.5 w-3.5" /> {pgBusy ? "Generating…" : "Take assessment"}
                        </button>
                      </div>
                    )}
                    {currentStep && !playground.finished_at && (
                      <>
                        <p className={`text-[10px] uppercase font-bold mt-1 ${
                          currentStep.type === "practice" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                        }`}>
                          {currentStep.type === "practice" ? "Practice" : "Theory"} · Step {(playground.current_step ?? 0) + 1}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{currentStep.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{currentStep.body}</p>
                        <div className="flex gap-2">
                          <button type="button" disabled={pgBusy} onClick={() => void advance()}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300"
                          >
                            <Play className="h-3.5 w-3.5" /> Mark done & next
                          </button>
                          <button type="button" onClick={() => void send(`Help me with: ${currentStep.title} — ${currentStep.body}`)}
                            className="text-xs text-gray-500 underline"
                          >Ask copilot</button>
                        </div>
                      </>
                    )}
                    <button type="button" onClick={() => void resetPlay()} className="text-xs text-gray-400 underline">Reset</button>
                  </div>
                )}

                {quiz && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-4">
                    <p className="font-bold text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-1.5">
                      <Award className="h-4 w-4" /> Assessment
                    </p>
                    {quiz.map((q, qi) => (
                      <div key={qi} className="space-y-1.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{qi + 1}. {q.question}</p>
                        <div className="space-y-1">
                          {q.options.map((opt, oi) => {
                            const selected = quizAnswers[qi] === oi;
                            const isCorrect = quizSubmitted && oi === q.correct_index;
                            const isWrong = quizSubmitted && selected && oi !== q.correct_index;
                            return (
                              <button key={oi} type="button" disabled={quizSubmitted}
                                onClick={() => setQuizAnswers((p) => ({ ...p, [qi]: oi }))}
                                className={`w-full text-left rounded-lg border px-3 py-1.5 text-xs transition ${
                                  isCorrect ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                  : isWrong ? "border-red-500 bg-red-500/10 text-red-800 dark:text-red-200"
                                  : selected ? "border-indigo-500 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200"
                                  : "border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-indigo-500/30"
                                }`}
                              >{opt}</button>
                            );
                          })}
                        </div>
                        {quizSubmitted && <p className="text-[11px] text-gray-500 italic">{q.explanation}</p>}
                      </div>
                    ))}
                    {!quizSubmitted && (
                      <button type="button" onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(quizAnswers).length < quiz.length}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >Submit answers</button>
                    )}
                    {quizSubmitted && (
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        Score: {quiz.filter((q, i) => quizAnswers[i] === q.correct_index).length}/{quiz.length}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ DASHBOARD TAB ═══════════ */}
          {subTab === "dashboard" && (
            <div className="space-y-5">
              {/* Activity timeline */}
              <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-indigo-500" /> Activity timeline
                </h3>
                {timeline.length > 0 ? <TimelineList events={timeline} /> : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">No activity yet. Start chatting, creating campaigns, or learning.</p>
                )}
              </div>

              {/* Focus distribution */}
              {focusItems.length > 0 && (
                <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-indigo-500" /> Topic focus
                  </h3>
                  <div className="space-y-2">
                    {focusItems.map((f) => (
                      <div key={f.topic} className="flex items-center gap-3">
                        <span className="w-20 text-xs font-medium text-gray-700 dark:text-gray-300 capitalize truncate">{f.topic}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: `${f.pct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500 tabular-nums w-8 text-right">{f.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {momentum && (
                <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
                    <Flame className="h-4 w-4 text-orange-500" /> Momentum engine
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Current streak</p>
                      <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{momentum.streak} days</p>
                    </div>
                    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Momentum score</p>
                      <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{momentum.momentum_score}/100</p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Week-over-week</p>
                      <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{momentum.this_week} vs {momentum.last_week}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-10 gap-1">
                    {momentum.heatmap.slice(-30).map((h) => (
                      <div key={h.date} title={`${h.date}: ${h.count} actions`} className={`h-3 rounded ${h.count >= 3 ? "bg-indigo-500" : h.count >= 1 ? "bg-indigo-300 dark:bg-indigo-600" : "bg-gray-200 dark:bg-white/10"}`} />
                    ))}
                  </div>
                </div>
              )}

              {weeklyDigest && (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-5">
                  <h3 className="text-sm font-bold text-violet-800 dark:text-violet-200">{weeklyDigest.headline}</h3>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{weeklyDigest.summary}</p>
                </div>
              )}

              {/* Memory notes */}
              <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                  <Brain className="h-4 w-4 text-violet-500" /> Pinned memory
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
                  Pin preferences so agents always know them: "Remote only," "Target PM roles," "No FAANG."
                </p>
                <div className="space-y-2">
                  {Object.entries(memoryNotes).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[0.02]">
                      <Pin className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-gray-900 dark:text-white">{k}</span>
                        <span className="mx-1 text-gray-400">→</span>
                        <span className="text-gray-600 dark:text-gray-300">{v}</span>
                      </div>
                      <button type="button" onClick={() => void delMemory(k)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                {Object.keys(memoryNotes).length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Nothing pinned yet. Add preferences so the copilot remembers your constraints.
                  </p>
                )}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input value={newMemKey} onChange={(e) => setNewMemKey(e.target.value)} placeholder="Key (e.g. constraint)"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                  <input value={newMemVal} onChange={(e) => setNewMemVal(e.target.value)} placeholder="Value (e.g. remote only)"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white/90 px-3 py-1.5 text-xs dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                  <button type="button" onClick={() => void addMemory()}
                    className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                  ><Plus className="inline h-3 w-3 mr-0.5" /> Pin</button>
                </div>
              </div>
            </div>
          )}

          {subTab === "network" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <input value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} placeholder="Name"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                <input value={newContact.company} onChange={(e) => setNewContact((p) => ({ ...p, company: e.target.value }))} placeholder="Company"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                <input value={newContact.role} onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))} placeholder="Role"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
              </div>
              <textarea value={newContact.notes} onChange={(e) => setNewContact((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notes"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
              <button type="button" onClick={() => void addContact()} disabled={networkBusy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                Add contact
              </button>
              {networkInsights && <p className="text-xs text-gray-600 dark:text-gray-300">{networkInsights.analysis}</p>}
              <div className="space-y-2">
                {networkContacts.map((c) => (
                  <div key={c.contact_id} className="rounded-lg border border-gray-200/80 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name} {c.company ? `· ${c.company}` : ""}</p>
                      <button type="button" onClick={() => void removeContact(c.contact_id)} className="text-xs text-red-500">Delete</button>
                    </div>
                    {c.role && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.role}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => void makeIntro(c.contact_id)} className="rounded bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Generate intro</button>
                      {introByContact[c.contact_id] && (
                        <button type="button" onClick={() => navigator.clipboard?.writeText(introByContact[c.contact_id])} className="rounded bg-gray-200 px-2 py-1 text-[11px] dark:bg-white/10">Copy</button>
                      )}
                    </div>
                    {introByContact[c.contact_id] && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">{introByContact[c.contact_id]}</p>}
                  </div>
                ))}
                {networkContacts.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">No contacts yet. Add people to build your referral pipeline.</p>}
              </div>
            </div>
          )}

          {subTab === "offers" && (
            <div className="rounded-2xl border border-gray-200/90 bg-white/90 p-5 dark:border-white/[0.08] dark:bg-gray-900/50 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <input value={newOffer.company} onChange={(e) => setNewOffer((p) => ({ ...p, company: e.target.value }))} placeholder="Company"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                <input value={newOffer.role} onChange={(e) => setNewOffer((p) => ({ ...p, role: e.target.value }))} placeholder="Role"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
                <input value={newOffer.base} onChange={(e) => setNewOffer((p) => ({ ...p, base: e.target.value }))} placeholder="Base salary"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-gray-950/50 dark:text-white" />
              </div>
              <button type="button" onClick={() => void addOffer()} disabled={offerBusy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                Add offer
              </button>
              {offerCompare && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{offerCompare.headline}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{offerCompare.recommendation}</p>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {offers.map((o) => (
                  <div key={o.offer_id} className="rounded-lg border border-gray-200/80 p-3 dark:border-white/10">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{o.role} @ {o.company}</p>
                      <button type="button" onClick={() => void removeOffer(o.offer_id)} className="text-xs text-red-500">Delete</button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Base ${o.base || 0} · Bonus ${o.bonus || 0} · Equity ${o.equity || 0}</p>
                    <button type="button" onClick={() => void generateNegotiation(o.offer_id)}
                      className="mt-2 rounded bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      Generate negotiation script
                    </button>
                    {negotiationByOffer[o.offer_id] && <p className="mt-2 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">{negotiationByOffer[o.offer_id]}</p>}
                  </div>
                ))}
                {offers.length === 0 && <p className="text-xs text-gray-500 dark:text-gray-400">No offers yet. Add offers to compare total compensation and negotiation plans.</p>}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════ RIGHT SIDEBAR ═══════════ */}
        <aside className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-gray-200/90 bg-gradient-to-b from-white to-gray-50/50 p-4 dark:border-white/[0.08] dark:from-gray-900/80 dark:to-gray-950/80">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" /> Next best actions
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Adaptive picks from your latest context + behavior patterns.
            </p>
            <ul className="mt-3 space-y-2">
              {nba.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-left text-xs dark:border-white/10 dark:bg-white/[0.03] hover:border-indigo-500/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                    onClick={() => { setSubTab("chat"); void send(a.title); }}
                  >
                    <p className="font-semibold text-gray-900 dark:text-white">{a.title}</p>
                    <p className="text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{a.reason}</p>
                  </button>
                </li>
              ))}
            </ul>
            {nba.length === 0 && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No suggestions yet. Chat once to get personalized next actions.</p>
            )}
          </div>

          {/* Context card */}
          <div className="rounded-2xl border border-gray-200/90 bg-white/70 p-4 text-xs dark:border-white/[0.08] dark:bg-white/[0.03]">
            <p className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-500" /> System overview
            </p>
            <ul className="mt-2 space-y-1.5 text-gray-500 dark:text-gray-400">
              <li className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${hasResume ? "bg-emerald-500" : "bg-red-500"}`} />
                Resume: {hasResume ? "loaded" : "missing"}
              </li>
              <li>Messages: {messages.length}</li>
              <li>Campaigns: {campaigns.length}</li>
              <li>Memory notes: {Object.keys(memoryNotes).length}</li>
            </ul>
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-gray-200/90 p-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed dark:border-white/[0.08]">
            <p className="font-semibold text-gray-800 dark:text-gray-200">How the agentic loop works</p>
            <p className="mt-1.5">
              Each message enters a <strong>ReAct orchestrator</strong>. Gemini Pro decides which tools to call
              (resume RAG, JD analysis, bullet tailoring, email drafting, PPT/project scaffolding, quiz generation).
              Tool results feed back to the model for up to 5 rounds. You see every agent and tool call in the pipeline chips.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
