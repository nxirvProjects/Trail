import { scrapeLinkedIn } from './linkedin';
import { scrapeIndeed } from './indeed';
import { scrapeGreenhouse } from './greenhouse';
import { scrapeLever } from './lever';

export interface ScrapedJob {
  company_name: string;
  role_title: string;
  url: string;
}

function scrapeCurrentPage(): ScrapedJob | null {
  const url = window.location.href;
  if (url.includes('linkedin.com/jobs')) return scrapeLinkedIn();
  if (url.includes('indeed.com/viewjob') || url.includes('indeed.com/jobs')) return scrapeIndeed();
  if (url.includes('greenhouse.io')) return scrapeGreenhouse();
  if (url.includes('lever.co')) return scrapeLever();
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SCRAPE_JOB') {
    const data = scrapeCurrentPage();
    sendResponse({ data });
  }
  return true;
});
