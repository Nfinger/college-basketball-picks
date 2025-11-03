-- Complete D1 College Basketball Teams Seed Data (350+ teams)

-- Insert all D1 conferences (32 total)
INSERT INTO conferences (name, short_name, is_power_conference) VALUES
  -- Power 6 Conferences
  ('Atlantic Coast Conference', 'ACC', true),
  ('Big Ten Conference', 'B1G', true),
  ('Big 12 Conference', 'B12', true),
  ('Southeastern Conference', 'SEC', true),
  ('Big East Conference', 'BE', true),
  ('Pac-12 Conference', 'P12', true),
  -- Major Mid-Major Conferences
  ('American Athletic Conference', 'AAC', false),
  ('Atlantic 10 Conference', 'A10', false),
  ('Mountain West Conference', 'MWC', false),
  ('West Coast Conference', 'WCC', false),
  ('Missouri Valley Conference', 'MVC', false),
  -- Other D1 Conferences
  ('Conference USA', 'C-USA', false),
  ('Sun Belt Conference', 'SBC', false),
  ('Mid-American Conference', 'MAC', false),
  ('Horizon League', 'HL', false),
  ('Colonial Athletic Association', 'CAA', false),
  ('Big Sky Conference', 'BSky', false),
  ('Big South Conference', 'BSth', false),
  ('Big West Conference', 'BW', false),
  ('Ivy League', 'IVY', false),
  ('Metro Atlantic Athletic Conference', 'MAAC', false),
  ('Northeast Conference', 'NEC', false),
  ('Ohio Valley Conference', 'OVC', false),
  ('Patriot League', 'PAT', false),
  ('Southern Conference', 'SoCon', false),
  ('Southland Conference', 'Southland', false),
  ('Southwestern Athletic Conference', 'SWAC', false),
  ('Summit League', 'Summit', false),
  ('America East Conference', 'AE', false),
  ('ASUN Conference', 'ASUN', false),
  ('WAC', 'WAC', false),
  ('MEAC', 'MEAC', false),
  -- Independent/Unknown Conference for auto-created teams
  ('Independent', 'IND', false)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- POWER 6 CONFERENCES (80 teams)
-- ============================================

