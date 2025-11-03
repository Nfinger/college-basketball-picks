/**
 * Maps team names from The Odds API to database team names
 * The Odds API uses full names with mascots (e.g., "Duke Blue Devils")
 * Our database uses simplified names (e.g., "Duke")
 */

export function normalizeTeamName(oddsApiName: string): string {
  // First, handle common abbreviation expansions before mascot removal
  let preprocessed = oddsApiName
    // Expand "St" to "State" (but not "St." which is for Saint)
    .replace(/\sSt\s/g, ' State ')  // "Michigan St Spartans" → "Michigan State Spartans"
    .replace(/\sSt$/g, ' State')     // "Michigan St" → "Michigan State"
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

  // Remove common mascot patterns and normalize
  const normalized = preprocessed
    .replace(/\s+(Blue Devils|Tar Heels|Wildcats|Tigers|Bulldogs|Bears|Eagles|Panthers|Lions|Wolfpack|Demon Deacons|Hokies|Cardinals|Fighting Irish|Yellow Jackets|Boilermakers|Fighting Illini|Spartans|Badgers|Hoosiers|Wolverines|Buckeyes|Hawkeyes|Terrapins|Cornhuskers|Bruins|Trojans|Ducks|Huskies|Jayhawks|Cougars|Red Raiders|Cyclones|Horned Frogs|Cowboys|Mountaineers|Bearcats|Knights|Sun Devils|Buffaloes|Utes|Crimson Tide|War Eagles|Volunteers|Gators|Razorbacks|Rebels|Aggies|Gamecocks|Commodores|Longhorns|Sooners|Golden Eagles|Musketeers|Friars|Pirates|Blue Jays|Nittany Lions|Scarlet Knights|Golden Gophers|Huskers|Huskies|Orangemen|Orange|Seminoles|Wolfpack|Hurricanes|Rainbow Warriors|Anteaters|Gauchos|Tritons|Highlanders|Titans|Matadors|Mustangs|49ers|Beach|Hornets|Rainbow Warriors|Lumberjacks|Aggies|Miners|Hilltoppers|Golden Panthers|Gamecocks|Golden Eagles|Flames|Bison|Warhawks|Purple Aces|Racers|Bruins|Flames|Lions|Grizzlies|Bobcats|Thundering Herd|Hatters|Eagles|Owls|Bulls|Green Wave|Shockers|Golden Hurricane|Flyers|Rams|Billikens|Spiders|Explorers|Patriots|Colonials|Dukes|Bonnies|Minutemen|Aztecs|Wolf Pack|Lobos|Broncos|Rams|Cowboys|Aggies|Rebels|Falcons|Bulldogs|Spartans|Zags|Gaels|Dons|Broncos|Ramblers|Lions|Waves|Pilots|Toreros|Bulldogs|Braves|Redbirds|Sycamores|Bears|Purple Aces|Salukis|Beacons|Crusaders|Aces|Purple Eagles|Phoenix|Redhawks|Raiders|Flyers|Golden Grizzlies|Norse|Penguins|Mastodons|Jaguars|River Hawks|Retrievers|Bearcats|Seawolves|Seahawks|Blackbirds|Colonels|Redhawks|Panthers|Skyhawks|Govs|Governors|Redhawks|Cougars|Screaming Eagles|Lions|Leathernecks|Bison|Flamingos|Mavericks|Tommies|Raiders|Catamounts|Black Bears|Wildcats|Great Danes|Danes|River Hawks|Retrievers|Bearcats|Hawks|Hatters|Ospreys|Dolphins|Dons|Flames|Lipscomb Bisons|Bears|Royals|Tartans|Nighthawks|Lions|Antelopes|Redhawks|Lopes|Thunderbirds|Runnin' Rebels|Aggies|Techsters|Wolverines|Eagles|Privateers|Phoenix|Golden Eagles|Mocs|Buccaneers|Spartans|Keydets|Bulldogs|Terriers|Paladins|Bears|Catamounts|Colonels|Blue Hose|Saints|Hilltoppers|Thoroughbreds|Delta Devils|Braves|Hornets|Tigers|Jaguars|Bison|Panthers|Wildcats|Rattlers|Eagles|Bison|Fightin' Hawks|Mavericks|Coyotes|Summit League|Kangaroos|Pioneers|Roos|Purple Aces|Red Wolves|Red Storm|Red Flash|Red Foxes|Bluejays|Revolutionaries|Pride|Midshipmen|Vandals|Fighting Camels|Golden Griffins|Chanticleers|Chippewas|Vikings|Blue Hens|Blue Demons|Roadrunners|Great Danes|Lancers|Fighting Hawks|Sharks|Ragin' Cajuns|Greyhounds|Mountain Hawks|Zips|Golden Flashes|Leopards|Beavers|Jackrabbits)/i, '')
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
    'St. Francis Pennsylvania': 'St. Francis Brooklyn',  // Map St. Francis (PA) to DB name
    'St. Thomas Minnesota': 'St. Thomas',
    'Ole Miss': 'Ole Miss',
    'Texas A&M': 'Texas A&M',
    'Massachusetts': 'Massachusetts',
    'UNC Wilmington': 'UNC Wilmington',
    'UNC Asheville': 'UNC Asheville',
    'UNC Greensboro': 'UNC Greensboro',
    'Long Island': 'Long Island',
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
  }

  return specialCases[normalized] || normalized
}
