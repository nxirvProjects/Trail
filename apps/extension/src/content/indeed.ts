import type { ScrapedJob } from './index';

export function scrapeIndeed(): ScrapedJob | null {
  const roleTitle =
    document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim() ??
    document.querySelector('h1[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim() ??
    document.querySelector('h1.icl-u-xs-mb--xs')?.textContent?.trim() ??
    '';

  const companyName =
    document.querySelector('[data-testid="inlineHeader-companyName"] a')?.textContent?.trim() ??
    document.querySelector('[data-company-name="true"]')?.textContent?.trim() ??
    document.querySelector('.icl-u-lg-mr--sm a')?.textContent?.trim() ??
    '';

  if (!roleTitle && !companyName) return null;
  return { company_name: companyName, role_title: roleTitle, url: window.location.href };
}
