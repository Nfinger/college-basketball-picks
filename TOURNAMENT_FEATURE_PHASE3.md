# Tournament Feature - Phase 3 Implementation Complete

## ✅ What Was Built

Phase 3 adds **Data Scraping & Game Management** with automatic import from ESPN! Here's what was implemented:

### 1. **ESPN Tournament Scraper** (`app/lib/tournaments/espn-scraper.ts`)

A complete scraper for ESPN's unofficial API that fetches tournament data.

**Key Features:**
- Fetches NCAA Tournament games (groups=50, seasonType=3)
- Fetches Conference Tournament games by date range
- Fetches MTE games by event name
- Extracts seeds from `curatedRank.current` field
- Parses regions from event notes (East, West, South, Midwest)
- Parses rounds from event notes (First Four, Round of 64, etc.)
- Maps ESPN round names to internal format

**API Endpoints Used:**
```
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
  ?dates=YYYYMMDD-YYYYMMDD
  &groups=50 (for NCAA tournament)
  &limit=300
```

**Functions:**
- `fetchTournamentGames()` - Generic game fetcher
- `fetchNCAATournamentGames(year)` - NCAA tournament specific
- `fetchConferenceTournamentGames(conferenceId, year, startDate, endDate)`
- `fetchMTEGames(eventName, startDate, endDate)`
- `convertEspnEventToGame()` - Converts ESPN format to our format

### 2. **Team Name Matching** (`app/lib/tournaments/team-matcher.ts`)

Fuzzy matching algorithm to match ESPN team names to database teams.

**Features:**
- Levenshtein distance algorithm for string similarity
- Matches against team name, short_name, and abbreviation
- Caches ESPN team IDs for future lookups
- Confidence scoring (0-1 scale)
- Batch matching support
- Manual review suggestions

**Matching Process:**
1. Check for cached ESPN ID (exact match)
2. Calculate similarity scores against all fields
3. Bonus points for common words (e.g., "North Carolina")
4. Return best match if confidence >= threshold (default 0.75)
5. Save ESPN ID if confidence >= 0.9

**Functions:**
- `matchTeam(espnTeam, threshold)` - Match single team
- `matchTeams(espnTeams)` - Batch matching
- `getMatchSuggestions(espnTeams)` - For manual review
- `saveEspnTeamId(teamId, espnId)` - Cache ESPN IDs

### 3. **Game Importer** (`app/lib/tournaments/game-importer.ts`)

Associates scraped games with tournaments and creates/updates database records.

**Features:**
- Team matching with configurable threshold
- Duplicate detection by external_id
- Update existing games or skip
- Dry run mode for testing
- Comprehensive error reporting
- Tracks unmatched teams

**Import Functions:**
- `importGamesToTournament()` - Generic importer
- `importNCAATournament(year)` - Auto-creates tournament if needed
- `importConferenceTournament(conferenceId, year, dates)`
- `importMTE(eventName, year, dates, location)`

**Import Result:**
```typescript
{
  success: boolean,
  gamesCreated: number,
  gamesUpdated: number,
  gamesSkipped: number,
  errors: Array<{ game, error }>,
  unmatchedTeams: Array<{ espnTeam, gameName }>
}
```

### 4. **Manual Import UI** (`app/routes/admin.tournaments.$tournamentId.import.tsx`)

Admin interface for importing games from ESPN.

**Features:**
- Different forms for NCAA, Conference, and MTE imports
- Dry run checkbox (preview without saving)
- Pre-filled fields from tournament metadata
- Date pickers for start/end dates
- Conference ID input for conference tournaments
- Event name input for MTEs
- Help section with troubleshooting tips

**Import Flow:**
1. Navigate to tournament in admin
2. Click "Import Games" button
3. Fill in import form (most fields pre-filled)
4. Check "Dry run" to preview
5. Click import button
6. Review results (games created/updated/skipped, errors, unmatched teams)

### 5. **Inngest Background Jobs** (`app/lib/inngest/functions/tournament-scraper.ts`)

Automated background jobs for tournament scraping.

**Jobs Created:**

#### `scrape-ncaa-tournament`
- **Schedule**: Every 6 hours during March-April
- **Function**: Auto-scrapes NCAA tournament games
- **Behavior**: Only runs during tournament season (March-April)

#### `scrape-ncaa-tournament-manual`
- **Trigger**: Event `tournament/scrape.ncaa`
- **Function**: Manually trigger NCAA scraping
- **Data**: `{ year, dryRun }`

#### `update-tournament-status`
- **Schedule**: Daily at midnight
- **Function**: Updates tournament status based on dates
- **Updates**: `upcoming` → `in_progress` → `completed`

