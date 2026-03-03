import { useRef, useState, type ChangeEvent } from 'react';
import { Layout } from '@/features/layout/Layout';
import { TaskBoard } from '@/features/tasks/TaskBoard';
import { JobsTable } from '@/features/jobs/JobsTable';
import { JobCardModal } from '@/features/jobs/JobCardModal';
import { useJobs } from '@/features/jobs/useJobs';
import { useAuth } from '@/features/auth/useAuth';
import type { Job } from '@job-logger/shared';
import type { AppSection } from '@/features/layout/Layout';
import {
  areTimestampsNear,
  dedupeTimestampKeyForJob,
  parseJobsCsvText,
  type ParsedCsvJob,
} from '@/features/jobs/csvImport';

interface ImportSummary {
  files: number;
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  cleanedRows: number;
  swappedRows: number;
}

export default function BoardPage() {
  const [section, setSection] = useState<AppSection>('applications');
  const [todoTitle, setTodoTitle] = useState('Roadmap');
  const { user } = useAuth();
  const { jobs, updateJob, deleteJob, addJob, addJobsBulk, clearJobs } = useJobs(user?.id);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error(`Failed reading ${file.name}`));
      reader.readAsText(file);
    });

  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0 || importing) return;

    setImporting(true);

    let totalRows = 0;
    let skippedInvalid = 0;
    let cleanedRows = 0;
    let swappedRows = 0;
    let skippedDuplicates = 0;

    const allCandidates: ParsedCsvJob[] = [];

    for (const file of files) {
      try {
        const text = await readFileText(file);
        const parsed = parseJobsCsvText(text);
        totalRows += parsed.candidates.length + parsed.skippedInvalid;
        skippedInvalid += parsed.skippedInvalid;
        cleanedRows += parsed.candidates.filter((c) => c.cleaned).length;
        swappedRows += parsed.candidates.filter((c) => c.swapped).length;
        allCandidates.push(...parsed.candidates);
      } catch {
        skippedInvalid += 1;
      }
    }

    const existingDayKeys = new Set(
      jobs.map((job) =>
        dedupeTimestampKeyForJob({
          company_name: job.company_name,
          role_title: job.role_title,
          url: job.url,
          date_applied: job.date_applied,
        })
      )
    );

    const seenDayKeys = new Set<string>();
    const acceptedCandidates: ParsedCsvJob[] = [];

    const jobsToInsert = allCandidates
      .filter((candidate) => {
        if (existingDayKeys.has(candidate.dedupeDayKey) || seenDayKeys.has(candidate.dedupeDayKey)) {
          skippedDuplicates += 1;
          return false;
        }

        const duplicateInBatch = acceptedCandidates.some(
          (accepted) =>
            accepted.dedupeBaseKey === candidate.dedupeBaseKey &&
            areTimestampsNear(accepted.timestampMs, candidate.timestampMs)
        );

        if (duplicateInBatch) {
          skippedDuplicates += 1;
          return false;
        }

        seenDayKeys.add(candidate.dedupeDayKey);
        acceptedCandidates.push(candidate);
        return true;
      })
      .map((candidate) => candidate.job);

    let imported = 0;
    if (jobsToInsert.length > 0) {
      const CHUNK_SIZE = 75;
      for (let i = 0; i < jobsToInsert.length; i += CHUNK_SIZE) {
        const chunk = jobsToInsert.slice(i, i + CHUNK_SIZE);
        const { data } = await addJobsBulk(chunk);
        imported += data?.length ?? 0;
      }
    }

    setImportSummary({
      files: files.length,
      totalRows,
      imported,
      skippedDuplicates,
      skippedInvalid,
      cleanedRows,
      swappedRows,
    });

    setImporting(false);
    event.target.value = '';
  };

  return (
    <Layout activeSection={section} onSectionChange={setSection}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xl font-semibold app-text">
          {section === 'applications' ? 'Applications' : section === 'todos' ? todoTitle : 'Overall Stats'}
        </h2>

        {section === 'applications' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
            <button
              onClick={() => setClearConfirmOpen(true)}
              disabled={jobs.length === 0 || clearing}
              className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
            >
              {clearing ? 'Clearing...' : 'Clear Table'}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={handleImportFiles}
        className="hidden"
      />

      <div className="flex-1 overflow-hidden flex flex-col pb-1">
        {section === 'applications' ? (
          <JobsTable
            jobs={jobs}
            onEditJob={handleJobClick}
            onDeleteJob={(jobId) => {
              const target = jobs.find((job) => job.id === jobId);
              if (target) setDeleteTarget(target);
            }}
          />
        ) : section === 'todos' ? (
          <TaskBoard onRoadmapTitleChange={setTodoTitle} />
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-[var(--app-border)] app-surface-elevated flex items-center justify-center">
            <p className="text-sm app-subtle">Overall stats coming soon.</p>
          </div>
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
          className="app-overlay fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">Delete job?</h2>
              <p className="text-sm app-muted mt-1">
                This will permanently remove <span className="font-medium app-text">{deleteTarget.role_title}</span> at{' '}
                <span className="font-medium app-text">{deleteTarget.company_name}</span>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm app-muted hover:bg-[var(--app-hover)] rounded-lg disabled:opacity-50"
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

      {importSummary && (
        <div
          className="app-overlay fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setImportSummary(null)}
        >
          <div
            className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">CSV import complete</h2>
              <p className="text-sm app-muted mt-1">Processed {importSummary.files} file(s).</p>
            </div>
            <div className="p-4 space-y-1 text-sm app-text">
              <p>Total rows: <span className="font-semibold">{importSummary.totalRows}</span></p>
              <p>Imported: <span className="font-semibold text-green-500">{importSummary.imported}</span></p>
              <p>Skipped duplicates: <span className="font-semibold">{importSummary.skippedDuplicates}</span></p>
              <p>Skipped invalid/noise: <span className="font-semibold">{importSummary.skippedInvalid}</span></p>
              <p>Auto-cleaned rows: <span className="font-semibold">{importSummary.cleanedRows}</span></p>
              <p>Auto-swapped rows: <span className="font-semibold">{importSummary.swappedRows}</span></p>
            </div>
            <div className="p-4 pt-0 flex justify-end">
              <button
                type="button"
                onClick={() => setImportSummary(null)}
                className="px-4 py-2 text-sm app-muted hover:bg-[var(--app-hover)] rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {clearConfirmOpen && (
        <div
          className="app-overlay fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => !clearing && setClearConfirmOpen(false)}
        >
          <div
            className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">Clear all jobs?</h2>
              <p className="text-sm app-muted mt-1">
                This removes all jobs in Applications. Related notes will be removed by cascade.
              </p>
            </div>
            <div className="p-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(false)}
                disabled={clearing}
                className="px-4 py-2 text-sm app-muted hover:bg-[var(--app-hover)] rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setClearing(true);
                  await clearJobs();
                  setClearing(false);
                  setClearConfirmOpen(false);
                }}
                disabled={clearing}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {clearing ? 'Clearing...' : 'Clear Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
