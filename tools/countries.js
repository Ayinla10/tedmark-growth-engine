// Central registry for geographic expansion — every rule that varies by
// market (phone format, currency, mobile-network prefixes) lives here so
// adding a new country is a data change, not a code change scattered
// across contactFinder/channel/proposal.
//
// Mobile prefix lists are the national significant number's first two
// digits, used to distinguish mobile (WhatsApp-reachable) from landline.
// Sourced from each country's published numbering plan; treat as a
// best-effort classification, not a certified telecom database — a wrong
// classification only means a WhatsApp draft is skipped, not sent wrong.
export const COUNTRIES = {
  GH: {
    name: 'Ghana',
    callingCode: '233',
    nsnLength: 9,
    hasTrunkZero: true,
    mobilePrefixes: ['20', '23', '24', '25', '26', '27', '28', '50', '53', '54', '55', '56', '57', '59'],
    currency: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  },
  NG: {
    name: 'Nigeria',
    callingCode: '234',
    nsnLength: 10,
    hasTrunkZero: true,
    // MTN, Airtel, Glo, 9mobile ranges — not exhaustive, covers the vast
    // majority of active lines.
    mobilePrefixes: [
      '70', '71', '80', '81', '90', '91',
    ],
    currency: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  },
  KE: {
    name: 'Kenya',
    callingCode: '254',
    nsnLength: 9,
    hasTrunkZero: true,
    // Safaricom/Airtel/Telkom mobile ranges (7xx, 1xx).
    mobilePrefixes: ['70', '71', '72', '74', '75', '76', '77', '78', '79', '10', '11'],
    currency: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  },
  CI: {
    name: "Côte d'Ivoire",
    callingCode: '225',
    // Since the 2021 renumbering, all CI numbers are 10 digits with the
    // leading digit (0/1/2 = fixed, 05/01/07 = mobile) as part of the
    // number itself — there's no separate "0" trunk prefix to strip,
    // unlike GH/NG/KE where a local number is dialed with a leading 0.
    nsnLength: 10,
    hasTrunkZero: false,
    mobilePrefixes: ['01', '05', '07'],
    currency: { code: 'XOF', symbol: 'CFA', name: 'CFA Franc (West Africa)' },
  },
  SN: {
    name: 'Senegal',
    callingCode: '221',
    nsnLength: 9,
    hasTrunkZero: true,
    mobilePrefixes: ['70', '75', '76', '77', '78'],
    currency: { code: 'XOF', symbol: 'CFA', name: 'CFA Franc (West Africa)' },
  },
};

export const DEFAULT_COUNTRY = 'GH';

export function getCountry(code) {
  return COUNTRIES[code?.toUpperCase()] ?? COUNTRIES[DEFAULT_COUNTRY];
}

export function isSupportedCountry(code) {
  return Boolean(code && COUNTRIES[code.toUpperCase()]);
}