-- ACC (15 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Duke', 'DUKE', c.id, 'duke' FROM conferences c WHERE c.short_name = 'ACC'
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

-- Big Ten (18 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Purdue', 'PUR', c.id, 'purdue' FROM conferences c WHERE c.short_name = 'B1G'
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
UNION ALL SELECT 'UCLA', 'UCLA', c.id, 'ucla' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'USC', 'USC', c.id, 'usc' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Oregon', 'ORE', c.id, 'oregon' FROM conferences c WHERE c.short_name = 'B1G'
UNION ALL SELECT 'Washington', 'WASH', c.id, 'washington' FROM conferences c WHERE c.short_name = 'B1G'
ON CONFLICT (name) DO NOTHING;

-- Big 12 (16 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Kansas', 'KU', c.id, 'kansas' FROM conferences c WHERE c.short_name = 'B12'
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
UNION ALL SELECT 'Arizona', 'ARIZ', c.id, 'arizona' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Arizona State', 'ASU', c.id, 'arizona-state' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Colorado', 'COLO', c.id, 'colorado' FROM conferences c WHERE c.short_name = 'B12'
UNION ALL SELECT 'Utah', 'UTAH', c.id, 'utah' FROM conferences c WHERE c.short_name = 'B12'
ON CONFLICT (name) DO NOTHING;

-- SEC (16 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Alabama', 'ALA', c.id, 'alabama' FROM conferences c WHERE c.short_name = 'SEC'
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
UNION ALL SELECT 'Texas', 'TEX', c.id, 'texas' FROM conferences c WHERE c.short_name = 'SEC'
UNION ALL SELECT 'Oklahoma', 'OU', c.id, 'oklahoma' FROM conferences c WHERE c.short_name = 'SEC'
ON CONFLICT (name) DO NOTHING;

-- Big East (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'UConn', 'CONN', c.id, 'connecticut' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Marquette', 'MARQ', c.id, 'marquette' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Creighton', 'CRE', c.id, 'creighton' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Villanova', 'NOVA', c.id, 'villanova' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Xavier', 'XAV', c.id, 'xavier' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Providence', 'PROV', c.id, 'providence' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Seton Hall', 'SHU', c.id, 'seton-hall' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Butler', 'BUT', c.id, 'butler' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'St. Johns', 'SJU', c.id, 'st-johns-ny' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'Georgetown', 'GTWN', c.id, 'georgetown' FROM conferences c WHERE c.short_name = 'BE'
UNION ALL SELECT 'DePaul', 'DEP', c.id, 'depaul' FROM conferences c WHERE c.short_name = 'BE'
ON CONFLICT (name) DO NOTHING;

-- Pac-12 (4 remaining teams - others moved to Big Ten/Big 12)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Stanford', 'STAN', c.id, 'stanford' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'California', 'CAL', c.id, 'california' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Oregon State', 'ORST', c.id, 'oregon-state' FROM conferences c WHERE c.short_name = 'P12'
UNION ALL SELECT 'Washington State', 'WSU', c.id, 'washington-state' FROM conferences c WHERE c.short_name = 'P12'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- MAJOR MID-MAJOR CONFERENCES (62 teams)
-- ============================================

-- AAC (14 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Memphis', 'MEM', c.id, 'memphis' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Temple', 'TEM', c.id, 'temple' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'SMU', 'SMU', c.id, 'smu' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Wichita State', 'WICH', c.id, 'wichita-state' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Tulsa', 'TLSA', c.id, 'tulsa' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Tulane', 'TULN', c.id, 'tulane' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'South Florida', 'USF', c.id, 'south-florida' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'East Carolina', 'ECU', c.id, 'east-carolina' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'UAB', 'UAB', c.id, 'uab' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'North Texas', 'UNT', c.id, 'north-texas' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Rice', 'RICE', c.id, 'rice' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'UTSA', 'UTSA', c.id, 'utsa' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Charlotte', 'CHAR', c.id, 'charlotte' FROM conferences c WHERE c.short_name = 'AAC'
UNION ALL SELECT 'Florida Atlantic', 'FAU', c.id, 'florida-atlantic' FROM conferences c WHERE c.short_name = 'AAC'
ON CONFLICT (name) DO NOTHING;

-- Atlantic 10 (15 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Dayton', 'DAY', c.id, 'dayton' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'VCU', 'VCU', c.id, 'vcu' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Saint Louis', 'SLU', c.id, 'saint-louis' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Rhode Island', 'URI', c.id, 'rhode-island' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Richmond', 'RICH', c.id, 'richmond' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Davidson', 'DAV', c.id, 'davidson' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Saint Josephs', 'SJU', c.id, 'saint-josephs' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'George Mason', 'GMU', c.id, 'george-mason' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'George Washington', 'GW', c.id, 'george-washington' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'La Salle', 'LAS', c.id, 'la-salle' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Duquesne', 'DUQ', c.id, 'duquesne' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'St. Bonaventure', 'SBU', c.id, 'st-bonaventure' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Massachusetts', 'UMASS', c.id, 'massachusetts' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Fordham', 'FOR', c.id, 'fordham' FROM conferences c WHERE c.short_name = 'A10'
UNION ALL SELECT 'Loyola Chicago', 'LUC', c.id, 'loyola-chicago' FROM conferences c WHERE c.short_name = 'A10'
ON CONFLICT (name) DO NOTHING;

-- Mountain West (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'San Diego State', 'SDSU', c.id, 'san-diego-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Nevada', 'NEV', c.id, 'nevada' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'New Mexico', 'UNM', c.id, 'new-mexico' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Boise State', 'BSU', c.id, 'boise-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Colorado State', 'CSU', c.id, 'colorado-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Wyoming', 'WYO', c.id, 'wyoming' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Utah State', 'USU', c.id, 'utah-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'UNLV', 'UNLV', c.id, 'unlv' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Air Force', 'AFA', c.id, 'air-force' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'Fresno State', 'FRES', c.id, 'fresno-state' FROM conferences c WHERE c.short_name = 'MWC'
UNION ALL SELECT 'San Jose State', 'SJSU', c.id, 'san-jose-state' FROM conferences c WHERE c.short_name = 'MWC'
ON CONFLICT (name) DO NOTHING;

-- WCC (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Gonzaga', 'GONZ', c.id, 'gonzaga' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Saint Marys', 'SMC', c.id, 'saint-marys-ca' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'San Francisco', 'USF', c.id, 'san-francisco' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Santa Clara', 'SCU', c.id, 'santa-clara' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Loyola Marymount', 'LMU', c.id, 'loyola-marymount' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Pacific', 'PAC', c.id, 'pacific' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Pepperdine', 'PEPP', c.id, 'pepperdine' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Portland', 'PORT', c.id, 'portland' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'San Diego', 'USD', c.id, 'san-diego' FROM conferences c WHERE c.short_name = 'WCC'
UNION ALL SELECT 'Washington State', 'WSU-WCC', c.id, 'washington-state' FROM conferences c WHERE c.short_name = 'WCC'
ON CONFLICT (name) DO NOTHING;

-- MVC (12 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Drake', 'DRKE', c.id, 'drake' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Bradley', 'BRAD', c.id, 'bradley' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Illinois State', 'ILST', c.id, 'illinois-state' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Indiana State', 'INST', c.id, 'indiana-state' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Missouri State', 'MOST', c.id, 'missouri-state' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Northern Iowa', 'UNI', c.id, 'northern-iowa' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Southern Illinois', 'SIU', c.id, 'southern-illinois' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Valparaiso', 'VALP', c.id, 'valparaiso' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Evansville', 'EVAN', c.id, 'evansville' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Murray State', 'MURR', c.id, 'murray-state' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'Belmont', 'BEL', c.id, 'belmont' FROM conferences c WHERE c.short_name = 'MVC'
UNION ALL SELECT 'UIC', 'UIC', c.id, 'illinois-chicago' FROM conferences c WHERE c.short_name = 'MVC'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- OTHER D1 CONFERENCES (220+ teams)
-- ============================================

-- Conference USA (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Louisiana Tech', 'LT', c.id, 'louisiana-tech' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'UTEP', 'UTEP', c.id, 'utep' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Middle Tennessee', 'MTSU', c.id, 'middle-tennessee' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Western Kentucky', 'WKU', c.id, 'western-kentucky' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Florida International', 'FIU', c.id, 'florida-international' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Jacksonville State', 'JSU', c.id, 'jacksonville-state' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Liberty', 'LIB', c.id, 'liberty' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'New Mexico State', 'NMSU', c.id, 'new-mexico-state' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Sam Houston', 'SHSU', c.id, 'sam-houston-state' FROM conferences c WHERE c.short_name = 'C-USA'
UNION ALL SELECT 'Kennesaw State', 'KSU-CUSA', c.id, 'kennesaw-state' FROM conferences c WHERE c.short_name = 'C-USA'
ON CONFLICT (name) DO NOTHING;

-- Sun Belt (14 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Appalachian State', 'APP', c.id, 'appalachian-state' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Arkansas State', 'ARST', c.id, 'arkansas-state' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Coastal Carolina', 'CCU', c.id, 'coastal-carolina' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Georgia Southern', 'GASO', c.id, 'georgia-southern' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Georgia State', 'GAST', c.id, 'georgia-state' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'James Madison', 'JMU', c.id, 'james-madison' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Louisiana', 'ULL', c.id, 'louisiana-lafayette' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Louisiana Monroe', 'ULM', c.id, 'louisiana-monroe' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Marshall', 'MRSH', c.id, 'marshall' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Old Dominion', 'ODU', c.id, 'old-dominion' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'South Alabama', 'USA', c.id, 'south-alabama' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Southern Miss', 'USM', c.id, 'southern-mississippi' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Texas State', 'TXST', c.id, 'texas-state' FROM conferences c WHERE c.short_name = 'SBC'
UNION ALL SELECT 'Troy', 'TROY', c.id, 'troy' FROM conferences c WHERE c.short_name = 'SBC'
ON CONFLICT (name) DO NOTHING;

-- MAC (12 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Akron', 'AKR', c.id, 'akron' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Ball State', 'BALL', c.id, 'ball-state' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Bowling Green', 'BGSU', c.id, 'bowling-green' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Buffalo', 'BUFF', c.id, 'buffalo' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Central Michigan', 'CMU', c.id, 'central-michigan' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Eastern Michigan', 'EMU', c.id, 'eastern-michigan' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Kent State', 'KENT', c.id, 'kent-state' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Miami Ohio', 'M-OH', c.id, 'miami-oh' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Northern Illinois', 'NIU', c.id, 'northern-illinois' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Ohio', 'OHIO', c.id, 'ohio' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Toledo', 'TOL', c.id, 'toledo' FROM conferences c WHERE c.short_name = 'MAC'
UNION ALL SELECT 'Western Michigan', 'WMU', c.id, 'western-michigan' FROM conferences c WHERE c.short_name = 'MAC'
ON CONFLICT (name) DO NOTHING;

-- Horizon League (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Wright State', 'WSU-HL', c.id, 'wright-state' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Cleveland State', 'CLEV', c.id, 'cleveland-state' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Milwaukee', 'MIL', c.id, 'milwaukee' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Oakland', 'OAK', c.id, 'oakland' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Northern Kentucky', 'NKU', c.id, 'northern-kentucky' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Youngstown State', 'YSU', c.id, 'youngstown-state' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Green Bay', 'GB', c.id, 'green-bay' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Robert Morris', 'RMU', c.id, 'robert-morris' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Purdue Fort Wayne', 'PFW', c.id, 'purdue-fort-wayne' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'Detroit Mercy', 'DET', c.id, 'detroit-mercy' FROM conferences c WHERE c.short_name = 'HL'
UNION ALL SELECT 'IU Indianapolis', 'IUPUI', c.id, 'iupui' FROM conferences c WHERE c.short_name = 'HL'
ON CONFLICT (name) DO NOTHING;

-- CAA (13 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Charleston', 'COFC', c.id, 'charleston' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Delaware', 'DEL', c.id, 'delaware' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Drexel', 'DREX', c.id, 'drexel' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Elon', 'ELON', c.id, 'elon' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Hampton', 'HAMP', c.id, 'hampton' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Hofstra', 'HOF', c.id, 'hofstra' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Monmouth', 'MONM', c.id, 'monmouth' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Northeastern', 'NEAS', c.id, 'northeastern' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'North Carolina A&T', 'NCAT', c.id, 'north-carolina-at' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Stony Brook', 'SBU-CAA', c.id, 'stony-brook' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'Towson', 'TOWS', c.id, 'towson' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'UNC Wilmington', 'UNCW', c.id, 'unc-wilmington' FROM conferences c WHERE c.short_name = 'CAA'
UNION ALL SELECT 'William & Mary', 'W&M', c.id, 'william-mary' FROM conferences c WHERE c.short_name = 'CAA'
ON CONFLICT (name) DO NOTHING;

-- Big Sky (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Montana', 'MONT', c.id, 'montana' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Montana State', 'MTST', c.id, 'montana-state' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Weber State', 'WEB', c.id, 'weber-state' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Eastern Washington', 'EWU', c.id, 'eastern-washington' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Northern Arizona', 'NAU', c.id, 'northern-arizona' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Idaho State', 'IDST', c.id, 'idaho-state' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Northern Colorado', 'UNC', c.id, 'northern-colorado' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Portland State', 'PSU-BSky', c.id, 'portland-state' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Sacramento State', 'SAC', c.id, 'sacramento-state' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Idaho', 'IDHO', c.id, 'idaho' FROM conferences c WHERE c.short_name = 'BSky'
UNION ALL SELECT 'Northern Arizona', 'NAZ', c.id, 'northern-arizona' FROM conferences c WHERE c.short_name = 'BSky'
ON CONFLICT (name) DO NOTHING;

-- Big South (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'High Point', 'HPU', c.id, 'high-point' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Winthrop', 'WIN', c.id, 'winthrop' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Radford', 'RAD', c.id, 'radford' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'UNC Asheville', 'UNCA', c.id, 'unc-asheville' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Gardner-Webb', 'GWU', c.id, 'gardner-webb' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Presbyterian', 'PC', c.id, 'presbyterian' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Charleston Southern', 'CSU-BSth', c.id, 'charleston-southern' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Longwood', 'LONG', c.id, 'longwood' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'Campbell', 'CAMP', c.id, 'campbell' FROM conferences c WHERE c.short_name = 'BSth'
UNION ALL SELECT 'SC Upstate', 'UPST', c.id, 'south-carolina-upstate' FROM conferences c WHERE c.short_name = 'BSth'
ON CONFLICT (name) DO NOTHING;

-- Big West (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'UC Irvine', 'UCI', c.id, 'uc-irvine' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'UC Davis', 'UCD', c.id, 'uc-davis' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'UC Santa Barbara', 'UCSB', c.id, 'uc-santa-barbara' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'UC San Diego', 'UCSD', c.id, 'uc-san-diego' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'UC Riverside', 'UCR', c.id, 'uc-riverside' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Cal State Fullerton', 'CSUF', c.id, 'cal-state-fullerton' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Cal State Northridge', 'CSUN', c.id, 'cal-state-northridge' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Cal Poly', 'CP', c.id, 'cal-poly' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Long Beach State', 'LBSU', c.id, 'long-beach-state' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Cal State Bakersfield', 'CSUB', c.id, 'cal-state-bakersfield' FROM conferences c WHERE c.short_name = 'BW'
UNION ALL SELECT 'Hawaii', 'HAW', c.id, 'hawaii' FROM conferences c WHERE c.short_name = 'BW'
ON CONFLICT (name) DO NOTHING;

-- Ivy League (8 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Princeton', 'PRIN', c.id, 'princeton' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Yale', 'YALE', c.id, 'yale' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Harvard', 'HARV', c.id, 'harvard' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Penn', 'PENN', c.id, 'pennsylvania' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Cornell', 'COR', c.id, 'cornell' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Columbia', 'CLMB', c.id, 'columbia' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Brown', 'BRWN', c.id, 'brown' FROM conferences c WHERE c.short_name = 'IVY'
UNION ALL SELECT 'Dartmouth', 'DART', c.id, 'dartmouth' FROM conferences c WHERE c.short_name = 'IVY'
ON CONFLICT (name) DO NOTHING;

-- MAAC (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Iona', 'IONA', c.id, 'iona' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Quinnipiac', 'QUIN', c.id, 'quinnipiac' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Marist', 'MAR', c.id, 'marist' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Siena', 'SIE', c.id, 'siena' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Fairfield', 'FAIR', c.id, 'fairfield' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Manhattan', 'MAN', c.id, 'manhattan' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Niagara', 'NIAG', c.id, 'niagara' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Rider', 'RID', c.id, 'rider' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Canisius', 'CAN', c.id, 'canisius' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Saint Peters', 'SPU', c.id, 'saint-peters' FROM conferences c WHERE c.short_name = 'MAAC'
UNION ALL SELECT 'Mount St. Marys', 'MSM', c.id, 'mount-st-marys' FROM conferences c WHERE c.short_name = 'MAAC'
ON CONFLICT (name) DO NOTHING;

-- NEC (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Fairleigh Dickinson', 'FDU', c.id, 'fairleigh-dickinson' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Wagner', 'WAG', c.id, 'wagner' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Bryant', 'BRY', c.id, 'bryant' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Sacred Heart', 'SHU-NEC', c.id, 'sacred-heart' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Central Connecticut', 'CCSU', c.id, 'central-connecticut' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Long Island', 'LIU', c.id, 'long-island-university' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Merrimack', 'MER', c.id, 'merrimack' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'St. Francis Brooklyn', 'SFB', c.id, 'st-francis-ny' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Stonehill', 'STON', c.id, 'stonehill' FROM conferences c WHERE c.short_name = 'NEC'
UNION ALL SELECT 'Le Moyne', 'LEM', c.id, 'le-moyne' FROM conferences c WHERE c.short_name = 'NEC'
ON CONFLICT (name) DO NOTHING;

-- OVC (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Morehead State', 'MOR', c.id, 'morehead-state' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Tennessee State', 'TNST', c.id, 'tennessee-state' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Tennessee Tech', 'TTU-OVC', c.id, 'tennessee-tech' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Austin Peay', 'APSU', c.id, 'austin-peay' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Southeast Missouri', 'SEMO', c.id, 'southeast-missouri-state' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'SIU Edwardsville', 'SIUE', c.id, 'siu-edwardsville' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'UT Martin', 'UTM', c.id, 'tennessee-martin' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Eastern Illinois', 'EIU', c.id, 'eastern-illinois' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Lindenwood', 'LIN', c.id, 'lindenwood' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Little Rock', 'UALR', c.id, 'arkansas-little-rock' FROM conferences c WHERE c.short_name = 'OVC'
UNION ALL SELECT 'Southern Indiana', 'USI', c.id, 'southern-indiana' FROM conferences c WHERE c.short_name = 'OVC'
ON CONFLICT (name) DO NOTHING;

-- Patriot League (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Colgate', 'COLG', c.id, 'colgate' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Navy', 'NAVY', c.id, 'navy' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Army', 'ARMY', c.id, 'army' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Boston University', 'BU', c.id, 'boston-university' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Lehigh', 'LEH', c.id, 'lehigh' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Lafayette', 'LAF', c.id, 'lafayette' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'American', 'AU', c.id, 'american' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Bucknell', 'BUCK', c.id, 'bucknell' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Holy Cross', 'HC', c.id, 'holy-cross' FROM conferences c WHERE c.short_name = 'PAT'
UNION ALL SELECT 'Loyola Maryland', 'LOY-MD', c.id, 'loyola-md' FROM conferences c WHERE c.short_name = 'PAT'
ON CONFLICT (name) DO NOTHING;

-- SoCon (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Furman', 'FUR', c.id, 'furman' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'Samford', 'SAM', c.id, 'samford' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'Chattanooga', 'CHAT', c.id, 'chattanooga' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'ETSU', 'ETSU', c.id, 'east-tennessee-state' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'UNC Greensboro', 'UNCG', c.id, 'unc-greensboro' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'VMI', 'VMI', c.id, 'virginia-military-institute' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'The Citadel', 'CIT', c.id, 'citadel' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'Wofford', 'WOF', c.id, 'wofford' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'Mercer', 'MERC', c.id, 'mercer' FROM conferences c WHERE c.short_name = 'SoCon'
UNION ALL SELECT 'Western Carolina', 'WCU', c.id, 'western-carolina' FROM conferences c WHERE c.short_name = 'SoCon'
ON CONFLICT (name) DO NOTHING;

-- Southland (11 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'McNeese', 'MCN', c.id, 'mcneese-state' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Nicholls', 'NICH', c.id, 'nicholls-state' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Northwestern State', 'NWST', c.id, 'northwestern-state' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Southeastern Louisiana', 'SELA', c.id, 'southeastern-louisiana' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Texas A&M Corpus Christi', 'AMCC', c.id, 'texas-am-corpus-christi' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Incarnate Word', 'UIW', c.id, 'incarnate-word' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Houston Christian', 'HCU', c.id, 'houston-baptist' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Lamar', 'LAM', c.id, 'lamar' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'New Orleans', 'UNO', c.id, 'new-orleans' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'East Texas A&M', 'ETAM', c.id, 'texas-am-commerce' FROM conferences c WHERE c.short_name = 'Southland'
UNION ALL SELECT 'Tarleton State', 'TARLTN', c.id, 'tarleton-state' FROM conferences c WHERE c.short_name = 'Southland'
ON CONFLICT (name) DO NOTHING;

-- SWAC (12 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Grambling', 'GRAM', c.id, 'grambling' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Southern', 'SOU', c.id, 'southern' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Texas Southern', 'TXSO', c.id, 'texas-southern' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Prairie View A&M', 'PVAM', c.id, 'prairie-view' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Jackson State', 'JKST', c.id, 'jackson-state' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Alcorn State', 'ALCN', c.id, 'alcorn-state' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Mississippi Valley State', 'MVSU', c.id, 'mississippi-valley-state' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Alabama State', 'ALST', c.id, 'alabama-state' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Alabama A&M', 'AAMU', c.id, 'alabama-am' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Arkansas-Pine Bluff', 'UAPB', c.id, 'arkansas-pine-bluff' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Bethune-Cookman', 'BCU', c.id, 'bethune-cookman' FROM conferences c WHERE c.short_name = 'SWAC'
UNION ALL SELECT 'Florida A&M', 'FAMU', c.id, 'florida-am' FROM conferences c WHERE c.short_name = 'SWAC'
ON CONFLICT (name) DO NOTHING;

-- Summit League (10 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'South Dakota State', 'SDSU-SUM', c.id, 'south-dakota-state' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'North Dakota State', 'NDSU', c.id, 'north-dakota-state' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'Oral Roberts', 'ORU', c.id, 'oral-roberts' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'South Dakota', 'USD-SUM', c.id, 'south-dakota' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'North Dakota', 'UND', c.id, 'north-dakota' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'Omaha', 'UNO-SUM', c.id, 'nebraska-omaha' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'Denver', 'DEN', c.id, 'denver' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'Kansas City', 'UMKC', c.id, 'kansas-city' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'St. Thomas', 'STTM', c.id, 'st-thomas-mn' FROM conferences c WHERE c.short_name = 'Summit'
UNION ALL SELECT 'Western Illinois', 'WIU', c.id, 'western-illinois' FROM conferences c WHERE c.short_name = 'Summit'
ON CONFLICT (name) DO NOTHING;

-- America East (9 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Vermont', 'VT-AE', c.id, 'vermont' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'Maine', 'ME', c.id, 'maine' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'New Hampshire', 'UNH', c.id, 'new-hampshire' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'Albany', 'ALB', c.id, 'albany-ny' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'UMass Lowell', 'UML', c.id, 'umass-lowell' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'UMBC', 'UMBC', c.id, 'umbc' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'Binghamton', 'BING', c.id, 'binghamton' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'Bryant', 'BRY-AE', c.id, 'bryant' FROM conferences c WHERE c.short_name = 'AE'
UNION ALL SELECT 'NJIT', 'NJIT', c.id, 'njit' FROM conferences c WHERE c.short_name = 'AE'
ON CONFLICT (name) DO NOTHING;

-- ASUN (12 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Lipscomb', 'LIP', c.id, 'lipscomb' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Bellarmine', 'BELL', c.id, 'bellarmine' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Queens', 'QUE', c.id, 'queens-nc' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'North Florida', 'UNF', c.id, 'north-florida' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Florida Gulf Coast', 'FGCU', c.id, 'florida-gulf-coast' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Jacksonville', 'JAX', c.id, 'jacksonville' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Stetson', 'STET', c.id, 'stetson' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Central Arkansas', 'UCA', c.id, 'central-arkansas' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Austin Peay', 'APSU-ASUN', c.id, 'austin-peay' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Eastern Kentucky', 'EKU', c.id, 'eastern-kentucky' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'North Alabama', 'UNA', c.id, 'north-alabama' FROM conferences c WHERE c.short_name = 'ASUN'
UNION ALL SELECT 'Queens Charlotte', 'QUC', c.id, 'queens-university-charlotte' FROM conferences c WHERE c.short_name = 'ASUN'
ON CONFLICT (name) DO NOTHING;

-- WAC (13 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Grand Canyon', 'GCU', c.id, 'grand-canyon' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Seattle', 'SEA', c.id, 'seattle' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Utah Valley', 'UVU', c.id, 'utah-valley' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Stephen F. Austin', 'SFA', c.id, 'stephen-f-austin' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Abilene Christian', 'ACU', c.id, 'abilene-christian' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Southern Utah', 'SUU', c.id, 'southern-utah' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Utah Tech', 'UTAHTECH', c.id, 'utah-tech' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'UT Arlington', 'UTA', c.id, 'texas-arlington' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'UT Rio Grande Valley', 'UTRGV', c.id, 'ut-rio-grande-valley' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'California Baptist', 'CBU', c.id, 'california-baptist' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Chicago State', 'CSU-WAC', c.id, 'chicago-state' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'UC Arlington', 'UCA-WAC', c.id, 'uta' FROM conferences c WHERE c.short_name = 'WAC'
UNION ALL SELECT 'Seattle U', 'SEATU', c.id, 'seattle-u' FROM conferences c WHERE c.short_name = 'WAC'
ON CONFLICT (name) DO NOTHING;

-- MEAC (8 teams)
INSERT INTO teams (name, short_name, conference_id, external_id)
SELECT 'Norfolk State', 'NSU', c.id, 'norfolk-state' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'Howard', 'HOW', c.id, 'howard' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'Morgan State', 'MORG', c.id, 'morgan-state' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'South Carolina State', 'SCST', c.id, 'south-carolina-state' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'Delaware State', 'DSU', c.id, 'delaware-state' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'Coppin State', 'COPP', c.id, 'coppin-state' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'Maryland Eastern Shore', 'UMES', c.id, 'maryland-eastern-shore' FROM conferences c WHERE c.short_name = 'MEAC'
UNION ALL SELECT 'North Carolina Central', 'NCCU', c.id, 'north-carolina-central' FROM conferences c WHERE c.short_name = 'MEAC'
ON CONFLICT (name) DO NOTHING;
