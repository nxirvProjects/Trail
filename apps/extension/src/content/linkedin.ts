import type { ScrapedJob } from './index';

export function scrapeLinkedIn(): ScrapedJob | null {
  const roleTitle =
    document.querySelector('.job-details-jobs-unified-top-card__job-title h1')?.textContent?.trim() ??
    document.querySelector('.t-24.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ??
    document.querySelector('h1.topcard__title')?.textContent?.trim() ??
    '';

  const companyName =
    document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim() ??
    document.querySelector('.topcard__org-name-link')?.textContent?.trim() ??
    '';

  if (!roleTitle && !companyName) return null;
  return { company_name: companyName, role_title: roleTitle, url: window.location.href };
}
