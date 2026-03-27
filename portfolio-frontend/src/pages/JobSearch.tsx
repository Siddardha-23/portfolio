import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJobSearch } from '@/hooks/useJobSearch';
import { JobSearchPanel } from '@/components/job-search/JobSearchPanel';
import { SavedJobsPanel } from '@/components/job-search/SavedJobsPanel';
import { ResumePanel } from '@/components/job-search/ResumePanel';
import AuthGate from '@/components/AuthGate';
import { useAuth } from '@/contexts/AuthContext';

function Dashboard() {
  const jobSearch = useJobSearch();

  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Job Search Dashboard</h1>
            {jobSearch.autoSearchDone && !jobSearch.loading && jobSearch.jobs.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {jobSearch.jobs.length} jobs today
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="search">Search Jobs</TabsTrigger>
            <TabsTrigger value="saved">
              Saved ({jobSearch.savedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="resume">Resume</TabsTrigger>
          </TabsList>

          <TabsContent value="search">
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
      </main>
    </div>
  );
}

export default function JobSearch() {
  return (
    <AuthGate title="Job Search Dashboard" description="Search jobs, save opportunities, and tailor your resume">
      <Dashboard />
    </AuthGate>
  );
}
