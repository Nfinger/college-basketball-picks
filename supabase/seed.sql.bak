-- Insert conferences
INSERT INTO conferences (name, short_name, is_power_conference) VALUES
  ('Atlantic Coast Conference', 'ACC', true),
  ('Big Ten Conference', 'B1G', true),
  ('Big 12 Conference', 'B12', true),
  ('Southeastern Conference', 'SEC', true),
  ('Big East Conference', 'BE', true),
  ('Pac-12 Conference', 'P12', true),
  ('American Athletic Conference', 'AAC', false),
  ('Atlantic 10 Conference', 'A10', false),
  ('Mountain West Conference', 'MWC', false),
  ('West Coast Conference', 'WCC', false),
  ('Missouri Valley Conference', 'MVC', false),
  ('Conference USA', 'C-USA', false),
  ('Sun Belt Conference', 'SBC', false),
  ('Mid-American Conference', 'MAC', false),
  ('Horizon League', 'HL', false),
  ('Colonial Athletic Association', 'CAA', false)
ON CONFLICT (name) DO NOTHING;

-- Insert ACC teams
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Duke', 'DUKE', c.id, 'duke'
FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'North Carolina', 'UNC', c.id, 'north-carolina' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Virginia', 'UVA', c.id, 'virginia' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Miami', 'MIA', c.id, 'miami-fl' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Pittsburgh', 'PITT', c.id, 'pittsburgh' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Clemson', 'CLEM', c.id, 'clemson' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Florida State', 'FSU', c.id, 'florida-state' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'NC State', 'NCST', c.id, 'nc-state' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Syracuse', 'SYR', c.id, 'syracuse' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Wake Forest', 'WAKE', c.id, 'wake-forest' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Virginia Tech', 'VT', c.id, 'virginia-tech' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Louisville', 'LOU', c.id, 'louisville' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Notre Dame', 'ND', c.id, 'notre-dame' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Georgia Tech', 'GT', c.id, 'georgia-tech' FROM conferences c WHERE c.short_name = 'ACC'
UNION ALL SELECT 'Boston College', 'BC', c.id, 'boston-college' FROM conferences c WHERE c.short_name = 'ACC'
ON CONFLICT (name) DO NOTHING;

-- Insert Big Ten teams
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Purdue', 'PUR', c.id, 'purdue'
FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Illinois', 'ILL', c.id, 'illinois' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Michigan State', 'MSU', c.id, 'michigan-state' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Wisconsin', 'WISC', c.id, 'wisconsin' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Indiana', 'IND', c.id, 'indiana' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Michigan', 'MICH', c.id, 'michigan' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Ohio State', 'OSU', c.id, 'ohio-state' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Iowa', 'IOWA', c.id, 'iowa' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Maryland', 'MD', c.id, 'maryland' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Northwestern', 'NW', c.id, 'northwestern' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Penn State', 'PSU', c.id, 'penn-state' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Rutgers', 'RU', c.id, 'rutgers' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Minnesota', 'MINN', c.id, 'minnesota' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Nebraska', 'NEB', c.id, 'nebraska' FROM conferences c WHERE c.short_name = 'B1G'
ON CONFLICT (name) DO NOTHING;

-- Insert Big 12 teams
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Kansas', 'KU', c.id, 'kansas'
FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Houston', 'HOU', c.id, 'houston' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Baylor', 'BAY', c.id, 'baylor' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Texas Tech', 'TTU', c.id, 'texas-tech' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Iowa State', 'ISU', c.id, 'iowa-state' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Kansas State', 'KSU', c.id, 'kansas-state' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'TCU', 'TCU', c.id, 'tcu' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Oklahoma State', 'OKST', c.id, 'oklahoma-state' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'West Virginia', 'WVU', c.id, 'west-virginia' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'BYU', 'BYU', c.id, 'byu' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Cincinnati', 'CIN', c.id, 'cincinnati' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'UCF', 'UCF', c.id, 'ucf' FROM conferences c WHERE c.short_name = 'B12'
ON CONFLICT (name) DO NOTHING;

-- Insert SEC teams
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Alabama', 'ALA', c.id, 'alabama'
FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Auburn', 'AUB', c.id, 'auburn' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Tennessee', 'TENN', c.id, 'tennessee' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Kentucky', 'UK', c.id, 'kentucky' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Florida', 'FLA', c.id, 'florida' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Arkansas', 'ARK', c.id, 'arkansas' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Mississippi State', 'MSST', c.id, 'mississippi-state' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Ole Miss', 'MISS', c.id, 'ole-miss' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Texas A&M', 'TAMU', c.id, 'texas-am' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'South Carolina', 'SC', c.id, 'south-carolina' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Georgia', 'UGA', c.id, 'georgia' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'LSU', 'LSU', c.id, 'lsu' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Missouri', 'MIZZ', c.id, 'missouri' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Vanderbilt', 'VAND', c.id, 'vanderbilt' FROM conferences c WHERE c.short_name = 'SEC'
ON CONFLICT (name) DO NOTHING;

-- Insert Big East teams
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'UConn', 'CONN', c.id, 'connecticut'
FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Marquette', 'MARQ', c.id, 'marquette' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Creighton', 'CRE', c.id, 'creighton' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Villanova', 'NOVA', c.id, 'villanova' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Xavier', 'XAV', c.id, 'xavier' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Providence', 'PROV', c.id, 'providence' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Seton Hall', 'SHU', c.id, 'seton-hall' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Butler', 'BUT', c.id, 'butler' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'St. John\'s', 'SJU', c.id, 'st-johns-ny' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Georgetown', 'GTWN', c.id, 'georgetown' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'DePaul', 'DEP', c.id, 'depaul' FROM conferences c WHERE c.short_name = 'BE'
ON CONFLICT (name) DO NOTHING;

-- Insert Pac-12 teams (note: conference is in transition)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Arizona', 'ARIZ', c.id, 'arizona'
FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'UCLA', 'UCLA', c.id, 'ucla' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Oregon', 'ORE', c.id, 'oregon' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'USC', 'USC', c.id, 'usc' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Washington', 'WASH', c.id, 'washington' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Colorado', 'COLO', c.id, 'colorado' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Stanford', 'STAN', c.id, 'stanford' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'California', 'CAL', c.id, 'california' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Utah', 'UTAH', c.id, 'utah' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Arizona State', 'ASU', c.id, 'arizona-state' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Oregon State', 'ORST', c.id, 'oregon-state' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Washington State', 'WSU', c.id, 'washington-state' FROM conferences c WHERE c.short_name = 'P12'
ON CONFLICT (name) DO NOTHING;

-- Insert some mid-major teams (WCC, A10, etc.)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Gonzaga', 'GONZ', c.id, 'gonzaga'
FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Saint Mary\'s', 'SMC', c.id, 'saint-marys-ca' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'San Diego State', 'SDSU', c.id, 'san-diego-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Dayton', 'DAY', c.id, 'dayton' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'VCU', 'VCU', c.id, 'vcu' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Saint Louis', 'SLU', c.id, 'saint-louis' FROM conferences c WHERE c.short_name = 'A10'
ON CONFLICT (name) DO NOTHING;