#### `scrape-conference-tournament`
- **Trigger**: Event `tournament/scrape.conference`
- **Function**: Scrape conference tournament games
- **Data**: `{ conferenceId, conferenceName, year, startDate, endDate, dryRun }`

#### `scrape-mte`
- **Trigger**: Event `tournament/scrape.mte`
- **Function**: Scrape MTE games
- **Data**: `{ eventName, year, startDate, endDate, location, dryRun }`

### 6. **Game Details Dialog** (`app/components/tournament/GameDetailsDialog.tsx`)

Modal dialog showing detailed game information when clicked.

**Features:**
- Team names with seeds
- Scores with winner highlighting
- Date/time with timezone
- Venue information
- Round information
- Region (for NCAA)
- Data source indicator
- Responsive design
- Click outside to close
- ESC key to close (handled by React)

**Visual Design:**
- Winner highlighted with primary color and border
- Seed badges (circular, numbered)
- Status badges (Final, Live, Scheduled)
- Region badge for NCAA games
- Icons for date, venue, round, source
- Large scores for completed games

---

## 🎨 Design Highlights

**Data Integration:**
- ✅ Direct ESPN API integration (no scraping HTML)
- ✅ Automatic team matching with fuzzy logic
- ✅ Duplicate prevention by external_id
- ✅ Caching of ESPN team IDs for performance

**User Experience:**
- ✅ Dry run mode prevents accidents
- ✅ Clear error reporting with specific details
- ✅ Unmatched teams reported for manual review
- ✅ Pre-filled forms reduce data entry
- ✅ Game details on click (no navigation)

**Background Jobs:**
- ✅ Automatic NCAA tournament updates during season
- ✅ Status updates keep tournaments current
- ✅ Manual triggers for conference/MTE tournaments
- ✅ Error notifications (ready for email/Slack integration)

---

## 📁 Files Created

```
app/lib/tournaments/
├── espn-scraper.ts          # ESPN API scraper
├── team-matcher.ts          # Fuzzy team name matching
└── game-importer.ts         # Game import and association

app/routes/
└── admin.tournaments.$tournamentId.import.tsx  # Import UI

app/lib/inngest/functions/
└── tournament-scraper.ts    # Background scraping jobs

app/components/tournament/
└── GameDetailsDialog.tsx    # Game details modal
```

**Files Modified:**
```
app/routes/admin.tournaments.tsx
  - Added "Import Games" button to tournament list

app/routes/tournaments.$tournamentId.tsx
  - Imported GameDetailsDialog
  - Added dialog component with state management
```

---

## 🚀 How to Use

### Step 1: Set Up Inngest (if using background jobs)

The Inngest functions are ready but require Inngest to be configured:

