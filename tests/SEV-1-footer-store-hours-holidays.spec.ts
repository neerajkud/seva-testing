import { test, expect } from '@playwright/test';

const apiUrl = process.env.FOOTER_STORE_HOURS_API_URL;
const dateHeaderName = process.env.FOOTER_STORE_HOURS_TEST_DATE_HEADER;
const dateControlVerified =
  process.env.FOOTER_STORE_HOURS_DATE_CONTROL_VERIFIED === 'true';

const dateControlConfigured = Boolean(
  apiUrl && dateHeaderName && dateControlVerified,
);

const holidays = [
  ["New Year's Day", '2026-01-01'],
  ['Family Day', '2026-02-16'],
  ['Good Friday', '2026-04-03'],
  ['Victoria Day', '2026-05-18'],
  ['Canada Day', '2026-07-01'],
  ['B.C. Day', '2026-08-03'],
  ['Labour Day', '2026-09-07'],
  ['National Day for Truth and Reconciliation', '2026-09-30'],
  ['Thanksgiving', '2026-10-12'],
  ['Remembrance Day', '2026-11-11'],
  ['Christmas Day', '2026-12-25'],
] as const;

const expectedClosureResponse = [
  { StoreHours: 'Store is closed today' },
  { StoreHours: 'Please call 7782930115 for more details' },
];

test.describe('SEV-1: FooterStoreHours closure response on 2026 BC statutory holidays', () => {
  for (const [holidayName, date] of holidays) {
    test(`returns the exact closure response for ${holidayName} (${date})`, async ({ request }) => {
      test.skip(
        !dateControlConfigured,
        'Requires a non-production API URL and a verified, documented test date-control configuration.',
      );

      const response = await request.get(apiUrl!, {
        headers: { [dateHeaderName!]: date },
      });

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual(expectedClosureResponse);
    });
  }
});
