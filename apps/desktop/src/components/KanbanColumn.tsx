import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Job, JobStatus } from '@job-logger/shared';
import { JobCard } from './JobCard';

interface KanbanColumnProps {
  id: JobStatus;
  label: string;
  jobs: Job[];
  onCardClick: (job: Job) => void;
}

const columnColors: Record<JobStatus, string> = {
  wishlist: 'border-t-gray-400',
  applied: 'border-t-blue-500',
  interviewing: 'border-t-amber-500',
  negotiating: 'border-t-purple-500',
  closed: 'border-t-green-500',
};

export function KanbanColumn({ id, label, jobs, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-64 min-w-[256px] bg-gray-50 rounded-lg border-t-4 ${columnColors[id]} ${
        isOver ? 'bg-indigo-50' : ''
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
          {jobs.length}
        </span>
      </div>
      <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1 min-h-[400px] overflow-y-auto">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onClick={onCardClick} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
