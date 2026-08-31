'use strict';

const NEWS_PATH_RE = /^data_daily_gain_over_5\/analysis-news\/(20\d{6})\.json$/;
const DATE_RE = /^20\d{6}$/;

function normalizeDate(value) {
  const date = String(value || '').trim();
  if (!date) return '';
  if (!DATE_RE.test(date)) throw new Error(`Invalid date: ${date}`);
  return date;
}

function extractPushDates(changedFiles) {
  const dates = [];
  for (const file of changedFiles || []) {
    const match = NEWS_PATH_RE.exec(String(file || '').trim());
    if (match && !dates.includes(match[1])) dates.push(match[1]);
  }
  return dates;
}

function resolveDailyGainersNewsSummaryDate({
  eventName,
  inputDate = '',
  changedFiles = [],
  latestNewsDate = '',
}) {
  if (eventName === 'push') {
    const dates = extractPushDates(changedFiles);
    if (dates.length !== 1) {
      throw new Error(
        `Push must resolve exactly one analysis-news date; found ${dates.length}: ${dates.join(', ') || '(none)'}`,
      );
    }
    return dates[0];
  }

  if (eventName === 'workflow_dispatch') {
    const explicit = normalizeDate(inputDate);
    if (explicit) return explicit;
    const latest = normalizeDate(latestNewsDate);
    if (!latest) throw new Error('Manual run without date requires an existing latest analysis-news date');
    return latest;
  }

  throw new Error(`Unsupported event: ${eventName || '(empty)'}`);
}

function parseArgs(argv) {
  const args = { eventName: '', inputDate: '', latestNewsDate: '', changedFiles: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--event') args.eventName = argv[++i] || '';
    else if (token === '--input-date') args.inputDate = argv[++i] || '';
    else if (token === '--latest-news-date') args.latestNewsDate = argv[++i] || '';
    else if (token === '--changed-file') args.changedFiles.push(argv[++i] || '');
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const date = resolveDailyGainersNewsSummaryDate(args);
  process.stdout.write(`${date}\n`);
}

if (require.main === module) main();

module.exports = {
  NEWS_PATH_RE,
  extractPushDates,
  resolveDailyGainersNewsSummaryDate,
};
