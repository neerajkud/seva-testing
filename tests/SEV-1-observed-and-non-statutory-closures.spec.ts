import { test, expect } from '@playwright/test';

type ApprovedPolicyCase = {
  date: string;
  category: string;
  closed: boolean;
};

const apiUrl =
  process.env.FOACS_FOOTER_STORE_HOURS_URL ??
  'https://api.foacs.co/api/online/931f4768-baac-11ee-a506-0242ac120002/Content/FooterStoreHours';
const dateOverrideHeader = process.env.FOACS_TEST_DATE_OVERRIDE_HEADER;
const policyJson = process.env.FOACS_APPROVED_CLOSURE_POLICY;
const policyCases: ApprovedPolicyCase[] = policyJson
  ? (JSON.parse(policyJson) as ApprovedPolicyCase[])
  : [];

const holidayResponse = [
  { StoreHours: 'Store is closed today' },
  { StoreHours: 'Please call 7782930115 for more details' },
];

const regularResponse = [
  { StoreHours: 'Tuesday to Saturday 11 am to 6 pm' },
  { StoreHours: 'Sundays 12 pm to 5 pm' },
  {
    StoreHours:
      'Donations are accepted from Tuesday to Sunday, 12 pm to 5 pm. ',
  },
  {
    StoreHours: 'Please call 7782930115 for the latest store hours. ',
  },
  { StoreHours: 'Store hours may vary during Holidays ' },
];

test.describe('SEV-1: observed-holiday and non-statutory closure policy', () => {
  if (policyCases.length === 0) {
    test('SEV-1: compare approved closure dates with FooterStoreHours policy', async () => {
      test.skip(
        true,
        'Requires business-approved policy cases and a configured test-date override.',
      );
    });
  }

  for (const policyCase of policyCases) {
    test(`SEV-1: ${policyCase.category} policy for ${policyCase.date}`, async ({ request }) => {
      test.skip(
        !dateOverrideHeader || !policyJson,
        'Requires business-approved policy cases and a configured test-date override.',
      );

      expect(policyCase.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(policyCase.category.trim().length).toBeGreaterThan(0);
      expect(typeof policyCase.closed).toBe('boolean');
      expect(dateOverrideHeader).toBeTruthy();

      const response = await request.get(apiUrl, {
        headers: { [dateOverrideHeader as string]: policyCase.date },
      });

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual(
        policyCase.closed ? holidayResponse : regularResponse,
      );
    });
  }
});
