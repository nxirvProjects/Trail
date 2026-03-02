import { useState, useEffect, type FormEvent } from 'react';
import type { Job, JobStatus } from '@job-logger/shared';
import { KANBAN_COLUMNS } from '@job-logger/shared';

interface JobCardModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Job>) => Promise<{ error: unknown }>;
  onCreate: (job: {
    company_name: string;
    role_title: string;
    status?: JobStatus;
    notes?: string;
    url?: string;
    date_applied?: string | null;
  }) => Promise<unknown>;
  mode: 'edit' | 'create';
}

export function JobCardModal({ job, isOpen, onClose, onSave, onCreate, mode }: JobCardModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [status, setStatus] = useState<JobStatus>('applied');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dateApplied, setDateApplied] = useState('');
  const [saving, setSaving] = useState(false);

  const normalizeUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (job && mode === 'edit') {
      setCompanyName(job.company_name);
      setRoleTitle(job.role_title);
      setStatus(job.status);
      setNotes(job.notes);
      setUrl(job.url);
      setUrlError(null);
      setDateApplied(job.date_applied ?? '');
    } else if (mode === 'create') {
      setCompanyName('');
      setRoleTitle('');
      setStatus('applied');
      setNotes('');
      setUrl('');
      setUrlError(null);
      setDateApplied('');
    }
  }, [job, mode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const normalizedUrl = normalizeUrl(url);
    if (normalizedUrl === null) {
      setUrlError('Enter a valid URL, e.g. https://example.com/job');
      setSaving(false);
      return;
    }

    const data = {
      company_name: companyName,
      role_title: roleTitle,
      status,
      notes,
      url: normalizedUrl,
      date_applied: dateApplied || null,
    };
    if (mode === 'edit' && job) {
      await onSave(job.id, data);
    } else {
      await onCreate(data);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="app-overlay fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--app-border)]">
          <h2 className="text-lg font-semibold app-text">
            {mode === 'create' ? 'Add Job' : 'Edit Job'}
          </h2>
          <button onClick={onClose} className="app-subtle hover:text-[var(--app-text)] text-xl leading-none">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium app-muted mb-1">Role Title *</label>
              <input
                type="text"
                required
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Software Engineer"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium app-muted mb-1">Company *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Acme Inc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium app-muted mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>{col.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium app-muted mb-1">Date Applied</label>
              <input
                type="date"
                value={dateApplied}
                onChange={(e) => setDateApplied(e.target.value)}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium app-muted mb-1">URL</label>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {urlError && <p className="mt-1 text-xs text-red-600">{urlError}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium app-muted mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="app-input w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Any notes about this application..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[var(--app-border)]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm app-muted hover:bg-[var(--app-hover)] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Add Job' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
