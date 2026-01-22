export interface County {
  id: string;
  name: string;
}

export interface MetroArea {
  id: string;
  name: string;
  counties: County[];
}

export const METRO_AREAS: MetroArea[] = [
  {
    id: "bay-area",
    name: "San Francisco Bay Area",
    counties: [
      { id: "San Mateo", name: "San Mateo County" },
      { id: "Santa Clara", name: "Santa Clara County" },
      { id: "San Francisco", name: "San Francisco County" },
      { id: "Alameda", name: "Alameda County" },
      { id: "Marin", name: "Marin County" },
      { id: "Contra Costa", name: "Contra Costa County" },
      { id: "Napa", name: "Napa County" },
      { id: "Sonoma", name: "Sonoma County" },
      { id: "Solano", name: "Solano County" },
    ]
  },
  {
    id: "la-metro",
    name: "Los Angeles Metro",
    counties: [
      { id: "Los Angeles", name: "Los Angeles County" },
      { id: "Orange", name: "Orange County" },
      { id: "Riverside", name: "Riverside County" },
      { id: "San Bernardino", name: "San Bernardino County" },
      { id: "Ventura", name: "Ventura County" },
    ]
  },
  {
    id: "nyc-metro",
    name: "New York Metro",
    counties: [
      { id: "New York", name: "New York County" },
      { id: "Kings", name: "Kings County" },
      { id: "Queens", name: "Queens County" },
      { id: "Bronx", name: "Bronx County" },
      { id: "Richmond", name: "Richmond County" },
      { id: "Nassau", name: "Nassau County" },
      { id: "Suffolk", name: "Suffolk County" },
      { id: "Westchester", name: "Westchester County" },
      { id: "Rockland", name: "Rockland County" },
    ]
  },
  {
    id: "chicago-metro",
    name: "Chicago Metro",
    counties: [
      { id: "Cook", name: "Cook County" },
      { id: "DuPage", name: "DuPage County" },
      { id: "Lake", name: "Lake County" },
      { id: "Will", name: "Will County" },
      { id: "Kane", name: "Kane County" },
      { id: "McHenry", name: "McHenry County" },
    ]
  },
  {
    id: "dallas-metro",
    name: "Dallas-Fort Worth Metro",
    counties: [
      { id: "Dallas", name: "Dallas County" },
      { id: "Tarrant", name: "Tarrant County" },
      { id: "Collin", name: "Collin County" },
      { id: "Denton", name: "Denton County" },
      { id: "Ellis", name: "Ellis County" },
      { id: "Johnson", name: "Johnson County" },
      { id: "Kaufman", name: "Kaufman County" },
      { id: "Parker", name: "Parker County" },
      { id: "Rockwall", name: "Rockwall County" },
      { id: "Wise", name: "Wise County" },
    ]
  },
  {
    id: "houston-metro",
    name: "Houston Metro",
    counties: [
      { id: "Harris", name: "Harris County" },
      { id: "Fort Bend", name: "Fort Bend County" },
      { id: "Montgomery", name: "Montgomery County" },
      { id: "Brazoria", name: "Brazoria County" },
      { id: "Galveston", name: "Galveston County" },
      { id: "Liberty", name: "Liberty County" },
      { id: "Waller", name: "Waller County" },
    ]
  },
  {
    id: "phoenix-metro",
    name: "Phoenix Metro",
    counties: [
      { id: "Maricopa", name: "Maricopa County" },
      { id: "Pinal", name: "Pinal County" },
    ]
  },
  {
    id: "philadelphia-metro",
    name: "Philadelphia Metro",
    counties: [
      { id: "Philadelphia", name: "Philadelphia County" },
      { id: "Bucks", name: "Bucks County" },
      { id: "Chester", name: "Chester County" },
      { id: "Delaware", name: "Delaware County" },
      { id: "Montgomery", name: "Montgomery County" },
      { id: "Burlington", name: "Burlington County" },
      { id: "Camden", name: "Camden County" },
      { id: "Gloucester", name: "Gloucester County" },
    ]
  },
  {
    id: "san-antonio-metro",
    name: "San Antonio Metro",
    counties: [
      { id: "Bexar", name: "Bexar County" },
      { id: "Comal", name: "Comal County" },
      { id: "Guadalupe", name: "Guadalupe County" },
      { id: "Wilson", name: "Wilson County" },
    ]
  },
  {
    id: "san-diego-metro",
    name: "San Diego Metro",
    counties: [
      { id: "San Diego", name: "San Diego County" },
    ]
  },
  {
    id: "austin-metro",
    name: "Austin Metro",
    counties: [
      { id: "Travis", name: "Travis County" },
      { id: "Williamson", name: "Williamson County" },
      { id: "Hays", name: "Hays County" },
      { id: "Bastrop", name: "Bastrop County" },
      { id: "Caldwell", name: "Caldwell County" },
    ]
  },
  {
    id: "seattle-metro",
    name: "Seattle Metro",
    counties: [
      { id: "King", name: "King County" },
      { id: "Pierce", name: "Pierce County" },
      { id: "Snohomish", name: "Snohomish County" },
    ]
  },
  {
    id: "denver-metro",
    name: "Denver Metro",
    counties: [
      { id: "Denver", name: "Denver County" },
      { id: "Jefferson", name: "Jefferson County" },
      { id: "Arapahoe", name: "Arapahoe County" },
      { id: "Adams", name: "Adams County" },
      { id: "Douglas", name: "Douglas County" },
      { id: "Broomfield", name: "Broomfield County" },
    ]
  },
  {
    id: "boston-metro",
    name: "Boston Metro",
    counties: [
      { id: "Suffolk", name: "Suffolk County" },
      { id: "Middlesex", name: "Middlesex County" },
      { id: "Essex", name: "Essex County" },
      { id: "Norfolk", name: "Norfolk County" },
      { id: "Plymouth", name: "Plymouth County" },
    ]
  },
  {
    id: "miami-metro",
    name: "Miami Metro",
    counties: [
      { id: "Miami-Dade", name: "Miami-Dade County" },
      { id: "Broward", name: "Broward County" },
      { id: "Palm Beach", name: "Palm Beach County" },
    ]
  },
  {
    id: "atlanta-metro",
    name: "Atlanta Metro",
    counties: [
      { id: "Fulton", name: "Fulton County" },
      { id: "DeKalb", name: "DeKalb County" },
      { id: "Gwinnett", name: "Gwinnett County" },
      { id: "Cobb", name: "Cobb County" },
      { id: "Clayton", name: "Clayton County" },
      { id: "Cherokee", name: "Cherokee County" },
      { id: "Henry", name: "Henry County" },
      { id: "Forsyth", name: "Forsyth County" },
    ]
  },
  {
    id: "washington-dc-metro",
    name: "Washington DC Metro",
    counties: [
      { id: "District of Columbia", name: "District of Columbia" },
      { id: "Montgomery", name: "Montgomery County" },
      { id: "Prince George's", name: "Prince George's County" },
      { id: "Fairfax", name: "Fairfax County" },
      { id: "Arlington", name: "Arlington County" },
      { id: "Prince William", name: "Prince William County" },
      { id: "Loudoun", name: "Loudoun County" },
    ]
  },
  {
    id: "detroit-metro",
    name: "Detroit Metro",
    counties: [
      { id: "Wayne", name: "Wayne County" },
      { id: "Oakland", name: "Oakland County" },
      { id: "Macomb", name: "Macomb County" },
      { id: "Livingston", name: "Livingston County" },
    ]
  },
  {
    id: "minneapolis-metro",
    name: "Minneapolis-St. Paul Metro",
    counties: [
      { id: "Hennepin", name: "Hennepin County" },
      { id: "Ramsey", name: "Ramsey County" },
      { id: "Dakota", name: "Dakota County" },
      { id: "Anoka", name: "Anoka County" },
      { id: "Washington", name: "Washington County" },
    ]
  },
  {
    id: "tampa-metro",
    name: "Tampa-St. Petersburg Metro",
    counties: [
      { id: "Hillsborough", name: "Hillsborough County" },
      { id: "Pinellas", name: "Pinellas County" },
      { id: "Pasco", name: "Pasco County" },
      { id: "Hernando", name: "Hernando County" },
    ]
  },
  {
    id: "st-louis-metro",
    name: "St. Louis Metro",
    counties: [
      { id: "St. Louis", name: "St. Louis County" },
      { id: "St. Louis City", name: "St. Louis City" },
      { id: "St. Charles", name: "St. Charles County" },
    ]
  },
  {
    id: "baltimore-metro",
    name: "Baltimore Metro",
    counties: [
      { id: "Baltimore", name: "Baltimore County" },
      { id: "Baltimore City", name: "Baltimore City" },
      { id: "Anne Arundel", name: "Anne Arundel County" },
      { id: "Howard", name: "Howard County" },
    ]
  },
  {
    id: "charlotte-metro",
    name: "Charlotte Metro",
    counties: [
      { id: "Mecklenburg", name: "Mecklenburg County" },
      { id: "Gaston", name: "Gaston County" },
      { id: "Union", name: "Union County" },
      { id: "Cabarrus", name: "Cabarrus County" },
    ]
  },
  {
    id: "orlando-metro",
    name: "Orlando Metro",
    counties: [
      { id: "Orange", name: "Orange County" },
      { id: "Seminole", name: "Seminole County" },
      { id: "Osceola", name: "Osceola County" },
      { id: "Lake", name: "Lake County" },
    ]
  },
  {
    id: "portland-metro",
    name: "Portland Metro",
    counties: [
      { id: "Multnomah", name: "Multnomah County" },
      { id: "Washington", name: "Washington County" },
      { id: "Clackamas", name: "Clackamas County" },
    ]
  },
  {
    id: "sacramento-metro",
    name: "Sacramento Metro",
    counties: [
      { id: "Sacramento", name: "Sacramento County" },
      { id: "Placer", name: "Placer County" },
      { id: "Yolo", name: "Yolo County" },
      { id: "El Dorado", name: "El Dorado County" },
    ]
  },
  {
    id: "las-vegas-metro",
    name: "Las Vegas Metro",
    counties: [
      { id: "Clark", name: "Clark County" },
    ]
  },
  {
    id: "nashville-metro",
    name: "Nashville Metro",
    counties: [
      { id: "Davidson", name: "Davidson County" },
      { id: "Williamson", name: "Williamson County" },
      { id: "Rutherford", name: "Rutherford County" },
      { id: "Wilson", name: "Wilson County" },
      { id: "Sumner", name: "Sumner County" },
    ]
  },
  {
    id: "raleigh-metro",
    name: "Raleigh Metro",
    counties: [
      { id: "Wake", name: "Wake County" },
      { id: "Durham", name: "Durham County" },
      { id: "Johnston", name: "Johnston County" },
    ]
  },
  {
    id: "salt-lake-city-metro",
    name: "Salt Lake City Metro",
    counties: [
      { id: "Salt Lake", name: "Salt Lake County" },
      { id: "Davis", name: "Davis County" },
      { id: "Weber", name: "Weber County" },
    ]
  },
];
