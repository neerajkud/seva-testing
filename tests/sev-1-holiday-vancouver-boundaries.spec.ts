import { test, expect } from '@playwright/test';

const DEFAULT_API_URL =
  'https://api.foacs.co/api/online/931f4768-baac-11ee-a506-0242ac120002/Content/FooterStoreHours';
const API_URL = process.env.FOACS_API_URL ?? DEFAULT_API_URL;
const DIFFERENT_TIME_ZONE_API_URL = process.env.FOACS_DIFFERENT_TIME_ZONE_API_URL;
const TEST_CLOCK_HEADER = process.env.FOACS_TEST_CLOCK_HEADER;

const closureResponse = [
  { StoreHours: 'Store is closed today' },
  { StoreHours: 'Please call 7782930115 for more details' },
];
const regularResponse = [
  { StoreHours: 'Tuesday to Saturday 11 am to 6 pm' },
  { StoreHours: 'Sundays 12 pm to 5 pm' },
  { StoreHours: 'Donations are accepted from Tuesday to Sunday, 12 pm to 5 pm. ' },
  { StoreHours: 'Please call 7782930115 for the latest store hours. ' },
  { StoreHours: 'Store hours may vary during Holidays ' },
];

/** Convert a Vancouver wall-clock time to an instant using the runtime's IANA time-zone database. */
function vancouverInstant(
  date: string,
  time: string,
): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidate = desiredAsUtc;
  // Correct the candidate until its formatted Vancouver wall time matches the requested wall time.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]),
    );
    const observedAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const correction = desiredAsUtc - observedAsUtc;
    if (correction === 0) return new Date(candidate);
    candidate += correction;
  }

  throw new Error(`Could not resolve ${date} ${time} in America/Vancouver`);
}

test('SEV-1: applies holiday status at Vancouver-local day boundaries across time zones', async ({ request }) => {
  test.skip(
    !TEST_CLOCK_HEADER || !DIFFERENT_TIME_ZONE_API_URL,
    'Requires a documented test-clock header and an API deployment configured in a different server time zone.',
  );

  const instants = [
    {
      label: 'Vancouver holiday begins at 00:00:00',
      instant: vancouverInstant('2026-11-11', '00:00:00'),
      expected: closureResponse,
    },
    {
      label: 'Vancouver holiday includes 23:59:59',
      instant: vancouverInstant('2026-11-11', '23:59:59'),
      expected: closureResponse,
    },
    {
      label: 'first second of the next Vancouver date is regular',
      instant: vancouverInstant('2026-11-12', '00:00:00'),
      expected: regularResponse,
    },
  ];

  for (const targetUrl of [API_URL, DIFFERENT_TIME_ZONE_API_URL!]) {
    for (const boundary of instants) {
      const response = await request.get(targetUrl, {
        headers: { [TEST_CLOCK_HEADER!]: boundary.instant.toISOString() },
      });
      expect(response.status(), boundary.label).toBe(200);
      expect(await response.json(), `${boundary.label} at ${targetUrl}`).toEqual(boundary.expected);
    }
  }
});
