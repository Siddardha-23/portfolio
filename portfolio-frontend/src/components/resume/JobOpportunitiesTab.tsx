import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJobSearch } from '@/hooks/useJobSearch';
import { JobSearchPanel } from '@/components/job-search/JobSearchPanel';
import { SavedJobsPanel } from '@/components/job-search/SavedJobsPanel';
import { ResumePanel } from '@/components/job-search/ResumePanel';

export default function JobOpportunitiesTab() {
  const jobSearch = useJobSearch();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Job Opportunities</h2>
      </div>

      <Tabs defaultValue="listings" className="space-y-5">
        <TabsList>
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
            autoSearchDone={jobSearch.autoSearchDone}
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
