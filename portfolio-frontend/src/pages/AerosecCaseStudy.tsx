import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { useState, useEffect } from 'react';
import {
    ArrowLeft, ArrowRight, Shield, Lock, Globe, Server,
    BarChart3, Cpu, Activity, Users, AlertTriangle,
    CheckCircle2, ChevronLeft, ChevronRight, Download,
    Target, TrendingUp, Lightbulb, Layers, FileText,
    Network, Rocket, Eye, Zap
} from 'lucide-react';

// ============ SLIDE DATA ============
const SLIDE_IMAGES: string[] = [
    '/images/projects/aerosec/slide-01.png',
    '/images/projects/aerosec/slide-02.png',
    '/images/projects/aerosec/slide-03.png',
    '/images/projects/aerosec/slide-04.png',
    '/images/projects/aerosec/slide-05.png',
    '/images/projects/aerosec/slide-06.png',
    '/images/projects/aerosec/slide-07.png',
    '/images/projects/aerosec/slide-08.png',
    '/images/projects/aerosec/slide-09.png',
    '/images/projects/aerosec/slide-10.png',
    '/images/projects/aerosec/slide-11.png',
    '/images/projects/aerosec/slide-12.png',
    '/images/projects/aerosec/slide-13.png',
    '/images/projects/aerosec/slide-14.png',
    '/images/projects/aerosec/slide-15.png',
    '/images/projects/aerosec/slide-16.png',
    '/images/projects/aerosec/slide-17.png',
    '/images/projects/aerosec/slide-18.png',
    '/images/projects/aerosec/slide-19.png',
    '/images/projects/aerosec/slide-20.png',
    '/images/projects/aerosec/slide-21.png',
    '/images/projects/aerosec/slide-22.png',
    '/images/projects/aerosec/slide-23.png',
    '/images/projects/aerosec/slide-24.png',
    '/images/projects/aerosec/slide-25.png',
    '/images/projects/aerosec/slide-26.png',
    '/images/projects/aerosec/slide-27.png',
    '/images/projects/aerosec/slide-28.png',
];

const PRESENTATION_FILE = '/Team 5_Pitch 3_11202025.pptx';

// ============ COMPONENTS ============

function SectionHeading({ badge, badgeIcon, title, subtitle }: {
    badge: string; badgeIcon?: React.ReactNode; title: string; subtitle?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
        >
            <Badge variant="outline" className="mb-3 border-primary/40 text-primary px-3 py-1 text-xs">
                {badgeIcon || <Shield className="h-3 w-3 mr-1.5" />}
                <span className="ml-1.5">{badge}</span>
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{title}</h2>
            {subtitle && <p className="text-sm md:text-base text-muted-foreground max-w-3xl">{subtitle}</p>}
        </motion.div>
    );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
        >
            <Card className="p-4 border-0 shadow-lg bg-card/80 backdrop-blur-sm text-center">
                <div className="flex justify-center mb-2 text-primary">{icon}</div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </Card>
        </motion.div>
    );
}

function Slideshow() {
    const [current, setCurrent] = useState(0);

    if (SLIDE_IMAGES.length === 0) return null;

    return (
        <div className="relative mb-6">
            <div className="aspect-[16/9] rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <img
                    src={SLIDE_IMAGES[current]}
                    alt={`Slide ${current + 1}`}
                    className="w-full h-full object-contain"
                />
            </div>
            <div className="flex items-center justify-between mt-4">
                <Button
                    variant="outline" size="sm"
                    onClick={() => setCurrent(p => Math.max(0, p - 1))}
                    disabled={current === 0}
                >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    {current + 1} / {SLIDE_IMAGES.length}
                </span>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setCurrent(p => Math.min(SLIDE_IMAGES.length - 1, p + 1))}
                    disabled={current === SLIDE_IMAGES.length - 1}
                >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>
        </div>
    );
}

// ============ MAIN PAGE ============

