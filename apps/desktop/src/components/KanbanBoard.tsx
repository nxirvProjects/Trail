import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import type { Job, JobStatus } from '@job-logger/shared';
import { KANBAN_COLUMNS } from '@job-logger/shared';
import { KanbanColumn } from './KanbanColumn';
import { JobCard } from './JobCard';
import { JobCardModal } from './JobCardModal';
import { useJobs, type JobInsert } from '../hooks/useJobs';
import { useAuth } from '../hooks/useAuth';

export function KanbanBoard() {
  const { user } = useAuth();
  const { jobs, loading, addJob, updateJob, moveJob } = useJobs(user?.id);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const jobsByColumn = useMemo(() => {
    const map: Record<JobStatus, Job[]> = {
      wishlist: [],
      applied: [],
      interviewing: [],
      negotiating: [],
      closed: [],
    };
    for (const job of jobs) {
      map[job.status]?.push(job);
    }
    for (const key of Object.keys(map) as JobStatus[]) {
      map[key].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [jobs]);

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find((j) => j.id === event.active.id);
    setActiveJob(job ?? null);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by KanbanColumn's isOver
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveJob(null);
    const { active, over } = event;
    if (!over) return;

    const draggedJob = jobs.find((j) => j.id === active.id);
    if (!draggedJob) return;

    // Determine target column: either the column itself or the column of the card we're over
    let targetColumn: JobStatus;
    const overJob = jobs.find((j) => j.id === over.id);
    if (overJob) {
      targetColumn = overJob.status;
    } else {
      targetColumn = over.id as JobStatus;
    }

    const columnJobs = jobsByColumn[targetColumn].filter((j) => j.id !== draggedJob.id);

    let newPosition: number;
    if (overJob) {
      const overIndex = columnJobs.findIndex((j) => j.id === overJob.id);
      newPosition = overIndex >= 0 ? overIndex : columnJobs.length;
    } else {
      newPosition = columnJobs.length;
    }

    moveJob(draggedJob.id, targetColumn, newPosition);
  };

  const handleCardClick = (job: Job) => {
    setSelectedJob(job);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleAddJob = () => {
    setSelectedJob(null);
    setModalMode('create');
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
        <button
          onClick={handleAddJob}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5"
        >
          <span className="text-lg leading-none">+</span> Add Job
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              jobs={jobsByColumn[col.id]}
              onCardClick={handleCardClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeJob ? (
            <JobCard job={activeJob} onClick={() => {}} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <JobCardModal
        job={selectedJob}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={async (id, updates) => {
          const result = await updateJob(id, updates);
          return { error: result.error };
        }}
        onCreate={async (job: JobInsert) => {
          return await addJob(job);
        }}
        mode={modalMode}
      />
    </>
  );
}
