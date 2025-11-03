/**
 * Maps team names from The Odds API to database team names
 * The Odds API uses full names with mascots (e.g., "Duke Blue Devils")
 * Our database uses simplified names (e.g., "Duke")
 */

export function normalizeTeamName(oddsApiName: string): string {
  // Handle specific problematic team names first
  const directMappings: Record<string, string> = {
    'Lipscomb Bisons': 'Lipscomb',
    'California Golden Bears': 'California',
    'Arkansas-Pine Bluff Golden Lions': 'Arkansas-Pine Bluff',
    'Long Beach St 49ers': 'Long Beach State',
    'Long Beach State 49ers': 'Long Beach State',
    'Miss Valley St Delta Devils': 'Mississippi Valley State',
    'Tenn-Martin Skyhawks': 'UT Martin',
    'Maryland-Eastern Shore Hawks': 'Maryland-Eastern Shore',
    'West Georgia Wolves': 'West Georgia',
  }

  if (directMappings[oddsApiName]) {
    return directMappings[oddsApiName]
  }

  // First, handle common abbreviation expansions before mascot removal
  const preprocessed = oddsApiName
    // Expand "St" to "State" (but not "St." which is for Saint)
    .replace(/\b(Michigan|Missouri|Montana|Arizona|Oregon|Oklahoma|Kansas|Iowa|North Dakota|South Dakota|Kent|Murray|Coppin|Appalachian|Arkansas|Georgia|Chicago|Youngstown|Indiana|Jackson|Mississippi Valley|SE Missouri|Cleveland|Morehead|Colorado|South Carolina|San José|San Jose|Washington|San Diego|Portland|Morgan|Northwestern|Wichita|Ball|Boise|Fresno|Illinois|NC|Penn)\sSt\b/g, '$1 State')
    // Expand other abbreviations
    .replace(/\sUniv\./g, ' University')  // "Boston Univ." → "Boston University"
    .replace(/^SE\s/g, 'Southeastern ')   // "SE Louisiana" → "Southeastern Louisiana"
    // Handle parenthetical city/state codes
    .replace(/\s\(Chi\)/g, ' Chicago')    // "Loyola (Chi)" → "Loyola Chicago"
    .replace(/\s\(MD\)/g, ' Maryland')    // "Loyola (MD)" → "Loyola Maryland"
    .replace(/\s\(PA\)/g, ' Pennsylvania') // "St. Francis (PA)" → "St. Francis Pennsylvania"
    .replace(/\s\(MN\)/g, ' Minnesota')   // "St. Thomas (MN)" → "St. Thomas Minnesota"
    .replace(/\s\(OH\)/g, ' Ohio')        // "Miami (OH)" → "Miami Ohio"
    .trim()

  // Remove common mascot patterns and normalize (order matters - remove compound mascots first)
  const normalized = preprocessed
    .replace(/\s+(Golden Lions|Golden Bears|Golden Eagles|Golden Gophers|Golden Panthers|Golden Grizzlies|Golden Hurricane|Golden Flashes|Golden Griffins)/i, '')  // Remove compound mascots first
    .replace(/\s+(Blue Devils|Tar Heels|Wildcats|Tigers|Bulldogs|Bears|Eagles|Panthers|Lions|Wolfpack|Demon Deacons|Hokies|Cardinals|Fighting Irish|Yellow Jackets|Boilermakers|Fighting Illini|Spartans|Badgers|Hoosiers|Wolverines|Buckeyes|Hawkeyes|Terrapins|Cornhuskers|Bruins|Trojans|Ducks|Huskies|Jayhawks|Cougars|Red Raiders|Cyclones|Horned Frogs|Cowboys|Mountaineers|Bearcats|Knights|Sun Devils|Buffaloes|Utes|Crimson Tide|War Eagles|Volunteers|Gators|Razorbacks|Rebels|Aggies|Gamecocks|Commodores|Longhorns|Sooners|Musketeers|Friars|Pirates|Blue Jays|Nittany Lions|Scarlet Knights|Huskers|Huskies|Orangemen|Orange|Seminoles|Wolfpack|Hurricanes|Rainbow Warriors|Anteaters|Gauchos|Tritons|Highlanders|Titans|Matadors|Mustangs|49ers|Hornets|Lumberjacks|Miners|Hilltoppers|Flames|Bison|Bisons|Warhawks|Purple Aces|Racers|Grizzlies|Bobcats|Thundering Herd|Hatters|Owls|Bulls|Green Wave|Shockers|Flyers|Rams|Billikens|Spiders|Explorers|Patriots|Colonials|Dukes|Bonnies|Minutemen|Aztecs|Wolf Pack|Lobos|Broncos|Falcons|Zags|Gaels|Dons|Ramblers|Waves|Pilots|Toreros|Braves|Redbirds|Sycamores|Salukis|Beacons|Crusaders|Aces|Purple Eagles|Phoenix|Redhawks|Raiders|Norse|Penguins|Mastodons|Jaguars|River Hawks|Retrievers|Seawolves|Seahawks|Blackbirds|Colonels|Skyhawks|Govs|Governors|Screaming Eagles|Leathernecks|Flamingos|Mavericks|Tommies|Catamounts|Black Bears|Great Danes|Danes|Hawks|Ospreys|Dolphins|Royals|Tartans|Nighthawks|Antelopes|Lopes|Thunderbirds|Runnin' Rebels|Techsters|Privateers|Mocs|Buccaneers|Keydets|Terriers|Paladins|Blue Hose|Saints|Thoroughbreds|Delta Devils|Rattlers|Fightin' Hawks|Coyotes|Summit League|Kangaroos|Pioneers|Roos|Red Wolves|Red Storm|Red Flash|Red Foxes|Bluejays|Revolutionaries|Pride|Midshipmen|Vandals|Fighting Camels|Chanticleers|Chippewas|Vikings|Blue Hens|Blue Demons|Roadrunners|Lancers|Fighting Hawks|Sharks|Ragin' Cajuns|Greyhounds|Mountain Hawks|Zips|Leopards|Beavers|Jackrabbits|Hoyas|Stags|Monarchs|Broncs|Cavaliers|Rockets|Demons|Peacocks|Vaqueros|Blazers|Lakers|Wolves|Texans|Trailblazers|Warriors|Cardinal)/i, '')
    .trim()
    // Remove apostrophes (St. John's → St. Johns, Saint Mary's → Saint Marys)
    .replace(/'/g, '')

  // Handle special cases
  const specialCases: Record<string, string> = {
    'UConn': 'UConn',
    'UCLA': 'UCLA',
    'USC': 'USC',
    'UCF': 'UCF',
    'SMU': 'SMU',
    'BYU': 'BYU',
    'TCU': 'TCU',
    'LSU': 'LSU',
    'VCU': 'VCU',
    'UAB': 'UAB',
    'UNLV': 'UNLV',
    'UTEP': 'UTEP',
    'UTSA': 'UTSA',
    'UNC': 'North Carolina',
    'NC State': 'NC State',
    'Miami': 'Miami',
    'Miami Ohio': 'Miami Ohio',
    'St. Johns': 'St. Johns',
    'St. John': 'St. Johns',
    'Saint Johns': 'St. Johns',
    'Saint Mary': 'Saint Marys',
    'Saint Marys': 'Saint Marys',
    'Saint Josephs': 'Saint Josephs',
    'Saint Joseph': 'Saint Josephs',
    'Saint Peters': 'Saint Peters',
    'Saint Peter': 'Saint Peters',
    'St. Francis Pennsylvania': 'St. Francis Brooklyn',  // Map St. Francis (PA) to DB name
    'St. Thomas Minnesota': 'St. Thomas',
    'Ole Miss': 'Ole Miss',
    'Texas A&M': 'Texas A&M',
    'Massachusetts': 'Massachusetts',
    'UNC Wilmington': 'UNC Wilmington',
    'UNC Asheville': 'UNC Asheville',
    'UNC Greensboro': 'UNC Greensboro',
    'Long Island': 'Long Island',
    'Long Beach State': 'Long Beach State',
    'IU Indianapolis': 'IU Indianapolis',
    'Boston University': 'Boston University',
    'Loyola Chicago': 'Loyola Chicago',
    'Loyola Maryland': 'Loyola Maryland',
    'Southeastern Louisiana': 'Southeastern Louisiana',
    'Southeastern Missouri State': 'Southeast Missouri',
    'Southeast Missouri State': 'Southeast Missouri',
    'Mississippi Valley State': 'Mississippi Valley State',
    'San José State': 'San Jose State',  // Handle accented characters
    'GW': 'George Washington',
    'UIC': 'UIC',
    'CSU Bakersfield': 'Cal State Bakersfield',
    'Fort Wayne': 'Purdue Fort Wayne',
    // Fix specific API name variations
    'Lipscomb': 'Lipscomb',  // Prevent "Lipscomb Bisons" → "Lipscombs"
    'California': 'California',  // Prevent "California Golden Bears" → "California Golden"
    'Arkansas-Pine Bluff': 'Arkansas-Pine Bluff',  // Prevent "Arkansas-Pine Bluff Golden Lions" → "Arkansas-Pine Bluff Golden"
    'Northwestern State': 'Northwestern State',
    'Cal Baptist': 'California Baptist',
    'California Baptist': 'California Baptist',
    'USC Upstate': 'SC Upstate',
    'SC Upstate': 'SC Upstate',
    'South Carolina Upstate': 'SC Upstate',
    'UT Rio Grande Valley': 'UT Rio Grande Valley',
    'Tarleton State': 'Tarleton State',
    'Utah Tech': 'Utah Tech',
    'UL Monroe': 'Louisiana Monroe',
    'Louisiana Monroe': 'Louisiana Monroe',
    'Tennessee-Martin': 'UT Martin',
    'Tenn-Martin': 'UT Martin',
    'UT Martin': 'UT Martin',
    'Mount St. Marys': 'Mount St. Marys',
    'Mt. St. Marys': 'Mount St. Marys',
  }

  return specialCases[normalized] || normalized
}