1. Sign up at [inngest.com](https://www.inngest.com)
2. Add environment variables:
   ```bash
   INNGEST_EVENT_KEY=your_event_key
   INNGEST_SIGNING_KEY=your_signing_key
   ```
3. Deploy the functions (they'll auto-register on first request)

### Step 2: Import Tournament Games

**Option A: Via Admin UI (Recommended)**

1. Navigate to `/admin/tournaments`
2. Find your tournament in the list
3. Click "Import Games" button
4. Fill in the import form:
   - **NCAA**: Just verify the year and check "Dry run"
   - **Conference**: Add conference ID and name
   - **MTE**: Add event name as it appears on ESPN
5. Click import and review results

**Option B: Via Inngest Event**

Trigger manually via Inngest dashboard or API:

```typescript
// NCAA Tournament
await inngest.send({
  name: 'tournament/scrape.ncaa',
  data: { year: 2025, dryRun: false }
});

// Conference Tournament
await inngest.send({
  name: 'tournament/scrape.conference',
  data: {
    conferenceId: '5',
    conferenceName: 'Big Ten',
    year: 2025,
    startDate: '20250308',
    endDate: '20250316',
    dryRun: false
  }
});

// MTE
await inngest.send({
  name: 'tournament/scrape.mte',
  data: {
    eventName: 'Maui Invitational',
    year: 2024,
    startDate: '20241125',
    endDate: '20241127',
    location: 'Maui, HI',
    dryRun: false
  }
});
```

### Step 3: View Game Details

1. Navigate to tournament page: `/tournaments/{tournamentId}`
2. Click any game in the bracket
3. Game details dialog opens with full information
4. Click outside or "Close" button to dismiss

### Step 4: Handle Unmatched Teams

If import reports unmatched teams:

1. Check the team names in your database
2. Add ESPN team IDs manually for exact matching:
   ```sql
   UPDATE teams SET espn_id = '52' WHERE name = 'Duke';
   ```
3. Or adjust team names/abbreviations for better fuzzy matching
4. Re-run import (existing games will be updated, not duplicated)

---

## 🎯 What Works Now

### ESPN API Integration
- ✅ Fetches games from ESPN scoreboard API
- ✅ NCAA tournament games (groups=50)
- ✅ Conference tournament games by date
- ✅ MTE games by event name
- ✅ Extracts seeds, regions, rounds, scores, venues
- ✅ Maps ESPN format to internal format

### Team Matching
- ✅ Fuzzy string matching with Levenshtein distance
- ✅ Matches against name, short_name, abbreviation
- ✅ Confidence scoring with configurable threshold
- ✅ Caches ESPN IDs for exact future matches
- ✅ Reports unmatched teams for manual review

### Game Import
- ✅ Creates new games with all tournament metadata
- ✅ Updates existing games by external_id
- ✅ Associates games with tournaments
- ✅ Dry run mode for safe testing
- ✅ Comprehensive error reporting

### Background Jobs
- ✅ Auto-scrapes NCAA tournament every 6 hours
- ✅ Updates tournament status daily
- ✅ Manual triggers for all tournament types
- ✅ Ready for error notifications

### User Interface
- ✅ Admin import UI with dry run
- ✅ Pre-filled forms from tournament data
- ✅ Import results display
- ✅ Game details dialog on click
- ✅ Winner highlighting
- ✅ Responsive design

---

## 🔮 What's Coming in Phase 4

Phase 4 will add **Live Updates & Notifications**:

1. **Real-time Score Updates**
   - WebSocket connection to ESPN
   - Live score updates during games
   - Bracket updates in real-time

2. **Pick Integration**
   - Allow users to pick winners before games
   - Track pick accuracy
   - Leaderboards for tournaments

3. **Push Notifications**
   - Game start notifications
   - Score update notifications
   - Upset alerts (lower seed winning)
   - Bracket busting notifications

4. **Advanced Analytics**
   - Bracket probabilities
   - Historical matchup data
   - Seed performance stats
   - Upset likelihood

---

## 📊 ESPN API Reference

### Key Endpoints

**Scoreboard (all games):**
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
  ?dates=YYYYMMDD-YYYYMMDD
  &limit=300
```

**Tournament games (NCAA):**
```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
  ?dates=20250320-20250410
  &groups=50
  &limit=300
```

### Response Structure

**Event:**
- `id` - Unique game ID
- `date` - ISO 8601 timestamp
- `name` - Full game name
- `season.type` - 2 (regular), 3 (postseason)
- `competitions[]` - Array of games (usually 1)

**Competition:**
- `id` - Competition ID (use as external_id)
- `neutralSite` - Boolean
- `type.abbreviation` - "TRNMNT" for tournaments
- `competitors[]` - Home and away teams
- `status.type.completed` - Boolean
- `notes[]` - Contains region and round info

**Competitor:**
- `homeAway` - "home" or "away"
- `team.id` - ESPN team ID
- `team.displayName` - Full team name
- `team.abbreviation` - Team abbreviation
- `score` - String score value
- `curatedRank.current` - Seed number (1-16)

**Notes:**
- `type: "event"` contains round and region
- Example: "Men's Basketball Championship - West Region - 1st Round"

### Round Name Mapping

ESPN → Internal:
- "First Four" → `first_four`
- "1st Round" → `round_of_64`
- "2nd Round" → `round_of_32`
- "Sweet 16" → `sweet_16`
- "Elite 8" → `elite_8`
- "Final Four" → `final_four`
- "Championship" → `championship`

### Tournament Type Detection

- **NCAA**: Contains "NCAA" or "March Madness" in notes, `groups=50`
- **Conference**: Contains "Conference Tournament" in notes
- **MTE**: Match by event name, early season (Nov-Dec)

---

## 🐛 Troubleshooting

### Issue: No games imported

**Check:**
1. Are you using the correct date range?
   - NCAA: March 15 - April 10
   - Conference: Check specific tournament dates
   - MTE: Usually November-December
2. Is the tournament type correct?
3. Run with dry run first to see what would be imported

**Fix:**
- Adjust date ranges in import form
- Verify tournament exists in ESPN system
- Check browser network tab for API errors

### Issue: Teams not matching

**Check:**
1. Do team names in your database match ESPN names?
2. Are abbreviations accurate?
3. Run `getMatchSuggestions()` to see confidence scores

**Fix:**
- Add ESPN team IDs manually for exact matching
- Update team names/abbreviations to better match ESPN
- Lower match threshold (default 0.75) in importer options

### Issue: Duplicate games created

**Check:**
1. Are external_id and external_source being set?
2. Are you running import multiple times?

**Fix:**
- The importer should prevent duplicates by external_id
- Set `updateExisting: true` in import options
- Check that ESPN API returns consistent IDs

### Issue: Import hangs or times out

**Check:**
1. Is ESPN API responding?
2. Are you importing too many games at once?
3. Is team matching taking too long?

**Fix:**
- Reduce date range to import fewer games
- Use dry run to test without saving
- Check network connectivity to ESPN API

### Issue: Seeds or regions not showing

**Check:**
1. Is this an NCAA tournament? (Regions only for NCAA)
2. Are seeds in the ESPN data? (Check API response)
3. Is `tournament_metadata` being saved?

**Fix:**
- Verify ESPN API includes `curatedRank` field
- Check event notes contain region information
- Inspect database to see if metadata was saved

---

## 📈 Performance Considerations

### Team Matching Performance

**Current:**
- Fetches all teams once per import batch
- Calculates similarity for each ESPN team vs all DB teams
- ~O(n×m) where n=ESPN teams, m=DB teams

**Optimization opportunities:**
- Add database indexes on team names
- Cache match results during single import
- Pre-filter teams by conference for conference tournaments

### Import Performance

**Current:**
- Processes games sequentially
- Each game does team matching separately
- Saves to database one at a time

**For large imports (100+ games):**
- Consider batch inserts
- Cache team matches for duration of import
- Use transactions for atomicity

### API Rate Limiting

**ESPN API:**
- No official rate limits documented
- Use reasonable delays between requests
- Batch requests when possible

**Recommendation:**
- Import once per tournament or daily
- Use Inngest for scheduled imports (built-in retry)
- Monitor for 429 responses and back off

---

## ✨ Best Practices

### Before First Import

1. **Verify team data:**
   ```sql
   SELECT name, short_name, abbreviation, espn_id
   FROM teams
   WHERE conference_id IN (SELECT id FROM conferences WHERE level = 'D1')
   ORDER BY name;
   ```

2. **Run dry run first:**
   - Check "Dry run" checkbox
   - Review what would be imported
   - Fix any team matching issues

3. **Start small:**
   - Import one tournament first
   - Verify data looks correct
   - Then scale to multiple tournaments

### During Tournament Season

1. **Automatic updates:**
   - Enable Inngest NCAA scraper (every 6 hours)
   - Monitor for errors
   - Review unmatched teams

2. **Manual conference tournaments:**
   - Use Inngest events or admin UI
   - Conference tournaments are harder to detect automatically
   - Import when tournament starts

3. **Check data quality:**
   - Verify seeds are correct
   - Check regions for NCAA
   - Validate scores for completed games

### After Import

1. **Review results:**
   - Check games created/updated counts
   - Address any errors
   - Match unmatched teams

2. **Test bracket display:**
   - View tournament page
   - Verify games appear in correct rounds
   - Check mobile responsive layout

3. **Monitor background jobs:**
   - Check Inngest dashboard for job status
   - Review error notifications
   - Adjust schedules if needed

---

## ✅ Phase 3 Complete!

**What we accomplished:**
- ✅ ESPN tournament scraper with full data extraction
- ✅ Fuzzy team name matching with confidence scoring
- ✅ Game import with duplicate prevention
- ✅ Admin UI for manual imports with dry run
- ✅ Inngest background jobs for automation
- ✅ Game details dialog with click interaction
- ✅ Winner highlighting and seed display
- ✅ Real ESPN data integration (tested with 2024 NCAA tournament)

**Code Statistics:**
- ESPN Scraper: ~400 lines
- Team Matcher: ~250 lines
- Game Importer: ~300 lines
- Import UI: ~250 lines
- Inngest Jobs: ~200 lines
- Game Dialog: ~200 lines
- **Total: ~1,600 lines of production-ready code**

**Dependencies Added:** 0 (Uses existing ESPN API, Supabase, Inngest)

**Ready for Production:** ✅ Yes (with testing recommended)

---

## 📖 Next Steps

When ready for **Phase 4: Live Updates & Notifications**:

1. WebSocket integration for live scores
2. Push notifications for game events
3. Pick'em functionality
4. Advanced analytics and probabilities
5. Social features (sharing, comments)
6. Bracket challenge leaderboards

**Estimated Time:** 2 weeks

---

*Generated: November 20, 2024*
*Phase: 3 of 5*
*Status: ✅ Complete and Ready for Testing*

**Previous:** [Phase 2 - Bracket Visualization](./TOURNAMENT_FEATURE_PHASE2.md)
**Next:** Phase 4 - Live Updates (Coming Soon)
