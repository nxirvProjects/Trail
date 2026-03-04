import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import { Input } from '@/shared/ui/input';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/shared/ui/hover-card';
import type { Job, JobStatus } from '@job-logger/shared';
import { Pencil, Trash2 } from 'lucide-react';

interface JobsTableProps {
  jobs: Job[];
  onEditJob: (job: Job) => void;
  onDeleteJob: (jobId: string) => void;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interviewing: 'Interviewing',
  negotiating: 'Negotiating',
  closed: 'Closed',
};

function getHostname(url: string): string {
  try {
    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getSafeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function JobsTable({ jobs, onEditJob, onDeleteJob }: JobsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');

  const filtered = jobs.filter((job) => {
    const matchesSearch =
      !search ||
      job.company_name.toLowerCase().includes(search.toLowerCase()) ||
      job.role_title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    const aApplied = a.date_applied ? new Date(a.date_applied).getTime() : null;
    const bApplied = b.date_applied ? new Date(b.date_applied).getTime() : null;

    if (aApplied !== null && bApplied !== null && aApplied !== bApplied) {
      return bApplied - aApplied;
    }

    if (aApplied === null && bApplied !== null) return 1;
    if (aApplied !== null && bApplied === null) return -1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search company or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs focus-visible:ring-0 focus-visible:ring-transparent focus-visible:border-[var(--app-border)]"
        />
        <div className="flex gap-1.5">
          {(['all', 'wishlist', 'applied', 'interviewing', 'negotiating', 'closed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-[var(--app-border)] text-[var(--app-muted)] hover:border-indigo-300 hover:text-indigo-500'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs app-subtle">{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-[var(--app-border)] app-surface-elevated">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]">
              <TableHead className="h-9">Company</TableHead>
              <TableHead className="h-9">Role</TableHead>
              <TableHead className="h-9">Status</TableHead>
              <TableHead className="h-9">Date Applied</TableHead>
              <TableHead className="h-9">URL</TableHead>
              <TableHead className="h-9 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center app-subtle py-12 ">
                  {jobs.length === 0 ? 'No jobs logged yet — use the extension to log your first application.' : 'No results match your filters.'}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((job) => (
                <TableRow key={job.id} className="border-b border-[var(--app-border)]">
                  <TableCell className="py-2 font-medium app-text">
                    <HoverCard openDelay={180} closeDelay={120}>
                      <HoverCardTrigger asChild>
                        <span className="inline-block max-w-[180px] truncate cursor-help">{job.company_name}</span>
                      </HoverCardTrigger>
                      <HoverCardContent>
                        <p className="text-xs font-semibold app-subtle mb-1">Notes</p>
                        <p className="text-sm leading-relaxed app-text whitespace-pre-wrap break-words">
                          {job.notes?.trim() ? job.notes : 'No notes yet.'}
                        </p>
                      </HoverCardContent>
                    </HoverCard>
                  </TableCell>
                  <TableCell className="py-2 app-muted">{job.role_title}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={job.status}>{STATUS_LABELS[job.status]}</Badge>
                  </TableCell>
                  <TableCell className="py-2 app-muted text-sm">
                    {job.date_applied
                      ? new Date(job.date_applied).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell className="py-2">
                    {job.url ? (() => {
                      const href = getSafeHref(job.url);
                      const label = getHostname(job.url);
                      if (!href) {
                        return <span className="app-subtle text-xs truncate max-w-[180px] block">{label}</span>;
                      }

                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-600 hover:underline text-xs truncate max-w-[180px] block"
                        >
                          {label}
                        </a>
                      );
                    })() : (
                      <span className="app-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEditJob(job)}
                        className="app-subtle hover:text-indigo-500 p-1 rounded-md hover:bg-[var(--app-hover)]"
                        aria-label="Edit job"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteJob(job.id)}
                        className="app-subtle hover:text-red-400 p-1 rounded-md hover:bg-[var(--app-hover)]"
                        aria-label="Delete job"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
