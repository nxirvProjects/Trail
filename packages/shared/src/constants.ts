import type { JobStatus } from './types';

export const KANBAN_COLUMNS: { id: JobStatus; label: string }[] = [
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'closed', label: 'Closed' },
];
