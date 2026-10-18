// Home venues for structured data (schema.org Place). Checked 18 Oct 2026:
// NBA against Wikipedia "List of NBA arenas"; NFL against the nflverse 2026 schedule (stadium per game).
// [venue, city, region, country]
export const NBA_VENUES = {
  ATL: ["State Farm Arena", "Atlanta", "GA", "US"],
  BOS: ["TD Garden", "Boston", "MA", "US"],
  BKN: ["Barclays Center", "Brooklyn", "NY", "US"],
  CHA: ["Spectrum Center", "Charlotte", "NC", "US"],
  CHI: ["United Center", "Chicago", "IL", "US"],
  CLE: ["Rocket Arena", "Cleveland", "OH", "US"],
  DAL: ["American Airlines Center", "Dallas", "TX", "US"],
  DEN: ["Ball Arena", "Denver", "CO", "US"],
  DET: ["Little Caesars Arena", "Detroit", "MI", "US"],
  GS: ["Chase Center", "San Francisco", "CA", "US"],
  HOU: ["Toyota Center", "Houston", "TX", "US"],
  IND: ["Gainbridge Fieldhouse", "Indianapolis", "IN", "US"],
  LAC: ["Intuit Dome", "Inglewood", "CA", "US"],
  LAL: ["Crypto.com Arena", "Los Angeles", "CA", "US"],
  MEM: ["FedExForum", "Memphis", "TN", "US"],
  MIA: ["Kaseya Center", "Miami", "FL", "US"],
  MIL: ["Fiserv Forum", "Milwaukee", "WI", "US"],
  MIN: ["Target Center", "Minneapolis", "MN", "US"],
  NO: ["Smoothie King Center", "New Orleans", "LA", "US"],
  NY: ["Madison Square Garden", "New York", "NY", "US"],
  OKC: ["Paycom Center", "Oklahoma City", "OK", "US"],
  ORL: ["Kia Center", "Orlando", "FL", "US"],
  PHI: ["Xfinity Mobile Arena", "Philadelphia", "PA", "US"],
  PHX: ["Mortgage Matchup Center", "Phoenix", "AZ", "US"],
  POR: ["Moda Center", "Portland", "OR", "US"],
  SAC: ["Golden 1 Center", "Sacramento", "CA", "US"],
  SA: ["Frost Bank Center", "San Antonio", "TX", "US"],
  TOR: ["Scotiabank Arena", "Toronto", "ON", "CA"],
  UTAH: ["Delta Center", "Salt Lake City", "UT", "US"],
  WSH: ["Capital One Arena", "Washington", "DC", "US"],
};

export const NFL_VENUES = {
  ARI: ["State Farm Stadium", "Glendale", "AZ", "US"],
  ATL: ["Mercedes-Benz Stadium", "Atlanta", "GA", "US"],
  BAL: ["M&T Bank Stadium", "Baltimore", "MD", "US"],
  BUF: ["Highmark Stadium", "Orchard Park", "NY", "US"],
  CAR: ["Bank of America Stadium", "Charlotte", "NC", "US"],
  CHI: ["Soldier Field", "Chicago", "IL", "US"],
  CIN: ["Paycor Stadium", "Cincinnati", "OH", "US"],
  CLE: ["Huntington Bank Field", "Cleveland", "OH", "US"],
  DAL: ["AT&T Stadium", "Arlington", "TX", "US"],
  DEN: ["Empower Field at Mile High", "Denver", "CO", "US"],
  DET: ["Ford Field", "Detroit", "MI", "US"],
  GB: ["Lambeau Field", "Green Bay", "WI", "US"],
  HOU: ["NRG Stadium", "Houston", "TX", "US"],
  IND: ["Lucas Oil Stadium", "Indianapolis", "IN", "US"],
  JAX: ["EverBank Stadium", "Jacksonville", "FL", "US"],
  KC: ["GEHA Field at Arrowhead Stadium", "Kansas City", "MO", "US"],
  LA: ["SoFi Stadium", "Inglewood", "CA", "US"],
  LAC: ["SoFi Stadium", "Inglewood", "CA", "US"],
  LV: ["Allegiant Stadium", "Paradise", "NV", "US"],
  MIA: ["Hard Rock Stadium", "Miami Gardens", "FL", "US"],
  MIN: ["U.S. Bank Stadium", "Minneapolis", "MN", "US"],
  NE: ["Gillette Stadium", "Foxborough", "MA", "US"],
  NO: ["Caesars Superdome", "New Orleans", "LA", "US"],
  NYG: ["MetLife Stadium", "East Rutherford", "NJ", "US"],
  NYJ: ["MetLife Stadium", "East Rutherford", "NJ", "US"],
  PHI: ["Lincoln Financial Field", "Philadelphia", "PA", "US"],
  PIT: ["Acrisure Stadium", "Pittsburgh", "PA", "US"],
  SEA: ["Lumen Field", "Seattle", "WA", "US"],
  SF: ["Levi's Stadium", "Santa Clara", "CA", "US"],
  TB: ["Raymond James Stadium", "Tampa", "FL", "US"],
  TEN: ["Nissan Stadium", "Nashville", "TN", "US"],
  WAS: ["Northwest Stadium", "Landover", "MD", "US"],
};

// 2026 NFL neutral-site games (nflverse game id "season_week_away_home")
export const NFL_NEUTRAL_2026 = {
  "2026_01_SF_LA": ["Melbourne Cricket Ground", "Melbourne", "VIC", "AU"],
  "2026_03_BAL_DAL": ["Maracanã Stadium", "Rio de Janeiro", "RJ", "BR"],
  "2026_04_IND_WAS": ["Tottenham Hotspur Stadium", "London", "England", "GB"],
  "2026_05_PHI_JAX": ["Tottenham Hotspur Stadium", "London", "England", "GB"],
  "2026_06_HOU_JAX": ["Wembley Stadium", "London", "England", "GB"],
  "2026_07_PIT_NO": ["Stade de France", "Saint-Denis", "Île-de-France", "FR"],
  "2026_09_CIN_ATL": ["Santiago Bernabéu Stadium", "Madrid", "Community of Madrid", "ES"],
  "2026_10_NE_DET": ["Allianz Arena", "Munich", "Bavaria", "DE"],
  "2026_11_MIN_SF": ["Estadio Banorte", "Mexico City", "CDMX", "MX"],
};

const place = (v) => v && ({ "@type": "Place", name: v[0], address: { "@type": "PostalAddress", addressLocality: v[1], addressRegion: v[2], addressCountry: v[3] } });

// venue for a game: game-specific neutral site first, then the home team's venue
export function venueOf(g) {
  if (g.sport === "nfl") {
    const key = `${g.season}_${String(g.week).padStart(2, "0")}_${g.away}_${g.home}`;
    return place(NFL_NEUTRAL_2026[key] ?? NFL_VENUES[g.home]);
  }
  return place(NBA_VENUES[g.home]);
}
