export type ConciergeIntent =
  | { name: "navigate_to_section"; args: { section: string } }
  | { name: "highlight_section"; args: { section: string; reason?: string } }
  | { name: "open_project"; args: { slug: string } }
  | { name: "open_resume"; args: Record<string, never> }
  | { name: "download_resume"; args: Record<string, never> }
  | { name: "contact"; args: { channel: "email" | "linkedin" | "github" } }
  | { name: "filter_skills"; args: { group: string } }
  | { name: "show_card"; args: Record<string, never> }
  | { name: "tailor_resume_to_jd"; args: { jd_text: string } }
  | { name: "no_op"; args: Record<string, never> };

export type CardType =
  | "ProjectCard"
  | "TimelineSlice"
  | "SkillCluster"
  | "MetricStat"
  | "JDMatchCard"
  | "ContactCard"
  | "ElevatorPitch";

export interface DisplayCard {
  type: CardType;
  payload: Record<string, unknown>;
}

export type Emotion = "neutral" | "happy" | "thoughtful" | "excited";

export interface ConciergeTurn {
  spoken: string;
  caption: string;
  intents: ConciergeIntent[];
  display: DisplayCard | null;
  suggestions: string[];
  emotion: Emotion;
  meta?: { model?: string; recruiter_mode?: boolean; error?: boolean };
  success?: boolean;
}

export interface TranscriptEntry {
  id: string;
  role: "user" | "model";
  text: string;
  caption?: string;
  display?: DisplayCard | null;
  emotion?: Emotion;
  ts: number;
}
