import dotenv from 'dotenv';

dotenv.config();

const GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search';
const PLACES_URL = 'https://api.geoapify.com/v2/places';

const SECTOR_CATEGORIES = {
  restaurant: 'catering.restaurant',
  restaurants: 'catering.restaurant',
  school: 'education.school',
  schools: 'education.school',
  clinic: 'healthcare.clinic_or_praxis',
  clinics: 'healthcare.clinic_or_praxis',
  hospital: 'healthcare.hospital',
  logistics: 'office.logistics',
  retail: 'commercial',
  shop: 'commercial',
  'real estate': 'office.estate_agent',
  realestate: 'office.estate_agent',
};

function getApiKey() {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) {
    throw new Error('GEOAPIFY_API_KEY is missing from .env');
  }
  return key;
}

function resolveCategory(sector) {
  const normalized = sector.trim().toLowerCase();
  const category = SECTOR_CATEGORIES[normalized];

  if (!category) {
    console.warn(`[mapsClient] Unrecognized sector "${sector}", defaulting to "commercial" category.`);
    return 'commercial';
  }

  return category;
}

async function geocodeCity(city) {
  const params = new URLSearchParams({
    text: city,
    type: 'city',
    format: 'json',
    apiKey: getApiKey(),
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  const data = await res.json();

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

export async function searchBusinesses({ sector, city, limit = 20 }) {
  const category = resolveCategory(sector);
  const placeId = await geocodeCity(city);

  const params = new URLSearchParams({
    categories: category,
    filter: `place:${placeId}`,
    limit: String(limit),
    apiKey: getApiKey(),
  });

  const res = await fetch(`${PLACES_URL}?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Geoapify Places API error: ${data.message ?? res.statusText}`);
  }

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
