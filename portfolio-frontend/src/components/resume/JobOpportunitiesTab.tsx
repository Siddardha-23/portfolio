import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJobSearch } from '@/hooks/useJobSearch';
import { JobSearchPanel } from '@/components/job-search/JobSearchPanel';
import { SavedJobsPanel } from '@/components/job-search/SavedJobsPanel';
import { ResumePanel } from '@/components/job-search/ResumePanel';

export default function JobOpportunitiesTab() {
  const jobSearch = useJobSearch();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Career search
          </p>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Job Opportunities</h2>
        </div>
        <div className="inline-flex w-fit items-center rounded-full border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-gray-900/50 px-3 py-1 text-xs text-gray-600 dark:text-gray-300">
          Saved jobs: {jobSearch.savedJobs.length}
        </div>
      </div>

      <Tabs defaultValue="listings" className="space-y-5">
        <TabsList className="bg-gray-100 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08]">
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="saved">Saved ({jobSearch.savedJobs.length})</TabsTrigger>
          <TabsTrigger value="resume">Resume Match</TabsTrigger>
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
