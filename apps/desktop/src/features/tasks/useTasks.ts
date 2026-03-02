import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { Task } from '@job-logger/shared';

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .then(({ data }) => {
        setTasks(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks((prev) => {
            if (prev.some((t) => t.id === (payload.new as Task).id)) return prev;
            return [...prev, payload.new as Task];
          });
        } else if (payload.eventType === 'UPDATE') {
          setTasks((prev) => prev.map((t) => t.id === (payload.new as Task).id ? payload.new as Task : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as { id: string }).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const addTask = useCallback(async (columnId: string, title: string) => {
    if (!userId) return;
    const colTasks = tasks.filter((t) => t.column_id === columnId);
    const maxPos = colTasks.reduce((max, t) => Math.max(max, t.position), -1);
    const { data } = await supabase
      .from('tasks')
      .insert({ user_id: userId, column_id: columnId, title, position: maxPos + 1, notes: '' })
      .select()
      .single();
    if (data) setTasks((prev) => [...prev, data]);
  }, [userId, tasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    await supabase.from('tasks').update(updates).eq('id', id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const moveTask = useCallback(async (id: string, newColumnId: string, newPosition: number) => {
    await supabase.from('tasks').update({ column_id: newColumnId, position: newPosition }).eq('id', id);
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, column_id: newColumnId, position: newPosition } : t));
  }, []);

  const replaceTasks = useCallback((nextTasks: Task[]) => {
    setTasks(nextTasks);
  }, []);

  const persistTaskOrder = useCallback(async (updates: Array<Pick<Task, 'id' | 'column_id' | 'position'>>) => {
    if (updates.length === 0) return;

    await Promise.all(
      updates.map((task) =>
        supabase
          .from('tasks')
          .update({ column_id: task.column_id, position: task.position })
          .eq('id', task.id)
      )
    );
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, loading, addTask, updateTask, moveTask, replaceTasks, persistTaskOrder, deleteTask };
}
