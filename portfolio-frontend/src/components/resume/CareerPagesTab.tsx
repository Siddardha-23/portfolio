import { Bookmark, Globe2 } from 'lucide-react';
import { useJobSearch } from '@/hooks/useJobSearch';
import { WorkdayJobsPanel } from '@/components/job-search/WorkdayJobsPanel';

/**
 * Dedicated "Career Pages" sidebar tab (?tab=career-pages).
 *
 * The non-Workday counterpart to the Workday Jobs tab: scans companies that
 * host jobs on their OWN career sites via public ATS JSON APIs (Greenhouse,
 * Lever, Ashby, SmartRecruiters, Workable, Recruitee) — Stripe, Airbnb,
 * Coinbase, Databricks, OpenAI-class companies plus hundreds of niche
 * startups that never appear on Workday. Same engine, scoring, and filters;
 * different catalog and endpoints (variant="careers").
 */
export default function CareerPagesTab() {
  const jobSearch = useJobSearch();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-400">
            Career search
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Career Pages
              </span>
            </h2>
            <span className="rounded-full border border-purple-500/25 bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm shadow-purple-500/20">
              <Globe2 className="mr-0.5 inline h-2.5 w-2.5" />
              Direct
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Live roles from companies&apos; own career pages — Greenhouse, Lever,
            Ashby and more, queried directly. The startups and tech companies
            that never show up on Workday, matched to your resume.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-300">
          <Bookmark className="h-3 w-3" />
          {jobSearch.savedJobs.length} saved
        </div>
      </div>

      <WorkdayJobsPanel
        variant="careers"
        isJobSaved={jobSearch.isJobSaved}
        getJobStatus={jobSearch.getJobStatus}
        saveJob={jobSearch.saveJob}
        unsaveJob={jobSearch.unsaveJob}
        quickApply={jobSearch.quickApply}
      />
    </div>
  );
}
