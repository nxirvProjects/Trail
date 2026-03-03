import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { RoadmapLink, Task } from '@job-logger/shared';
import { Plus } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { useTaskColumns } from './useTaskColumns';
import { useTasks } from './useTasks';
import { useRoadmaps } from './useRoadmaps';
import { useRoadmapLinks } from './useRoadmapLinks';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';

interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

interface LinkGeometry {
  link: RoadmapLink;
  path: string;
}

interface LinkDragState {
  sourceColumnId: string;
  cursorX: number;
  cursorY: number;
}

interface TaskBoardProps {
  onRoadmapTitleChange?: (title: string) => void;
}

function TaskBoardSkeleton() {
  return (
    <div className="relative mb-1 flex-1 overflow-hidden rounded-xl border canvas-board">
      <div className="h-full w-full p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TaskBoard({ onRoadmapTitleChange }: TaskBoardProps) {
  const { user } = useAuth();
  const { roadmaps, loading: roadmapLoading, addRoadmap, deleteRoadmapIfEmpty, deleteRoadmapCascade } = useRoadmaps(user?.id);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);
  const { links, loading: linksLoading, addLink, deleteLink } = useRoadmapLinks(selectedRoadmapId);
  const {
    columns,
    loading: colLoading,
    addColumn,
    renameColumn,
    updateColumnType,
    deleteColumn,
    replaceColumns,
    moveColumnTo,
  } = useTaskColumns(user?.id, selectedRoadmapId);
  const { tasks, loading: taskLoading, addTask, deleteTask, replaceTasks, persistTaskOrder } = useTasks(user?.id);

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dragTasks, setDragTasks] = useState<Task[] | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState<'active' | 'completed'>('active');
  const [addingRoadmap, setAddingRoadmap] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState('');
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [roadmapsDrawerOpen, setRoadmapsDrawerOpen] = useState(false);
  const [cascadeDeleteRoadmapId, setCascadeDeleteRoadmapId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ x: 80, y: 80, scale: 1 });
  const [linkDrag, setLinkDrag] = useState<LinkDragState | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{ linkId: string; x: number; y: number } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const columnElementsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const columnsRef = useRef(columns);
  const viewportScaleRef = useRef(viewport.scale);
  const creatingDefaultRoadmapRef = useRef(false);
  const panStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const columnDragRef = useRef<{
    pointerId: number;
    columnId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const linkDragRef = useRef<{
    pointerId: number;
    sourceColumnId: string;
  } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    viewportScaleRef.current = viewport.scale;
  }, [viewport.scale]);

  useEffect(() => {
    if (selectedRoadmapId && roadmaps.some((roadmap) => roadmap.id === selectedRoadmapId)) return;
    if (roadmaps.length > 0) {
      setSelectedRoadmapId(roadmaps[0].id);
    } else {
      setSelectedRoadmapId(null);
    }
  }, [roadmaps, selectedRoadmapId]);

  useEffect(() => {
    if (roadmapLoading || !user?.id) return;
    if (roadmaps.length > 0 || creatingDefaultRoadmapRef.current) return;

    creatingDefaultRoadmapRef.current = true;
    addRoadmap('Main').finally(() => {
      creatingDefaultRoadmapRef.current = false;
    });
  }, [roadmapLoading, roadmaps, addRoadmap, user?.id]);

  const visibleColumns = columns;
  const visibleTasks = dragTasks ?? tasks;
  const selectedRoadmap = roadmaps.find((roadmap) => roadmap.id === selectedRoadmapId) ?? null;

  useEffect(() => {
    onRoadmapTitleChange?.(selectedRoadmap?.name ?? 'Roadmap');
  }, [onRoadmapTitleChange, selectedRoadmap?.name]);

  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of visibleColumns) map[col.id] = [];
    for (const task of visibleTasks) {
      if (map[task.column_id]) map[task.column_id].push(task);
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [visibleColumns, visibleTasks]);

  const visibleColumnIds = useMemo(() => new Set(visibleColumns.map((column) => column.id)), [visibleColumns]);
  const visibleLinks = useMemo(
    () => links.filter((link) => visibleColumnIds.has(link.from_column_id) && visibleColumnIds.has(link.to_column_id)),
    [links, visibleColumnIds]
  );

  const buildLinkPath = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const distance = Math.max(60, Math.abs(toX - fromX) * 0.45);
      const c1x = fromX + (toX >= fromX ? distance : -distance);
      const c2x = toX + (toX >= fromX ? -distance : distance);
      return {
        path: `M ${fromX} ${fromY} C ${c1x} ${fromY}, ${c2x} ${toY}, ${toX} ${toY}`,
        c1x,
        c2x,
      };
    },
    []
  );

  const linkGeometry = useMemo<LinkGeometry[]>(() => {
    const byId = new Map(visibleColumns.map((column) => [column.id, column]));

    return visibleLinks.flatMap((link) => {
      const source = byId.get(link.from_column_id);
      const target = byId.get(link.to_column_id);
      if (!source || !target) return [];

      const sourceHeight = columnElementsRef.current[source.id]?.offsetHeight ?? 220;
      const targetHeight = columnElementsRef.current[target.id]?.offsetHeight ?? 220;

      const forward = target.x >= source.x;
      const fromX = forward ? source.x + 246 : source.x - 6;
      const fromY = source.y + sourceHeight / 2;
      const toX = forward ? target.x - 14 : target.x + 246 + 8;
      const toY = target.y + targetHeight / 2;

      return [{ link, path: buildLinkPath(fromX, fromY, toX, toY).path }];
    });
  }, [visibleColumns, visibleLinks, buildLinkPath]);

  const previewLinkPath = useMemo(() => {
    if (!linkDrag) return null;
    const source = visibleColumns.find((column) => column.id === linkDrag.sourceColumnId);
    if (!source) return null;

    const sourceHeight = columnElementsRef.current[source.id]?.offsetHeight ?? 220;
    const forward = linkDrag.cursorX >= source.x;
    const fromX = forward ? source.x + 246 : source.x - 6;
    const fromY = source.y + sourceHeight / 2;

    return buildLinkPath(fromX, fromY, linkDrag.cursorX, linkDrag.cursorY).path;
  }, [linkDrag, visibleColumns, buildLinkPath]);

  const registerColumnElement = useCallback((columnId: string, element: HTMLDivElement | null) => {
    columnElementsRef.current[columnId] = element;
  }, []);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const boardRect = boardRef.current?.getBoundingClientRect();
      if (!boardRect) return { x: 0, y: 0 };

      return {
        x: (clientX - boardRect.left - viewport.x) / viewport.scale,
        y: (clientY - boardRect.top - viewport.y) / viewport.scale,
      };
    },
    [viewport.x, viewport.y, viewport.scale]
  );

  const reorderTasksForDrag = (sourceTasks: Task[], activeId: string, overId: string): Task[] => {
    if (activeId === overId) return sourceTasks;

    const active = sourceTasks.find((t) => t.id === activeId);
    if (!active) return sourceTasks;

    const overTask = sourceTasks.find((t) => t.id === overId);
    const targetColumnId = overTask ? overTask.column_id : overId;
    const columnExists = visibleColumns.some((c) => c.id === targetColumnId);
    if (!columnExists) return sourceTasks;

    const withoutActive = sourceTasks.filter((t) => t.id !== activeId);
    const targetTasks = withoutActive
      .filter((t) => t.column_id === targetColumnId)
      .sort((a, b) => a.position - b.position);

    const insertionIndex = overTask ? targetTasks.findIndex((t) => t.id === overTask.id) : targetTasks.length;
    const movedTask: Task = { ...active, column_id: targetColumnId };
    const nextTargetTasks = [...targetTasks];
    nextTargetTasks.splice(insertionIndex >= 0 ? insertionIndex : nextTargetTasks.length, 0, movedTask);

    const updates = new Map<string, Pick<Task, 'column_id' | 'position'>>();
    nextTargetTasks.forEach((task, index) => {
      updates.set(task.id, { column_id: targetColumnId, position: index });
    });

    if (active.column_id !== targetColumnId) {
      const sourceColumnTasks = withoutActive
        .filter((t) => t.column_id === active.column_id)
        .sort((a, b) => a.position - b.position);

      sourceColumnTasks.forEach((task, index) => {
        updates.set(task.id, { column_id: active.column_id, position: index });
      });
    }

    const base = [...withoutActive, movedTask];
    return base.map((task) => {
      const next = updates.get(task.id);
      return next ? { ...task, ...next } : task;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
    setDragTasks(tasks);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    setDragTasks((prev) => {
      const base = prev ?? tasks;
      return reorderTasksForDrag(base, String(active.id), String(over.id));
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    const base = dragTasks ?? tasks;
    const finalTasks = over ? reorderTasksForDrag(base, String(active.id), String(over.id)) : base;

    setDragTasks(null);
    replaceTasks(finalTasks);

    const previousById = new Map(tasks.map((task) => [task.id, task]));
    const changed = finalTasks
      .filter((task) => {
        const previous = previousById.get(task.id);
        return !!previous && (previous.column_id !== task.column_id || previous.position !== task.position);
      })
      .map((task) => ({ id: task.id, column_id: task.column_id, position: task.position }));

    await persistTaskOrder(changed);
  };

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (columnDragRef.current || linkDragRef.current || linkContextMenu) return;
    if ((event.target as HTMLElement).closest('[data-column-root="true"]')) return;

    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panStateRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    const { originX, originY } = pan;
    setViewport((prev) => ({ ...prev, x: originX + dx, y: originY + dy }));
  };

  const handleBoardPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current || panStateRef.current.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheelZoom = useCallback((event: WheelEvent) => {
    if (event.cancelable) event.preventDefault();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;

    const factor = event.deltaY > 0 ? 0.92 : 1.08;
    const nextScale = Math.min(2.2, Math.max(0.5, viewport.scale * factor));
    if (nextScale === viewport.scale) return;

    const pointerX = event.clientX - boardRect.left;
    const pointerY = event.clientY - boardRect.top;
    const worldX = (pointerX - viewport.x) / viewport.scale;
    const worldY = (pointerY - viewport.y) / viewport.scale;

    setViewport({
      scale: nextScale,
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale,
    });
  }, [viewport.x, viewport.y, viewport.scale]);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    board.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      board.removeEventListener('wheel', handleWheelZoom);
    };
  }, [handleWheelZoom]);

  const onGlobalPointerMove = useCallback((event: PointerEvent) => {
    if (!columnDragRef.current || columnDragRef.current.pointerId !== event.pointerId) return;

    const scale = viewportScaleRef.current;
    const dx = (event.clientX - columnDragRef.current.startX) / scale;
    const dy = (event.clientY - columnDragRef.current.startY) / scale;
    const x = columnDragRef.current.originX + dx;
    const y = columnDragRef.current.originY + dy;

    const base = columnsRef.current;
    replaceColumns(base.map((column) => (column.id === columnDragRef.current!.columnId ? { ...column, x, y } : column)));
  }, [replaceColumns]);

  const onGlobalPointerUp = useCallback(async (event: PointerEvent) => {
    if (!columnDragRef.current || columnDragRef.current.pointerId !== event.pointerId) return;

    const scale = viewportScaleRef.current;
    const dx = (event.clientX - columnDragRef.current.startX) / scale;
    const dy = (event.clientY - columnDragRef.current.startY) / scale;
    const x = columnDragRef.current.originX + dx;
    const y = columnDragRef.current.originY + dy;

    const columnId = columnDragRef.current.columnId;
    columnDragRef.current = null;
    window.removeEventListener('pointermove', onGlobalPointerMove);
    window.removeEventListener('pointerup', onGlobalPointerUp);

    await moveColumnTo(columnId, x, y);
  }, [moveColumnTo, onGlobalPointerMove]);

  const onLinkDragMove = useCallback((event: PointerEvent) => {
    if (!linkDragRef.current || linkDragRef.current.pointerId !== event.pointerId) return;

    const world = clientToWorld(event.clientX, event.clientY);
    setLinkDrag({ sourceColumnId: linkDragRef.current.sourceColumnId, cursorX: world.x, cursorY: world.y });
  }, [clientToWorld]);

  const onLinkDragEnd = useCallback(async (event: PointerEvent) => {
    if (!linkDragRef.current || linkDragRef.current.pointerId !== event.pointerId) return;

    const sourceColumnId = linkDragRef.current.sourceColumnId;
    linkDragRef.current = null;
    setLinkDrag(null);

    window.removeEventListener('pointermove', onLinkDragMove);
    window.removeEventListener('pointerup', onLinkDragEnd);

    const targetColumn = columnsRef.current.find((column) => {
      const element = columnElementsRef.current[column.id];
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });

    if (!targetColumn || targetColumn.id === sourceColumnId) return;
    await addLink(sourceColumnId, targetColumn.id);
  }, [addLink, onLinkDragMove]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onGlobalPointerMove);
      window.removeEventListener('pointerup', onGlobalPointerUp);
    };
  }, [onGlobalPointerMove, onGlobalPointerUp]);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onLinkDragMove);
      window.removeEventListener('pointerup', onLinkDragEnd);
    };
  }, [onLinkDragMove, onLinkDragEnd]);

  const handleStartColumnDrag = (event: ReactPointerEvent<HTMLElement>, columnId: string) => {
    if (event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();

    const column = columns.find((item) => item.id === columnId);
    if (!column) return;

    columnDragRef.current = {
      pointerId: event.pointerId,
      columnId,
      startX: event.clientX,
      startY: event.clientY,
      originX: column.x,
      originY: column.y,
    };

    window.addEventListener('pointermove', onGlobalPointerMove);
    window.addEventListener('pointerup', onGlobalPointerUp);
  };

  const handleStartLinkDrag = (event: ReactPointerEvent<HTMLButtonElement>, columnId: string) => {
    if (event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();

    const world = clientToWorld(event.clientX, event.clientY);
    linkDragRef.current = { pointerId: event.pointerId, sourceColumnId: columnId };
    setLinkDrag({ sourceColumnId: columnId, cursorX: world.x, cursorY: world.y });

    window.addEventListener('pointermove', onLinkDragMove);
    window.addEventListener('pointerup', onLinkDragEnd);
  };

  useEffect(() => {
    if (!linkContextMenu) return;

    const closeMenu = () => setLinkContextMenu(null);
    window.addEventListener('pointerdown', closeMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
    };
  }, [linkContextMenu]);

  const handleAddColumn = () => {
    if (newColumnName.trim()) {
      addColumn(newColumnName.trim(), newColumnType);
      setNewColumnName('');
      setNewColumnType('active');
      setAddingColumn(false);
    }
  };

  const handleAddRoadmap = async () => {
    const name = newRoadmapName.trim();
    if (!name) return;

    const { data, error } = await addRoadmap(name);
    if (!error && data) {
      setSelectedRoadmapId(data.id);
      setNewRoadmapName('');
      setAddingRoadmap(false);
      setRoadmapError(null);
    }
  };

  const handleDeleteRoadmap = async (roadmapId: string | null = selectedRoadmapId) => {
    if (!roadmapId) return;
    const { error } = await deleteRoadmapIfEmpty(roadmapId);
    if (error) {
      setRoadmapError(error.message || 'Roadmap must be empty before deleting.');
      return;
    }

    setRoadmapError(null);
    if (selectedRoadmapId === roadmapId) {
      setSelectedRoadmapId(null);
    }
  };

  const handleDeleteRoadmapCascade = async (roadmapId: string | null) => {
    if (!roadmapId) return;
    const { error } = await deleteRoadmapCascade(roadmapId);
    if (error) {
      setRoadmapError(error.message || 'Failed to delete roadmap.');
      return;
    }

    setRoadmapError(null);
    setCascadeDeleteRoadmapId(null);
    if (selectedRoadmapId === roadmapId) {
      setSelectedRoadmapId(null);
    }
  };

  if (roadmapLoading || colLoading || taskLoading || linksLoading) {
    return <TaskBoardSkeleton />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveTask(null);
        setDragTasks(null);
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setRoadmapsDrawerOpen(true)}>Roadmaps</Button>
        <Button size="sm" variant="outline" onClick={() => setViewport({ x: 80, y: 80, scale: 1 })}>Reset view</Button>
      </div>

      {addingColumn && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <input
            value={newColumnName}
            onChange={(event) => setNewColumnName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAddColumn();
            }}
            placeholder="Column name"
            className="app-input h-9 rounded-lg px-3 text-sm"
          />
          <select
            value={newColumnType}
            onChange={(event) => setNewColumnType(event.target.value as 'active' | 'completed')}
            className="app-input h-9 rounded-lg px-3 text-sm"
          >
            <option value="active">Active column</option>
            <option value="completed">Slash Out column</option>
          </select>
          <Button size="sm" onClick={handleAddColumn}>Add column</Button>

          <Button size="sm" variant="ghost" onClick={() => { setAddingColumn(false); }}>
            Cancel
          </Button>
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setAddingColumn((value) => !value)}>+ Add column</Button>
        <Button size="sm" variant="outline" onClick={() => setViewport((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale - 0.1) }))}>-</Button>
        <span className="text-xs app-subtle w-14 text-center">{Math.round(viewport.scale * 100)}%</span>
        <Button size="sm" variant="outline" onClick={() => setViewport((prev) => ({ ...prev, scale: Math.min(2.2, prev.scale + 0.1) }))}>+</Button>
      </div>

      <div
        className={`fixed inset-0 z-50 transition-opacity duration-200 ${
          roadmapsDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 bg-black/45" onClick={() => setRoadmapsDrawerOpen(false)} />
        <aside
          className={`absolute right-0 top-0 h-full w-[360px] app-surface-elevated border-l border-[var(--app-border)] shadow-2xl p-4 overflow-y-auto transition-transform duration-200 ease-out ${
            roadmapsDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold app-text">Roadmaps</h3>
              <button
                type="button"
                title="Add roadmap"
                onClick={() => setAddingRoadmap((value) => !value)}
                className="h-9 w-9 rounded-lg border border-[var(--app-border)] app-muted hover:bg-[var(--app-hover)] flex items-center justify-center"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {addingRoadmap && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  autoFocus
                  value={newRoadmapName}
                  onChange={(event) => setNewRoadmapName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddRoadmap();
                    if (event.key === 'Escape') {
                      setAddingRoadmap(false);
                      setNewRoadmapName('');
                    }
                  }}
                  placeholder="Roadmap name"
                  className="app-input h-9 rounded-lg px-3 text-sm flex-1"
                />
                <Button size="sm" onClick={handleAddRoadmap}>Save</Button>
              </div>
            )}

            <div className="space-y-2">
              {roadmaps.map((roadmap) => (
                <div
                  key={roadmap.id}
                  className={`rounded-lg border p-2 ${
                    roadmap.id === selectedRoadmapId
                      ? 'border-indigo-400/40 bg-indigo-500/10'
                      : 'border-[var(--app-border)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoadmapId(roadmap.id);
                      setRoadmapsDrawerOpen(false);
                    }}
                    className="w-full text-left"
                  >
                    <p className="text-sm app-text truncate">{roadmap.name}</p>
                    <p className="text-xs app-subtle mt-0.5">
                      {roadmap.id === selectedRoadmapId ? 'Active roadmap' : 'Click to switch'}
                    </p>
                  </button>

                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await handleDeleteRoadmap(roadmap.id);
                      }}
                    >
                      Delete (empty)
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setCascadeDeleteRoadmapId(roadmap.id)}
                    >
                      Delete + items
                    </Button>
                  </div>
                </div>
              ))}
            </div>
        </aside>
      </div>

      {cascadeDeleteRoadmapId && (
        <div className="app-overlay fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setCascadeDeleteRoadmapId(null)}>
          <div className="app-surface-elevated rounded-xl border shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--app-border)]">
              <h2 className="text-lg font-semibold app-text">Delete roadmap with all items?</h2>
              <p className="text-sm app-muted mt-1">
                This permanently deletes this roadmap, its columns, tasks, and links.
              </p>
            </div>
            <div className="p-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCascadeDeleteRoadmapId(null)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteRoadmapCascade(cascadeDeleteRoadmapId)}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}

      {roadmapError && (
        <div className="mb-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {roadmapError}
        </div>
      )}

      <div
        ref={boardRef}
        className="relative flex-1 overflow-hidden rounded-xl border canvas-board mb-1"
        style={{ touchAction: 'none' }}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerUp}
      >
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0' }}
        >
          <div className="relative" style={{ width: 5200, height: 3600 }}>
            <svg className="absolute inset-0 h-full w-full z-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="roadmap-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8" />
                </marker>
              </defs>

              {linkGeometry.map(({ link, path }) => (
                <g key={link.id}>
                  <path
                    id={`roadmap-link-${link.id}`}
                    d={path}
                    fill="none"
                    stroke={hoveredLinkId === link.id ? 'rgba(165, 180, 252, 1)' : 'rgba(129, 140, 248, 0.8)'}
                    strokeWidth={hoveredLinkId === link.id ? '2.8' : '2'}
                    markerEnd="url(#roadmap-arrow)"
                  />
                  <circle r="3" fill="#a5b4fc">
                    <animateMotion dur="2.3s" repeatCount="indefinite" rotate="auto">
                      <mpath href={`#roadmap-link-${link.id}`} />
                    </animateMotion>
                  </circle>
                </g>
              ))}

              {previewLinkPath && (
                <path
                  d={previewLinkPath}
                  fill="none"
                  stroke="rgba(129, 140, 248, 0.9)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  markerEnd="url(#roadmap-arrow)"
                />
              )}
            </svg>

            <svg className="absolute inset-0 h-full w-full z-20" xmlns="http://www.w3.org/2000/svg">
              {linkGeometry.map(({ link, path }) => (
                <path
                  key={`hit-${link.id}`}
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  style={{ pointerEvents: 'stroke', cursor: 'context-menu' }}
                  onPointerEnter={() => setHoveredLinkId(link.id)}
                  onPointerLeave={() => setHoveredLinkId((prev) => (prev === link.id ? null : prev))}
                  onContextMenu={(event) => {
                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation();
                    setHoveredLinkId(link.id);
                    setLinkContextMenu({ linkId: link.id, x: event.clientX, y: event.clientY });
                  }}
                />
              ))}
            </svg>

            {visibleColumns.map((col) => (
              <div key={col.id} data-column-root="true" className="absolute z-40" style={{ left: col.x, top: col.y }}>
                <TaskColumn
                  column={col}
                  tasks={tasksByColumn[col.id] ?? []}
                  onTaskClick={() => {}}
                  onAddTask={addTask}
                  onRename={renameColumn}
                  onColumnTypeChange={updateColumnType}
                  onDeleteTask={deleteTask}
                  onStartLinkDrag={handleStartLinkDrag}
                  linkingSourceColumnId={linkDrag?.sourceColumnId ?? null}
                  onRegisterColumnElement={registerColumnElement}
                  onStartColumnDrag={handleStartColumnDrag}
                  onDelete={deleteColumn}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {linkContextMenu && (
        <div
          className="fixed z-[70] min-w-[160px] rounded-md border border-[var(--app-border)] bg-[var(--app-popover)] p-1 shadow-md"
          style={{ left: linkContextMenu.x, top: linkContextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-2 py-1.5 text-sm text-red-400 rounded-sm hover:bg-[var(--app-hover)]"
            onClick={async () => {
              await deleteLink(linkContextMenu.linkId);
              setLinkContextMenu(null);
              setHoveredLinkId(null);
            }}
          >
            Delete link
          </button>
        </div>
      )}

      <DragOverlay>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            onClick={() => {}}
            isDragOverlay
            isCompletedColumn={visibleColumns.find((col) => col.id === activeTask.column_id)?.column_type === 'completed'}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
