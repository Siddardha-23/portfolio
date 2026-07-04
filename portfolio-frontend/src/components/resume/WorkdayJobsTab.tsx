import { Bookmark, Building2 } from 'lucide-react';
import { useJobSearch } from '@/hooks/useJobSearch';
import { WorkdayJobsPanel } from '@/components/job-search/WorkdayJobsPanel';

/**
 * Dedicated "Workday Jobs" sidebar tab (?tab=workday-jobs).
 *
 * Separate from Job Opportunities because it is a different data source with
 * different controls: direct CXS queries against the curated tenant catalog
 * (free, fast, fresh) instead of the Apify pipeline. Kept-mounted once
 * visited so an in-flight scan survives tab switches (same pattern as the
 * Tailor / Jobs tabs).
 */
export default function WorkdayJobsTab() {
  // useJobSearch loads saved jobs on mount, so Save / Quick Apply state is
  // shared with the rest of the workspace out of the box.
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
                Workday Jobs
              </span>
            </h2>
            <span className="rounded-full border border-purple-500/25 bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm shadow-purple-500/20">
              <Building2 className="mr-0.5 inline h-2.5 w-2.5" />
              Direct
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Live roles from hundreds of enterprise Workday career sites, queried
            directly — no scraping, no credits. Matched to your resume and
            defaulting to the last 3 days.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-300">
          <Bookmark className="h-3 w-3" />
          {jobSearch.savedJobs.length} saved
        </div>
      </div>

      <WorkdayJobsPanel
        isJobSaved={jobSearch.isJobSaved}
        getJobStatus={jobSearch.getJobStatus}
        saveJob={jobSearch.saveJob}
        unsaveJob={jobSearch.unsaveJob}
        quickApply={jobSearch.quickApply}
      />
    </div>
  );
}
