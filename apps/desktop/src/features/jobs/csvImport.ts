import type { Job, JobInsert, JobStatus } from '@job-logger/shared';

type CsvRow = Record<string, string>;

export interface ParsedCsvJob {
  job: JobInsert;
  dedupeBaseKey: string;
  dedupeDayKey: string;
  timestampMs: number | null;
  rowNumber: number;
  swapped: boolean;
  cleaned: boolean;
}

export interface ParsedCsvResult {
  candidates: ParsedCsvJob[];
  skippedInvalid: number;
}

const ROLE_HINT = /\b(engineer|developer|manager|intern|graduate|new grad|qa|swe|full stack|backend|frontend|product)\b/i;
const NOISE_PHRASE = /(thank you for applying|application successful|confirmation|success\b)/i;

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  return dataRows
    .filter((r) => r.some((c) => c.trim().length > 0))
    .map((r) => {
      const mapped: CsvRow = {};
      headers.forEach((header, index) => {
        mapped[header] = (r[index] ?? '').trim();
      });
      return mapped;
    });
}

function getField(row: CsvRow, names: string[]): string {
  for (const name of names) {
    if (row[name] && row[name].trim()) return row[name].trim();
  }
  return '';
}

function normalizeStatus(raw: string): JobStatus {
  const value = raw.trim().toLowerCase();
  if (value === 'wishlist' || value === 'applied' || value === 'interviewing' || value === 'negotiating' || value === 'closed') {
    return value;
  }
  return 'applied';
}

function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseTimestampMs(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function minuteBucket(timestampMs: number | null): string {
  if (timestampMs == null) return '';
  return String(Math.floor(timestampMs / 60000));
}

function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function cleanCompanyRole(companyRaw: string, roleRaw: string): { company: string; role: string; swapped: boolean; cleaned: boolean } {
  let company = companyRaw.trim();
  let role = roleRaw.trim();
  let swapped = false;
  let cleaned = false;

  const originalCompany = company;
  const originalRole = role;

  role = role.replace(/^job\s+application\s+for\s+/i, '').trim();
  role = role.replace(/\s+at\s+[^@]+$/i, '').trim();
  role = role.replace(/\s+@\s+.+$/i, '').trim();

  const roleFromCompanyMatch = company.match(/^(.+?)(?:\s+-\s+[^-].+)?$/);
  const roleFromCompany = roleFromCompanyMatch ? roleFromCompanyMatch[1].trim() : company;

  if (ROLE_HINT.test(company) && role.length < 4) {
    role = roleFromCompany;
    cleaned = true;
  }

  if (ROLE_HINT.test(company) && /^job\s+application\s+for\s+/i.test(originalRole)) {
    const atMatch = originalRole.match(/\bat\s+(.+)$/i);
    if (atMatch?.[1]) {
      company = atMatch[1].trim();
      role = roleFromCompany;
      swapped = true;
      cleaned = true;
    }
  }

  if (company.toLowerCase() === role.toLowerCase() && ROLE_HINT.test(company)) {
    role = company;
  }

  if (company !== originalCompany || role !== originalRole) cleaned = true;

  return { company, role, swapped, cleaned };
}

export function dedupeKeyForJob(input: Pick<JobInsert, 'company_name' | 'role_title' | 'url'>): string {
  const company = normalizeText(input.company_name);
  const role = normalizeText(input.role_title);
  const url = normalizeText(input.url);
  return `${company}|${role}|${url || 'no-url'}`;
}

export function dedupeKeyForExistingJob(job: Pick<Job, 'company_name' | 'role_title' | 'url'>): string {
  return dedupeKeyForJob({ company_name: job.company_name, role_title: job.role_title, url: job.url });
}

export function dedupeTimestampKeyForJob(
  input: Pick<JobInsert, 'company_name' | 'role_title' | 'url' | 'date_applied'>
): string {
  const base = dedupeKeyForJob(input);
  const date = normalizeText(input.date_applied ?? '');
  return `${base}|day:${date}`;
}

function dedupeTimestampKeyForCsvRow(
  input: Pick<JobInsert, 'company_name' | 'role_title' | 'url'>,
  timestampMs: number | null
): string {
  const base = dedupeKeyForJob(input);
  return `${base}|ts:${minuteBucket(timestampMs)}`;
}

export function areTimestampsNear(timestampA: number | null, timestampB: number | null, toleranceMs = 60000): boolean {
  if (timestampA == null || timestampB == null) return false;
  return Math.abs(timestampA - timestampB) <= toleranceMs;
}

export function parseJobsCsvText(text: string): ParsedCsvResult {
  const parsed = parseCsv(text);
  const candidates: ParsedCsvJob[] = [];
  let skippedInvalid = 0;

  parsed.forEach((row, index) => {
    const rowNumber = index + 2;
    const companyRaw = getField(row, ['company', 'company_name']);
    const roleRaw = getField(row, ['role', 'title', 'role_title', 'position']);
    const dateRaw = getField(row, ['date', 'date_applied', 'applied_date']);
    const urlRaw = getField(row, ['url', 'link']);
    const notesRaw = getField(row, ['notes', 'note']);
    const statusRaw = getField(row, ['status']);
    const timestampMs = parseTimestampMs(dateRaw);

    const combined = `${companyRaw} ${roleRaw}`;
    if (NOISE_PHRASE.test(combined)) {
      skippedInvalid += 1;
      return;
    }

    const { company, role, swapped, cleaned } = cleanCompanyRole(companyRaw, roleRaw);

    if (!company || !role) {
      skippedInvalid += 1;
      return;
    }

    const job: JobInsert = {
      company_name: company,
      role_title: role,
      status: normalizeStatus(statusRaw),
      notes: notesRaw || '',
      url: normalizeUrl(urlRaw),
      date_applied: normalizeDate(dateRaw),
    };

    candidates.push({
      job,
      dedupeBaseKey: dedupeKeyForJob(job),
      dedupeDayKey: dedupeTimestampKeyForCsvRow(job, timestampMs),
      timestampMs,
      rowNumber,
      swapped,
      cleaned,
    });
  });

  return { candidates, skippedInvalid };
}
