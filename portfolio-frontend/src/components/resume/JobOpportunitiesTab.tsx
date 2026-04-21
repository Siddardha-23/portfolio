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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-300">
            Resume Tailor
          </p>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Job Opportunities</h2>
        </div>
        <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Saved jobs: {jobSearch.savedJobs.length}</span>
        </div>
      </div>

      <Tabs defaultValue="listings" className="space-y-5">
        <TabsList className="bg-gray-100 dark:bg-white/[0.06]">
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
