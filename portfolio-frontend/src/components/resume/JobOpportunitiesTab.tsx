import { Briefcase, Bookmark, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJobSearch } from '@/hooks/useJobSearch';
import { JobSearchPanel } from '@/components/job-search/JobSearchPanel';
import { SavedJobsPanel } from '@/components/job-search/SavedJobsPanel';
import { ResumePanel } from '@/components/job-search/ResumePanel';

export default function JobOpportunitiesTab() {
  const jobSearch = useJobSearch();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-500 dark:text-purple-400">
            Career search
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Job Opportunities
            </span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Live listings merged across LinkedIn, Indeed, JSearch and top company career pages — ranked by your resume match.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-600 dark:text-purple-300">
          <Bookmark className="h-3 w-3" />
          {jobSearch.savedJobs.length} saved
        </div>
      </div>

      <Tabs defaultValue="listings" className="space-y-5">
        <TabsList className="bg-muted/60 border border-border/60 backdrop-blur-sm">
          <TabsTrigger value="listings" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-300">
            <Briefcase className="h-3.5 w-3.5" />
            Listings
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-300">
            <Bookmark className="h-3.5 w-3.5" />
            Saved ({jobSearch.savedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="resume" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-300">
            <FileText className="h-3.5 w-3.5" />
            Resume Match
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          <JobSearchPanel
            jobs={jobSearch.jobs}
            savedJobs={jobSearch.savedJobs}
            filters={jobSearch.filters}
            setFilters={jobSearch.setFilters}
            page={jobSearch.page}
            totalPages={jobSearch.totalPages}
            setPage={jobSearch.setPage}
            loading={jobSearch.loading}
            error={jobSearch.error}
            searchJobs={jobSearch.searchJobs}
            batchSearch={jobSearch.batchSearch}
            saveJob={jobSearch.saveJob}
            unsaveJob={jobSearch.unsaveJob}
            isJobSaved={jobSearch.isJobSaved}
            quickApply={jobSearch.quickApply}
            getJobStatus={jobSearch.getJobStatus}
            batchMeta={jobSearch.batchMeta}
            hasSearched={jobSearch.hasSearched}
            filtersLoaded={jobSearch.filtersLoaded}
            savingFilters={jobSearch.savingFilters}
            saveFilters={jobSearch.saveFilters}
          />
        </TabsContent>

        <TabsContent value="saved">
          <SavedJobsPanel
            savedJobs={jobSearch.savedJobs}
            updateJobStatus={jobSearch.updateJobStatus}
            unsaveJob={jobSearch.unsaveJob}
          />
        </TabsContent>

        <TabsContent value="resume">
          <ResumePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
