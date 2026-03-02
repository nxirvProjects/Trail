import { useState } from 'react';
import { Layout } from '../components/Layout';
import { TaskBoard } from '../components/TaskBoard';
import { JobsTable } from '../components/JobsTable';
import { CommandPalette } from '../components/CommandPalette';
import { JobCardModal } from '../components/JobCardModal';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useJobs } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';
import type { Job } from '@job-logger/shared';

type Tab = 'jobs' | 'board';

export default function BoardPage() {
  const [tab, setTab] = useState<Tab>('jobs');
  const { isOpen: paletteOpen, setIsOpen: setPaletteOpen } = useCommandPalette();
  const { user } = useAuth();
  const { jobs, updateJob, deleteJob, addJob } = useJobs(user?.id);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');

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
          <JobsTable jobs={jobs} onJobClick={handleJobClick} />
        ) : (
          <TaskBoard />
        )}
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        jobs={jobs}
        onSelectJob={(job) => { handleJobClick(job); setPaletteOpen(false); }}
      />

      <JobCardModal
        job={selectedJob}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (id, updates) => {
          const result = await updateJob(id, updates);
          return { error: result.error };
        }}
        onDelete={async (id) => {
          const result = await deleteJob(id);
          return { error: result.error };
        }}
        onCreate={async (job) => { await addJob(job); }}
        mode={modalMode}
      />
    </Layout>
  );
}
