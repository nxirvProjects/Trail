import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Job } from '@job-logger/shared';

interface JobCardProps {
  job: Job;
  onClick: (job: Job) => void;
  isDragOverlay?: boolean;
}

export function JobCard({ job, onClick, isDragOverlay }: JobCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id, data: { job } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={() => onClick(job)}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragOverlay ? 'shadow-lg ring-2 ring-indigo-400' : ''
      }`}
    >
      <h3 className="text-sm font-semibold text-gray-900 truncate">{job.role_title}</h3>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{job.company_name}</p>
      <div className="flex items-center gap-2 mt-2">
        {job.date_applied && (
          <span className="text-xs text-gray-400">
            {new Date(job.date_applied).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}
