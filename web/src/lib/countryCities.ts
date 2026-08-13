export const COUNTRY_CITIES: Record<string, string[]> = {
  // ── West Africa ──────────────────────────────────────────────────────────
  Ghana: ["Accra", "Kumasi", "Tema", "Takoradi", "Cape Coast", "Tamale", "Koforidua", "Sunyani", "Ho", "Kasoa"],
  Nigeria: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Benin City", "Owerri", "Enugu", "Kaduna", "Lekki"],
  Senegal: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Touba"],
  "Côte d'Ivoire": ["Abidjan", "Bouaké", "Daloa", "San-Pédro", "Yamoussoukro"],
  "Burkina Faso": ["Ouagadougou", "Bobo-Dioulasso", "Koudougou"],
  Mali: ["Bamako", "Sikasso", "Mopti"],
  Togo: ["Lomé", "Sokodé", "Kara"],
  Benin: ["Cotonou", "Porto-Novo", "Parakou"],
  "Sierra Leone": ["Freetown", "Bo", "Kenema"],
  Liberia: ["Monrovia", "Gbarnga", "Buchanan"],
  Guinea: ["Conakry", "Nzérékoré", "Labé"],
  Gambia: ["Banjul", "Serekunda", "Brikama"],

  // ── East Africa ───────────────────────────────────────────────────────────
  Kenya: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi"],
  Tanzania: ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Zanzibar City"],
  Uganda: ["Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu"],
  Rwanda: ["Kigali", "Butare", "Gisenyi", "Ruhengeri"],
  Ethiopia: ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Hawassa"],
  "South Sudan": ["Juba", "Wau", "Malakal"],

  // ── Southern Africa ───────────────────────────────────────────────────────
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "Sandton"],
  Zimbabwe: ["Harare", "Bulawayo", "Mutare", "Gweru"],
  Zambia: ["Lusaka", "Ndola", "Kitwe", "Livingstone"],
  Botswana: ["Gaborone", "Francistown", "Maun"],
  Mozambique: ["Maputo", "Beira", "Nampula", "Quelimane"],

  // ── North Africa ──────────────────────────────────────────────────────────
  Egypt: ["Cairo", "Alexandria", "Giza", "Luxor", "Hurghada", "Sharm el-Sheikh"],
  Morocco: ["Casablanca", "Marrakech", "Rabat", "Fez", "Tangier", "Agadir"],
  Tunisia: ["Tunis", "Sfax", "Sousse", "Monastir"],
  Algeria: ["Algiers", "Oran", "Constantine", "Annaba"],

  // ── Europe ────────────────────────────────────────────────────────────────
  "United Kingdom": ["London", "Birmingham", "Manchester", "Leeds", "Liverpool", "Bristol", "Glasgow", "Edinburgh"],
  France: ["Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg", "Bordeaux"],
  Germany: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao", "Málaga"],
  Italy: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"],
  Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  Belgium: ["Brussels", "Antwerp", "Ghent", "Bruges", "Liège"],
  Switzerland: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"],
  Portugal: ["Lisbon", "Porto", "Braga", "Faro", "Funchal"],
  Sweden: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"],
  Norway: ["Oslo", "Bergen", "Stavanger", "Trondheim"],
  Denmark: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
  Finland: ["Helsinki", "Espoo", "Tampere", "Turku"],
  Poland: ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk"],
  Ireland: ["Dublin", "Cork", "Limerick", "Galway"],

  // ── Americas ─────────────────────────────────────────────────────────────
  "United States": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "Atlanta", "Miami", "Dallas", "San Francisco"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa", "Edmonton", "Winnipeg"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus"],
  Mexico: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León"],
  Colombia: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
  Argentina: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "Antofagasta"],
  Peru: ["Lima", "Arequipa", "Trujillo", "Cusco"],
  Jamaica: ["Kingston", "Montego Bay", "Spanish Town", "Portmore"],
  Trinidad: ["Port of Spain", "San Fernando", "Chaguanas"],

  // ── Middle East ───────────────────────────────────────────────────────────
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain"],
  "Saudi Arabia": ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar"],
  Qatar: ["Doha", "Al Rayyan", "Al Wakrah"],
  Kuwait: ["Kuwait City", "Hawalli", "Salmiya"],
  Bahrain: ["Manama", "Riffa", "Muharraq"],
  Oman: ["Muscat", "Salalah", "Sohar"],
  Jordan: ["Amman", "Zarqa", "Irbid", "Aqaba"],
  Lebanon: ["Beirut", "Tripoli", "Sidon", "Tyre"],

  // ── Asia ──────────────────────────────────────────────────────────────────
  India: ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad"],
  Pakistan: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad"],
  Bangladesh: ["Dhaka", "Chittagong", "Sylhet", "Rajshahi"],
  "Sri Lanka": ["Colombo", "Kandy", "Galle", "Jaffna"],
  China: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Chengdu", "Xi'an"],
  Japan: ["Tokyo", "Osaka", "Yokohama", "Nagoya", "Sapporo", "Fukuoka"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"],
  Singapore: ["Singapore"],
  Malaysia: ["Kuala Lumpur", "Penang", "Johor Bahru", "Petaling Jaya", "Kota Kinabalu"],
  Indonesia: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Bali"],
  Philippines: ["Manila", "Cebu", "Davao", "Quezon City", "Makati"],
  Thailand: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Khon Kaen"],
  Vietnam: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong"],
  Cambodia: ["Phnom Penh", "Siem Reap", "Sihanoukville"],

  // ── Oceania ───────────────────────────────────────────────────────────────
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch", "Hamilton"],
};

export const ALL_COUNTRIES = Object.keys(COUNTRY_CITIES).sort();

export function getCitiesForCountries(countries: string[]): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const country of countries) {
    for (const city of COUNTRY_CITIES[country] ?? []) {
      if (!seen.has(city)) {
        seen.add(city);
        cities.push(city);
      }
    }
  }
  return cities;
}
