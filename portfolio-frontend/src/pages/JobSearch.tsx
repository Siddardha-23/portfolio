import { useState, useEffect } from 'react';
import { apiService } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useJobSearch } from '@/hooks/useJobSearch';
import { JobSearchPanel } from '@/components/job-search/JobSearchPanel';
import { SavedJobsPanel } from '@/components/job-search/SavedJobsPanel';
import { ResumePanel } from '@/components/job-search/ResumePanel';

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    const resp = await apiService.jobSearchAuth(password);
    setLoading(false);
    if (resp.error) {
      setError(resp.error);
      return;
    }
    onAuth();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Job Search Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Enter password to access</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const jobSearch = useJobSearch();

  const handleLogout = () => {
    localStorage.removeItem('job_search_token');
    window.location.reload();
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
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('job_search_token');
    if (token) {
      // Quick check: try to hit a protected endpoint
      apiService.getResume().then(resp => {
        // 401 means token is invalid/expired
        if (resp.error && resp.error.includes('401')) {
          localStorage.removeItem('job_search_token');
          setAuthed(false);
        } else {
          setAuthed(true);
        }
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return <PasswordGate onAuth={() => setAuthed(true)} />;
  }

  return <Dashboard />;
}
