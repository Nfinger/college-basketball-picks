/**
 * Maps team names from The Odds API to database team names
 * The Odds API uses full names with mascots (e.g., "Duke Blue Devils")
 * Our database uses simplified names (e.g., "Duke")
 */

export function normalizeTeamName(oddsApiName: string): string {
  // Remove common mascot patterns and normalize
  const normalized = oddsApiName
    .replace(/\s+(Blue Devils|Tar Heels|Wildcats|Tigers|Bulldogs|Bears|Eagles|Panthers|Lions|Wolfpack|Demon Deacons|Hokies|Cardinals|Fighting Irish|Yellow Jackets|Boilermakers|Fighting Illini|Spartans|Badgers|Hoosiers|Wolverines|Buckeyes|Hawkeyes|Terrapins|Cornhuskers|Bruins|Trojans|Ducks|Huskies|Jayhawks|Cougars|Red Raiders|Cyclones|Horned Frogs|Cowboys|Mountaineers|Bearcats|Knights|Sun Devils|Buffaloes|Utes|Crimson Tide|War Eagles|Volunteers|Gators|Razorbacks|Rebels|Aggies|Gamecocks|Commodores|Longhorns|Sooners|Golden Eagles|Musketeers|Friars|Pirates|Blue Jays|Nittany Lions|Scarlet Knights|Golden Gophers|Huskers|Huskies|Orangemen|Orange|Seminoles|Wolfpack|Hurricanes|Rainbow Warriors|Anteaters|Gauchos|Tritons|Highlanders|Titans|Matadors|Mustangs|49ers|Beach|Hornets|Rainbow Warriors|Lumberjacks|Aggies|Miners|Hilltoppers|Golden Panthers|Gamecocks|Golden Eagles|Flames|Bison|Warhawks|Purple Aces|Racers|Bruins|Flames|Lions|Grizzlies|Bobcats|Thundering Herd|Hatters|Eagles|Owls|Bulls|Green Wave|Shockers|Golden Hurricane|Flyers|Rams|Billikens|Spiders|Explorers|Patriots|Colonials|Dukes|Bonnies|Minutemen|Aztecs|Wolf Pack|Lobos|Broncos|Rams|Cowboys|Aggies|Rebels|Falcons|Bulldogs|Spartans|Zags|Gaels|Dons|Broncos|Ramblers|Lions|Waves|Pilots|Toreros|Bulldogs|Braves|Redbirds|Sycamores|Bears|Purple Aces|Salukis|Beacons|Crusaders|Aces|Purple Eagles|Phoenix|Redhawks|Raiders|Flyers|Golden Grizzlies|Norse|Penguins|Mastodons|Jaguars|River Hawks|Retrievers|Bearcats|Seawolves|Seahawks|Blackbirds|Colonels|Redhawks|Panthers|Skyhawks|Govs|Governors|Redhawks|Cougars|Screaming Eagles|Lions|Leathernecks|Bison|Flamingos|Mavericks|Tommies|Raiders|Catamounts|Black Bears|Wildcats|Great Danes|Danes|River Hawks|Retrievers|Bearcats|Hawks|Hatters|Ospreys|Dolphins|Dons|Flames|Lipscomb Bisons|Bears|Royals|Tartans|Nighthawks|Lions|Antelopes|Redhawks|Lopes|Thunderbirds|Runnin' Rebels|Aggies|Techsters|Wolverines|Eagles|Privateers|Phoenix|Golden Eagles|Mocs|Buccaneers|Spartans|Keydets|Bulldogs|Terriers|Paladins|Bears|Catamounts|Colonels|Blue Hose|Saints|Hilltoppers|Thoroughbreds|Delta Devils|Braves|Hornets|Tigers|Jaguars|Bison|Panthers|Wildcats|Rattlers|Eagles|Bison|Fightin' Hawks|Mavericks|Coyotes|Summit League|Kangaroos|Pioneers|Roos|Purple Aces)/i, '')
    .trim()

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
    'Miami (FL)': 'Miami',
    'Miami FL': 'Miami',
    'St. John\'s': 'St. Johns',
    'Saint John\'s': 'St. Johns',
    'St. Mary\'s': 'Saint Marys',
    'Saint Mary\'s': 'Saint Marys',
    'Saint Joseph\'s': 'Saint Josephs',
    'St. Joseph\'s': 'Saint Josephs',
    'Ole Miss': 'Ole Miss',
    'Texas A&M': 'Texas A&M',
    'UMass': 'Massachusetts',
    'UNC Wilmington': 'UNC Wilmington',
    'UNC Asheville': 'UNC Asheville',
    'UNC Greensboro': 'UNC Greensboro',
    'LIU': 'Long Island',
    'IUPUI': 'IU Indianapolis',
    'Miami (OH)': 'Miami Ohio',
    'Miami OH': 'Miami Ohio',
  }

  return specialCases[normalized] || normalized
}
