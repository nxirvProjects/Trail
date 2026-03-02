import { useState } from 'react';
import { Layout } from '../components/Layout';
import { TaskBoard } from '../components/TaskBoard';
import { JobsTable } from '../components/JobsTable';
import { JobCardModal } from '../components/JobCardModal';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import type { Job } from '@job-logger/shared';

type Tab = 'jobs' | 'board';

export default function BoardPage() {
  const [tab, setTab] = useState<Tab>('jobs');
  const { user } = useAuth();
  const { jobs, updateJob, deleteJob, addJob } = useJobs(user?.id);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleAddJob = () => {
    setSelectedJob(null);
    setModalMode('create');
    setModalOpen(true);
  };

  return (
    <Layout>
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTab('jobs')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'jobs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Applications
          </button>
          <button
            onClick={() => setTab('board')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Task Board
          </button>
        </div>

        {tab === 'jobs' && (
          <button
            onClick={handleAddJob}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> Add Job
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'jobs' ? (
          <JobsTable
            jobs={jobs}
            onEditJob={handleJobClick}
            onDeleteJob={(jobId) => {
              const target = jobs.find((job) => job.id === jobId);
              if (target) setDeleteTarget(target);
            }}
          />
        ) : (
          <TaskBoard />
        )}
      </div>

      <JobCardModal
        job={selectedJob}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (id, updates) => {
          const result = await updateJob(id, updates);
          return { error: result.error };
        }}
        onCreate={async (job) => { await addJob(job); }}
        mode={modalMode}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Delete job?</h2>
              <p className="text-sm text-gray-500 mt-1">
                This will permanently remove <span className="font-medium text-gray-700">{deleteTarget.role_title}</span> at{' '}
                <span className="font-medium text-gray-700">{deleteTarget.company_name}</span>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTarget) return;
                  setDeleting(true);
                  await deleteJob(deleteTarget.id);
                  setDeleting(false);
                  setDeleteTarget(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
