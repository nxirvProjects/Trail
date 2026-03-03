import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import type { RoadmapLink } from '@job-logger/shared';

export function useRoadmapLinks(roadmapId: string | null) {
  const [links, setLinks] = useState<RoadmapLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roadmapId) {
      setLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from('roadmap_links')
      .select('*')
      .eq('roadmap_id', roadmapId)
      .then(({ data }) => {
        setLinks(data ?? []);
        setLoading(false);
      });
  }, [roadmapId]);

  useEffect(() => {
    if (!roadmapId) return;

    const channel = supabase
      .channel(`roadmap-links-realtime-${roadmapId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'roadmap_links', filter: `roadmap_id=eq.${roadmapId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLinks((prev) => {
              const inserted = payload.new as RoadmapLink;
              if (prev.some((l) => l.id === inserted.id)) return prev;
              return [...prev, inserted];
            });
          } else if (payload.eventType === 'UPDATE') {
            setLinks((prev) => prev.map((l) => (l.id === (payload.new as RoadmapLink).id ? (payload.new as RoadmapLink) : l)));
          } else if (payload.eventType === 'DELETE') {
            setLinks((prev) => prev.filter((l) => l.id !== (payload.old as { id: string }).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roadmapId]);

  const addLink = useCallback(async (fromColumnId: string, toColumnId: string) => {
    if (!roadmapId || !fromColumnId || !toColumnId || fromColumnId === toColumnId) {
      return { data: null, error: null };
    }

    const exists = links.some(
      (link) => link.from_column_id === fromColumnId && link.to_column_id === toColumnId
    );
    if (exists) return { data: null, error: null };

    const { data, error } = await supabase
      .from('roadmap_links')
      .insert({ roadmap_id: roadmapId, from_column_id: fromColumnId, to_column_id: toColumnId, label: '' })
      .select()
      .single();

    if (!error && data) {
      setLinks((prev) => {
        if (prev.some((l) => l.id === data.id)) return prev;
        return [...prev, data];
      });
    }

    return { data, error };
  }, [roadmapId, links]);

  const deleteLink = useCallback(async (id: string) => {
    const { error } = await supabase.from('roadmap_links').delete().eq('id', id);
    if (!error) {
      setLinks((prev) => prev.filter((l) => l.id !== id));
    }
    return { error };
  }, []);

  return { links, loading, addLink, deleteLink };
}
