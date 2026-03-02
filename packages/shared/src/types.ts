export type JobStatus = 'wishlist' | 'applied' | 'interviewing' | 'negotiating' | 'closed';

export interface Job {
  id: string;
  user_id: string;
  company_name: string;
  role_title: string;
  status: JobStatus;
  notes: string;
  url: string;
  date_applied: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface JobInsert {
  company_name: string;
  role_title: string;
  status?: JobStatus;
  notes?: string;
  url?: string;
  date_applied?: string | null;
  position?: number;
}

export interface Contact {
  id: string;
  user_id: string;
  job_id: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  company: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  job_id: string;
  content: string;
  created_at: string;
}

export interface TaskColumn {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  column_id: string;
  title: string;
  notes: string;
  position: number;
  created_at: string;
  updated_at: string;
}