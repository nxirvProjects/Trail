import type { ScrapedJob } from './index';

export function scrapeGreenhouse(): ScrapedJob | null {
  const roleTitle =
    document.querySelector('.app-title')?.textContent?.trim() ??
    document.querySelector('h1.heading')?.textContent?.trim() ??
    '';

  const companyName =
    document.querySelector('.company-name')?.textContent?.trim() ??
    document.querySelector('#header .company-name')?.textContent?.trim() ??
    '';

  if (!roleTitle && !companyName) return null;
  return { company_name: companyName, role_title: roleTitle, url: window.location.href };
}
