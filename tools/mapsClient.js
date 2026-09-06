import dotenv from 'dotenv';
import { recordApiUsage } from './db.js';

dotenv.config();

const GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search';
const PLACES_URL = 'https://api.geoapify.com/v2/places';

const SECTOR_CATEGORIES = {
  restaurant: 'catering.restaurant',
  restaurants: 'catering.restaurant',
  'fast food': 'catering.fast_food',
  cafe: 'catering.cafe',
  bar: 'catering.bar',
  school: 'education.school',
  schools: 'education.school',
  university: 'education.university',
  clinic: 'healthcare.clinic_or_praxis',
  clinics: 'healthcare.clinic_or_praxis',
  pharmacy: 'healthcare.pharmacy',
  pharmacies: 'healthcare.pharmacy',
  hospital: 'healthcare.hospital',
  hotels: 'accommodation.hotel',
  hotel: 'accommodation.hotel',
  guesthouse: 'accommodation.guest_house',
  logistics: 'office.logistics',
  retail: 'commercial',
  shop: 'commercial',
  supermarket: 'commercial.supermarket',
  supermarkets: 'commercial.supermarket',
  'real estate': 'office.estate_agent',
  realestate: 'office.estate_agent',
  bank: 'office.financial',
  finance: 'office.financial',
  gym: 'sport.fitness',
  fitness: 'sport.fitness',
  salon: 'service.beauty',
  beauty: 'service.beauty',
  barbershop: 'service.beauty',
  church: 'religion',
  fuel: 'service.fuel',
  petrol: 'service.fuel',
  garage: 'service.vehicle',
  mechanic: 'service.vehicle',
  office: 'office',
  business: 'office',
  businesses: 'office',
  'small businesses': 'office',
  company: 'office',
  companies: 'office',
};

function getApiKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) {
    throw new Error('GEOAPIFY_API_KEY is missing from .env');
  }
  return key;
}

// Pure: returns the Geoapify category for a sector, or null if there's no
// clean mapping (e.g. "event planning" — Geoapify only has venue/place
// categories like conference centres, not "event planning company").
// Callers should skip the Maps API call entirely rather than fall back to
// a generic category like "commercial", which just returns noisy,
// irrelevant results and burns quota for no benefit.
export function resolveSectorCategory(sector) {
  const normalized = sector.trim().toLowerCase();
  return SECTOR_CATEGORIES[normalized] ?? null;
}

async function geocodeCity(city) {
  const params = new URLSearchParams({
    text: city,
    type: 'city',
    format: 'json',
    countrycodes: 'gh',
    apiKey: getApiKey(),
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  const data = await res.json();

  await recordApiUsage('geoapify', 'geocode', 'requests', 1).catch((err) => {
    console.warn(`[mapsClient] Could not record API usage: ${err.message}`);
  });

  const result = data.results?.[0];
  if (!result) {
    throw new Error(`Could not geocode city "${city}"`);
  }

  return result.place_id;
}

function extractContact(properties) {
  const raw = properties.datasource?.raw ?? {};

  const phone =
    properties.contact?.phone ??
    properties.phone ??
    raw.phone ??
    raw['contact:phone'] ??
    null;

  const website =
    properties.website ??
    properties.contact?.website ??
    raw.website ??
    raw['contact:website'] ??
    null;

  return { phone, website };
}

export async function searchBusinesses({ sector, city, limit = 20, offset = 0 }) {
  const category = resolveSectorCategory(sector);

  if (!category) {
    console.warn(`[mapsClient] No Geoapify category for sector "${sector}" — add it to SECTOR_CATEGORIES or use web-scout instead.`);
    return [];
  }

  const placeId = await geocodeCity(city);

  const params = new URLSearchParams({
    categories: category,
    filter: `place:${placeId}`,
    limit: String(limit),
    apiKey: getApiKey(),
  });

  if (offset > 0) {
    params.set('offset', String(offset));
  }

  const res = await fetch(`${PLACES_URL}?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Geoapify Places API error: ${data.message ?? res.statusText}`);
  }

  await recordApiUsage('geoapify', 'places', 'requests', 1).catch((err) => {
    console.warn(`[mapsClient] Could not record API usage: ${err.message}`);
  });

  const features = data.features ?? [];

  return features.map((feature) => {
    const properties = feature.properties ?? {};
    const { phone, website } = extractContact(properties);

    return {
      name: properties.name ?? 'Unnamed business',
      address: properties.formatted ?? null,
      phone,
      website,
      place_id: properties.place_id,
    };
  });
}
