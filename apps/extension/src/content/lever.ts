import type { ScrapedJob } from './index';

export function scrapeLever(): ScrapedJob | null {
  const roleTitle =
    document.querySelector('.posting-headline h2')?.textContent?.trim() ??
    '';

  // Lever pages typically have the company name in the page title or logo alt text
  const companyName =
    document.querySelector('.main-header-logo img')?.getAttribute('alt')?.trim() ??
    document.title.split(' - ')[1]?.trim() ??
    '';

  if (!roleTitle && !companyName) return null;
  return { company_name: companyName, role_title: roleTitle, url: window.location.href };
}
