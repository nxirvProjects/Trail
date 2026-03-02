import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Job, JobStatus } from '@job-logger/shared';

export interface JobInsert {
  company_name: string;
  role_title: string;
  status?: JobStatus;
  notes?: string;
  url?: string;
  date_applied?: string | null;
}

export function useJobs(userId: string | undefined) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .order('position', { ascending: true });
      setJobs(data ?? []);
      setLoading(false);
    };
    fetchJobs();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => {
              if (prev.some((j) => j.id === (payload.new as Job).id)) return prev;
              return [...prev, payload.new as Job];
            });
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((j) => (j.id === (payload.new as Job).id ? (payload.new as Job) : j))
            );
          } else if (payload.eventType === 'DELETE') {
            setJobs((prev) => prev.filter((j) => j.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addJob = useCallback(
    async (job: JobInsert) => {
      if (!userId) return;
      const maxPos = jobs
        .filter((j) => j.status === (job.status ?? 'applied'))
        .reduce((max, j) => Math.max(max, j.position), -1);

      const { data, error } = await supabase
        .from('jobs')
        .insert({ ...job, status: job.status ?? 'applied', user_id: userId, position: maxPos + 1 })
        .select()
        .single();

      if (!error && data) {
        setJobs((prev) => {
          if (prev.some((j) => j.id === data.id)) return prev;
          return [...prev, data];
        });
      }
      return { data, error };
    },
    [userId, jobs]
  );

  const updateJob = useCallback(async (id: string, updates: Partial<Job>) => {
    const { error } = await supabase.from('jobs').update(updates).eq('id', id);
    if (!error) {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
    }
    return { error };
  }, []);

  const moveJob = useCallback(
    async (id: string, newStatus: JobStatus, newPosition: number) => {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus, position: newPosition })
        .eq('id', id);
      if (!error) {
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: newStatus, position: newPosition } : j))
        );
      }
    },
    []
  );

  const deleteJob = useCallback(async (id: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (!error) {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    }
    return { error };
  }, []);

  return { jobs, loading, addJob, updateJob, moveJob, deleteJob };
}
