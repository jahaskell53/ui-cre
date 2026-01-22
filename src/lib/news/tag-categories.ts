// Shared tag categories for consistent tagging across the application
export const TAG_CATEGORIES = {
  'single-family': 'Single-family homes, detached houses, residential properties',
  'multi-family': 'Multi-family residential properties (3+ unit apartments, condos, larger buildings) for investment or development but NOT about individual family purchases/homes',
  'economy': 'Economic conditions, market trends, financial indicators',
  'commercial': 'Commercial real estate (office, retail, industrial)',
  'development': 'New construction, development projects, zoning',
  'investment': 'Investment activity, acquisitions, sales, financing',
  'policy': 'Government policy, regulations, legislation affecting real estate',
  'regulation': 'Government regulations, rules, compliance requirements about real estate specifically, not general regulation',
  'sustainability': 'Green building, sustainability, environmental initiatives',
  'infrastructure': 'Transportation, utilities, public infrastructure',
  'demographics': 'Population trends, migration, demographic shifts',
  'financing': 'Mortgage rates, lending, capital markets',
  'retail': 'Retail real estate, shopping centers, store closures/openings',
  'office': 'Office real estate, workplace trends, remote work impact',
  'industrial': 'Industrial real estate, warehouses, logistics',
  'hospitality': 'Hotels, hospitality, tourism-related real estate',
  'residential': 'Single-family homes, residential market trends',
  'bay-area': 'Specific to San Francisco Bay Area region',
  'california': 'California state-wide real estate issues',
  'national': 'National-level real estate trends and policies that apply broadly across the entire United States. Do NOT use for articles about specific cities, counties, or regions',
  'local': 'Local-level real estate trends and policies that apply to a specific city, county, or region'
} as const;

export type TagCategory = keyof typeof TAG_CATEGORIES;