export default function AerosecCaseStudy() {
    const navigate = useNavigate();

    useEffect(() => { window.scrollTo(0, 0); }, []);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
                <div className="container flex items-center justify-between py-3">
                    <Button variant="ghost" onClick={() => navigate('/home#projects')} className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Portfolio
                    </Button>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500 text-white">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                        </Badge>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="container px-4 md:px-6 py-8 md:py-12 max-w-5xl mx-auto">

                {/* ===== HERO ===== */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <Badge variant="outline" className="mb-4 border-red-500/40 text-red-600 dark:text-red-400 px-4 py-1.5 text-xs">
                        <Shield className="h-3 w-3 mr-1.5" />
                        Honeywell Innovation Challenge &middot; ASU Technology Innovation Lab
                    </Badge>
                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                        Strengthening Cybersecurity in
                        <br className="hidden sm:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-primary"> Connected Aviation Systems</span>
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground font-medium mb-2">
                        Securing Passenger-Facing Integrations
                    </p>
                    <p className="text-sm text-muted-foreground">August 2025 &ndash; December 2025</p>
                </motion.div>


                {/* ===== EXECUTIVE SUMMARY ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Executive Summary"
                        badgeIcon={<Target className="h-3 w-3" />}
                        title="From Cybersecurity Challenge to Business Resilience Framework"
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-4">
                            <p className="text-foreground/80 leading-relaxed">
                                This project began as part of a structured technology innovation engagement guided and evaluated by Honeywell experts. Starting with a broad cybersecurity challenge in commercial aviation, we systematically narrowed the problem through rigorous customer discovery and stakeholder research to its most critical &mdash; and most underprotected &mdash; dimension.
                            </p>
                            <p className="text-foreground/80 leading-relaxed">
                                The focus: <span className="font-semibold text-foreground">third-party integrations and Passenger Service System (PSS) APIs</span> that connect airline booking platforms, payment systems, loyalty programs, and external vendors. These systems are attacked far more frequently than avionics, yet remain disproportionately under-secured relative to their business impact.
                            </p>
                            <p className="text-foreground/80 leading-relaxed">
                                The result is <span className="font-semibold text-foreground">AEROSEC</span> &mdash; a real-time vendor cyber risk dashboard that bridges the gap between technical security operations and executive decision-making, mapping cyber risk directly to revenue impact, regulatory compliance, and business continuity.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                            <StatCard value="20+" label="Stakeholder Interviews" icon={<Users className="h-5 w-5" />} />
                            <StatCard value="60%+" label="Breaches via Third-Party" icon={<AlertTriangle className="h-5 w-5" />} />
                            <StatCard value="$4.4M" label="Avg. Breach Cost (Global)" icon={<TrendingUp className="h-5 w-5" />} />
                            <StatCard value="$200B" label="Total Addressable Market" icon={<Target className="h-5 w-5" />} />
                        </div>
                    </div>
                </section>


                {/* ===== PROBLEM FRAMING ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Problem Framing"
                        badgeIcon={<Eye className="h-3 w-3" />}
                        title="The Real Attack Surface in Aviation"
                        subtitle="Aviation cybersecurity conversations default to avionics &mdash; flight control systems, cockpit networks, navigation. The real exposure sits in the systems passengers interact with every day."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {[
                            { icon: <Users className="h-5 w-5" />, title: "FAA Officials", insight: "Regulatory pressure is increasing on passenger-facing system security, with supply chain risk management becoming a top compliance priority." },
                            { icon: <Globe className="h-5 w-5" />, title: "Air France\u2013KLM & Delta", insight: "Major carriers confirmed that third-party integration security is their most critical operational blind spot." },
                            { icon: <Shield className="h-5 w-5" />, title: "Cybersecurity Engineers", insight: "BOLA vulnerabilities and API misconfigurations are the most common entry points in airline booking and payment systems." },
                            { icon: <Lock className="h-5 w-5" />, title: "IT Security Leaders", insight: "Urgent need for real-time vendor risk visibility \u2014 current tools lack aviation-specific context and compliance mapping." },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className="p-5 border-0 shadow-lg bg-card/80 backdrop-blur-sm h-full">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500">{item.icon}</div>
                                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                                    </div>
                                    <p className="text-sm text-foreground/70 leading-relaxed">{item.insight}</p>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Cascading Impact */}
                    <Card className="p-6 border-0 shadow-xl bg-gradient-to-br from-red-500/5 via-card to-amber-500/5">
                        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            A Single Integration Failure Can Cascade Into:
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            {["Revenue Loss", "Booking Errors", "Airport Delays", "Regulatory Exposure", "Brand Damage"].map((impact, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08 }}
                                >
                                    <Badge variant="outline" className="px-3 py-1.5 text-sm border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5">
                                        {impact}
                                    </Badge>
                                </motion.div>
                            ))}
                        </div>
                    </Card>
                </section>


                {/* ===== THINKING EVOLUTION ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Systems Thinking"
                        badgeIcon={<Lightbulb className="h-3 w-3" />}
                        title="The Shift That Changed Everything"
                        subtitle="This project fundamentally transformed how I approach cybersecurity &mdash; from tool-level thinking to systems-level strategy."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* BEFORE */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <Card className="p-6 border-0 shadow-lg bg-zinc-100 dark:bg-zinc-800/50 h-full">
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="p-2 rounded-lg bg-zinc-300 dark:bg-zinc-700">
                                        <ArrowLeft className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                                    </div>
                                    <h3 className="font-bold text-zinc-600 dark:text-zinc-400 text-lg">Before</h3>
                                </div>
                                <ul className="space-y-3">
                                    {[
                                        "Building \u201Cjust another cybersecurity project\u201D",
                                        "Thinking in terms of tools and implementation",
                                        "Viewing security as a technical checkbox",
                                        "DevOps mindset: build, deploy, secure",
                                        "Solution-first approach without validation"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </motion.div>

                        {/* AFTER */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <Card className="p-6 border-0 shadow-xl bg-gradient-to-br from-primary/5 via-card to-accent/5 h-full ring-1 ring-primary/20">
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-primary text-lg">After</h3>
                                </div>
                                <ul className="space-y-3">
                                    {[
                                        "Thinking in interconnected systems",
                                        "Framing cybersecurity as a business continuity problem",
                                        "Quantifying risk in Time, Money, and Performance",
                                        "Connecting technical controls to revenue protection",
                                        "Customer discovery before solution design",
                                        "Validating TAM\u2013SAM\u2013SOM before building",
                                        "Aligning architecture with regulatory frameworks"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        </motion.div>
                    </div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="mt-6 text-center text-sm text-muted-foreground italic max-w-2xl mx-auto"
                    >
                        I transitioned from a DevOps engineer who builds and deploys secure systems to a business-outcome-driven systems thinker. I now align architecture with regulatory frameworks, map threats to financial impact, and connect technical security to executive decision-making.
                    </motion.p>
                </section>


                {/* ===== AEROSEC SOLUTION ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Solution"
                        badgeIcon={<Activity className="h-3 w-3" />}
                        title="AEROSEC &mdash; Real-Time Third-Party Vendor Cyber Risk Dashboard"
                        subtitle="Complete visibility into the security posture of every third-party integration connected to passenger-facing airline systems."
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { icon: <Activity className="h-5 w-5" />, title: "Real-Time API Monitoring", desc: "Continuous monitoring of all PSS, booking, and payment API integrations", color: "#F59E0B" },
                            { icon: <BarChart3 className="h-5 w-5" />, title: "Vendor Risk Scoring", desc: "NIST/FAA-aligned scoring of every third-party vendor\u2019s security posture", color: "#8B5CF6" },
                            { icon: <Cpu className="h-5 w-5" />, title: "AI Anomaly Detection", desc: "Machine learning models trained on aviation-specific integration patterns", color: "#3B82F6" },
                            { icon: <FileText className="h-5 w-5" />, title: "Automated Audit Logs", desc: "Continuous compliance documentation for regulatory readiness", color: "#10B981" },
                            { icon: <TrendingUp className="h-5 w-5" />, title: "Executive Dashboard", desc: "Maps cyber risk directly to business impact, revenue, and continuity", color: "#EF4444" },
                            { icon: <Shield className="h-5 w-5" />, title: "Compliance Scoring", desc: "Real-time alignment tracking across NIST, ISO, and FAA standards", color: "#6366F1" },
                            { icon: <Eye className="h-5 w-5" />, title: "Integration Visibility", desc: "Full view across PSS, booking APIs, payment systems, and loyalty programs", color: "#0EA5E9" },
                            { icon: <Zap className="h-5 w-5" />, title: "Reduced MTTD / MTTR", desc: "Faster detection and response through automated threat intelligence", color: "#D946EF" },
                        ].map((cap, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Card className="p-4 border-0 shadow-lg bg-card/80 h-full hover:shadow-xl transition-shadow">
                                    <div className="p-2 rounded-lg w-fit mb-3" style={{ background: `${cap.color}15`, color: cap.color }}>
                                        {cap.icon}
                                    </div>
                                    <h4 className="font-semibold text-sm text-foreground mb-1">{cap.title}</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{cap.desc}</p>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Business impact callout */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-6"
                    >
                        <Card className="p-5 border-0 shadow-lg bg-gradient-to-r from-primary/5 via-card to-accent/5">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                                {[
                                    { label: "Reduces MTTD / MTTR", icon: <Zap className="h-4 w-4" /> },
                                    { label: "Prevents Revenue Leakage", icon: <TrendingUp className="h-4 w-4" /> },
                                    { label: "Improves Regulatory Readiness", icon: <CheckCircle2 className="h-4 w-4" /> },
                                    { label: "Strengthens Business Continuity", icon: <Shield className="h-4 w-4" /> },
                                ].map((item, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1.5 text-primary">
                                        {item.icon}
                                        <span className="text-xs font-medium text-foreground/70">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>
                </section>


                {/* ===== COMPLIANCE & FRAMEWORKS ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Compliance Alignment"
                        badgeIcon={<Lock className="h-3 w-3" />}
                        title="Regulatory & Security Framework Coverage"
                        subtitle="AEROSEC is purpose-built to align with aviation's most critical regulatory and security standards."
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                title: "NIST CSF 2.0",
                                desc: "Full alignment across all six functions \u2014 Govern, Identify, Protect, Detect, Respond, Recover \u2014 with emphasis on the new Governance function for supply chain risk.",
                                color: "#3B82F6",
                                icon: <Shield className="h-5 w-5" />
                            },
                            {
                                title: "ISO/IEC 27001",
                                desc: "Information Security Management System compliance with focus on third-party risk management and vendor assessment controls.",
                                color: "#8B5CF6",
                                icon: <Lock className="h-5 w-5" />
                            },
                            {
                                title: "DO-326A",
                                desc: "Airworthiness Security Risk Assessment methodology applied to passenger-facing system integrations and their operational dependencies.",
                                color: "#EF4444",
                                icon: <Layers className="h-5 w-5" />
                            },
                            {
                                title: "DO-355",
                                desc: "Security Assurance and Validation processes ensuring continuous verification of third-party integration integrity.",
                                color: "#F59E0B",
                                icon: <CheckCircle2 className="h-5 w-5" />
                            },
                            {
                                title: "Privacy by Design",
                                desc: "Privacy principles embedded into the platform architecture from inception, not retrofitted as an afterthought.",
                                color: "#10B981",
                                icon: <Eye className="h-5 w-5" />
                            },
                            {
                                title: "Supply Chain Risk Management",
                                desc: "Systematic assessment and continuous monitoring of vendor security posture aligned with NIST CSF Governance function.",
                                color: "#D946EF",
                                icon: <Network className="h-5 w-5" />
                            },
                        ].map((fw, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                            >
                                <Card className="p-5 border-0 shadow-lg bg-card/80 h-full">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 rounded-lg" style={{ background: `${fw.color}15`, color: fw.color }}>
                                            {fw.icon}
                                        </div>
                                        <h3 className="font-bold text-foreground text-sm">{fw.title}</h3>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{fw.desc}</p>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>


                {/* ===== BUSINESS & MARKET ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Market Validation"
                        badgeIcon={<TrendingUp className="h-3 w-3" />}
                        title="Business Model & Market Opportunity"
                        subtitle="Engineering discipline applied to market validation &mdash; customer discovery before solution design, TAM\u2013SAM\u2013SOM before building."
                    />

                    {/* TAM / SAM / SOM */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {[
                            { label: "TAM", value: "~$200B", desc: "Global Cybersecurity Market", color: "#3B82F6" },
                            { label: "SAM", value: "~$15B", desc: "Aviation Cybersecurity", color: "#8B5CF6" },
                            { label: "SOM", value: "~$2B", desc: "API / Integration Security in Aviation", color: "#10B981" },
                        ].map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className="p-6 border-0 shadow-xl text-center bg-card/80">
                                    <Badge className="mb-3 border-0 text-white" style={{ background: item.color }}>
                                        {item.label}
                                    </Badge>
                                    <div className="text-3xl font-bold text-foreground mb-1">{item.value}</div>
                                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    {/* Business Model Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {
                                title: "Revenue Model",
                                items: [
                                    "SaaS tiered plans (Starter \u2192 Enterprise)",
                                    "Per-integration monitoring fees",
                                    "Premium compliance reporting add-on",
                                    "Professional services for onboarding"
                                ],
                                icon: <TrendingUp className="h-5 w-5" />, color: "#10B981"
                            },
                            {
                                title: "Customer Segments",
                                items: [
                                    "Major international carriers (Delta, Air France\u2013KLM)",
                                    "Regional airlines with growing digital footprint",
                                    "Travel technology platforms and aggregators",
                                    "Airport operators and ground services"
                                ],
                                icon: <Users className="h-5 w-5" />, color: "#3B82F6"
                            },
                            {
                                title: "Go-to-Market",
                                items: [
                                    "Direct sales to airline CISO offices",
                                    "Partnership with aviation IT consultancies",
                                    "Conference presence (aviation + cybersecurity)",
                                    "Compliance-driven demand generation"
                                ],
                                icon: <Rocket className="h-5 w-5" />, color: "#8B5CF6"
                            },
                            {
                                title: "Financial Projection",
                                items: [
                                    "5-year financial model with unit economics",
                                    "Break-even analysis and use-of-funds allocation",
                                    "Customer acquisition cost modeling",
                                    "Recurring revenue with 90%+ retention target"
                                ],
                                icon: <BarChart3 className="h-5 w-5" />, color: "#F59E0B"
                            },
                        ].map((section, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Card className="p-5 border-0 shadow-lg bg-card/80 h-full">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg" style={{ background: `${section.color}15`, color: section.color }}>
                                            {section.icon}
                                        </div>
                                        <h3 className="font-bold text-foreground">{section.title}</h3>
                                    </div>
                                    <ul className="space-y-2">
                                        {section.items.map((item, j) => (
                                            <li key={j} className="flex items-start gap-2 text-sm text-foreground/70">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: section.color }} />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            </motion.div>
                        ))}
                    </div>

                    <motion.p
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="mt-6 text-center text-sm text-muted-foreground max-w-2xl mx-auto"
                    >
                        Connected technical design &rarr; market need &rarr; revenue model &rarr; compliance value &rarr; executive ROI into a unified business case.
                    </motion.p>
                </section>


                {/* ===== PRESENTATION ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Presentation"
                        badgeIcon={<FileText className="h-3 w-3" />}
                        title="Project Pitch Deck"
                    />

                    <Slideshow />

                    <Card className="p-8 border-0 shadow-xl bg-gradient-to-br from-primary/5 via-card to-accent/5 text-center">
                        <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                            <FileText className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">AEROSEC Innovation Pitch</h3>
                        <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                            Full presentation including problem framing, customer discovery insights, solution architecture, business model, and go-to-market strategy.
                        </p>
                        <Button className="btn-premium" asChild>
                            <a href={PRESENTATION_FILE} download>
                                <Download className="h-4 w-4 mr-2" />
                                Download Presentation
                            </a>
                        </Button>
                    </Card>
                </section>


                {/* ===== KEY LEARNINGS ===== */}
                <section className="mb-20">
                    <SectionHeading
                        badge="Transformation"
                        badgeIcon={<Lightbulb className="h-3 w-3" />}
                        title="Key Learnings"
                        subtitle="What this project taught me about the intersection of cybersecurity, business strategy, and systems design."
                    />
                    <Card className="p-6 md:p-8 border-0 shadow-xl bg-card/80">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent shadow-md">
                                <Lightbulb className="h-5 w-5 text-white" />
                            </div>
                            <h3 className="font-bold text-foreground">From DevOps Engineer &rarr; Systems-Oriented Cybersecurity Strategist</h3>
                        </div>
                        <div className="space-y-4 text-foreground/80 leading-relaxed">
                            <p>
                                Before this project, I approached cybersecurity the way most engineers do &mdash; as a set of tools to implement, configurations to harden, and vulnerabilities to patch. Security was something you added to a system after you built it.
                            </p>
                            <p>
                                This engagement with Honeywell fundamentally changed that perspective. Through structured customer discovery, I learned that the most dangerous threats aren&apos;t the ones you find in a vulnerability scanner &mdash; they&apos;re the ones hidden in the dependencies between systems that no single team owns.
                            </p>
                            <p>
                                I learned to <span className="font-semibold text-foreground">quantify risk in the language executives understand</span> &mdash; time, money, and performance. I learned that compliance isn&apos;t a burden but a competitive advantage when designed into the architecture. And I learned that the strongest security posture comes not from better tools, but from better systems thinking.
                            </p>
                            <p>
                                Most importantly, I learned that <span className="font-semibold text-foreground">customer discovery must precede solution design</span>. The 20+ conversations with FAA officials, airline executives, and cybersecurity leaders didn&apos;t just validate our problem &mdash; they reshaped it entirely. The project we ended with bears little resemblance to the one we started with, and that&apos;s precisely what made it valuable.
                            </p>
                        </div>
                    </Card>
                </section>


                {/* ===== CLOSING IMPACT ===== */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-12"
                >
                    <Card className="p-8 md:p-10 border-0 shadow-2xl bg-gradient-to-br from-red-500/5 via-card to-primary/5 text-center">
                        <div className="max-w-3xl mx-auto">
                            <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-6">
                                <Shield className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">Why This Project Matters</h3>
                            <p className="text-foreground/80 leading-relaxed mb-6">
                                This project represents more than a cybersecurity solution. It represents a way of thinking &mdash; one that connects technical architecture to business outcomes, regulatory compliance to competitive advantage, and engineering rigor to executive strategy. It demonstrates that the most impactful security work doesn&apos;t happen in isolation &mdash; it happens at the intersection of systems, business, and trust.
                            </p>
                            <p className="text-foreground/90 font-semibold leading-relaxed text-lg">
                                I am a cybersecurity professional who understands not just how to secure systems &mdash; but how to secure business ecosystems.
                            </p>

                            <div className="flex flex-wrap gap-3 justify-center mt-8">
                                <Button className="btn-premium" onClick={() => navigate('/home#contact')}>
                                    Get In Touch
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => navigate('/home#projects')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    All Projects
                                </Button>
                            </div>
                        </div>
                    </Card>
                </motion.section>

            </main>
        </div>
    );
}
