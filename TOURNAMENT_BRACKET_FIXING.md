# Tournament Bracket Picking - Fixed! 🏀

## Problem Solved

**Before**: Tournaments only showed the first round because only those games existed in the database. Users couldn't pick winners for later rounds (Sweet 16, Elite 8, Championship, etc.) because those games didn't exist yet.

**After**: All 63 tournament games are created upfront as "shell" games with TBD teams. Users can now fill out complete brackets, picking winners all the way through to the championship!

## How It Works

### The Solution: Shell Games with Smart Progression

1. **All 63 games created upfront** (32 + 16 + 8 + 4 + 2 + 1)
2. **Round 1 has real teams** (based on seeding from `tournament_teams` table)
3. **Later rounds start with TBD teams** (NULL until determined by picks or actual results)
4. **User picks automatically advance teams** through the bracket in the UI
5. **Games are linked via `next_game_id`** in metadata for bracket progression

### Database Structure

Each game has enhanced `tournament_metadata` JSONB:
```json
{
  "seed_home": 1,
  "seed_away": 16,
  "region": "East",
  "bracket_position": "E-R1-G1",
  "next_game_id": "uuid-of-round2-game",
  "winner_advances_to": "home"
}
```

### UI Magic

The `InteractiveBracket` component:
- Shows all rounds even when teams are TBD
- Automatically populates later rounds based on user picks
- Updates in real-time as you make selections
- Displays "TBD" for matchups not yet determined

## Usage Instructions

### Step 1: Seed Your Tournament Teams

First, populate the `tournament_teams` table with the seeded teams:

```sql
-- Example: Add teams to a tournament with seeds and regions
INSERT INTO tournament_teams (tournament_id, team_id, seed, region)
VALUES
  -- East Region
  ('your-tournament-id', 'duke-team-id', 1, 'East'),
  ('your-tournament-id', 'fairleigh-dickinson-id', 16, 'East'),
  ('your-tournament-id', 'arizona-team-id', 8, 'East'),
  ('your-tournament-id', 'tcu-team-id', 9, 'East'),
  -- ... (continue for all 64 teams across 4 regions)

  -- West Region
  ('your-tournament-id', 'kansas-team-id', 1, 'West'),
  -- ...

  -- South Region
  ('your-tournament-id', 'alabama-team-id', 1, 'South'),
  -- ...

  -- Midwest Region
  ('your-tournament-id', 'houston-team-id', 1, 'Midwest');
  -- ...
```

**Important**: Each region needs 16 teams seeded 1-16.

### Step 2: Run the Bracket Population Script

```bash
npm run populate-bracket <tournament-id>
```

Example:
```bash
npm run populate-bracket 123e4567-e89b-12d3-a456-426614174000
```

This will:
- ✅ Create all 63 games for the tournament
- ✅ Set Round 1 matchups based on seeding (1v16, 8v9, 5v12, etc.)
- ✅ Create later rounds with TBD teams
- ✅ Link games via `next_game_id` for bracket progression
- ✅ Set proper game dates (spread across 10 days from tournament start)

### Step 3: View & Pick!

Navigate to: `http://localhost:5173/?view=tournaments`

Click on your tournament and start making picks! The bracket will automatically show all rounds, and as you pick winners in early rounds, those teams will appear in later rounds.

## What Happens When You Pick

1. **User picks Duke to beat Fairleigh Dickinson in Round 1**
   - Pick is saved to `bracket_picks` table
   - InteractiveBracket component sees the pick

2. **Component automatically advances Duke to Round 2**
   - Looks up Round 1 game's `next_game_id` and `winner_advances_to`
   - Populates Round 2 game with Duke in the correct position
   - Shows Duke as one of the teams in that Round 2 matchup

3. **User can now pick the Round 2 game**
   - Even though the opponent might still be TBD
   - As soon as they pick the other Round 1 game, both teams appear

4. **Continue all the way to championship!**
   - Pick your way through Sweet 16, Elite 8, Final Four
   - Pick your national champion

## Database Schema

### Tables Used

**`tournaments`** - Tournament info
- Already exists, no changes needed

**`tournament_teams`** - Seeded participants
- Already exists, populate with your 64 teams

**`games`** - All tournament games (now 63 per tournament)
- Enhanced with `tournament_metadata` JSONB
- Linked via `next_game_id` references

**`bracket_picks`** - User picks
- Already exists, stores picks as: `{ game_id: { winner_team_id, picked_at } }`

## File Structure

```
college-basketball-picks/
├── scripts/
│   └── populate-tournament-bracket.ts  # NEW: Script to create all 63 games
├── app/
│   ├── lib/
│   │   └── tournament-bracket-generator.server.ts  # NEW: Bracket creation logic
│   └── components/
│       └── tournament/
│           ├── InteractiveBracket.tsx  # UPDATED: Now handles TBD teams
│           └── BracketMatchup.tsx      # Already shows "TBD"
└── package.json  # UPDATED: Added populate-bracket script
```

## Example: Creating a March Madness Tournament

```bash
# 1. Create the tournament (via UI or SQL)
# Name: "2024 NCAA Men's Basketball Tournament"
# Type: ncaa
# Start Date: 2024-03-21
# End Date: 2024-04-08

# 2. Seed all 64 teams across 4 regions in tournament_teams table
# (16 teams per region: East, West, South, Midwest)

# 3. Run the population script
npm run populate-bracket <your-tournament-id>

# 4. Visit the site
# http://localhost:5173/?view=tournaments

# 5. Start picking!
```

## Technical Details

### Game Creation

- **Round 1**: Real matchups based on NCAA seeding (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15)
- **Round 2**: 4 games per region with NULL teams
- **Sweet 16**: 2 games per region with NULL teams
- **Elite 8**: 1 game per region with NULL teams
- **Final Four**: 2 games (East vs West, South vs Midwest)
- **Championship**: 1 game

### Bracket Progression

Games link via `tournament_metadata`:
```typescript
{
  next_game_id: "uuid-of-next-game",
  winner_advances_to: "home" | "away"
}
```

This tells the system:
- Which game the winner advances to
- Which side of that game they'll be on (home or away)

### User Pick Flow

1. User clicks on a team in a game
2. `onPickWinner(gameId, teamId)` is called
3. Pick is saved to database
4. Component re-renders with updated picks
5. `useEffect` processes all picks to determine advancing teams
6. Later round games are populated with advancing teams
7. UI updates to show the progression

## Troubleshooting

### "No teams found!" error

**Problem**: You forgot to populate `tournament_teams` table

**Solution**: Add all 64 teams with proper seeding before running the script

### Tournament shows "No games in this tournament yet"

**Problem**: Games weren't created or script failed

**Solution**:
1. Check console for errors
2. Verify tournament ID is correct
3. Try running populate script again

### Games exist but bracket doesn't advance picks

**Problem**: `next_game_id` links weren't created

**Solution**: Re-run the populate script (it handles linking in a second pass)

### Picks aren't saving

**Problem**: API route issue or authentication

**Solution**: Check browser console and network tab for errors

## Future Enhancements

- ✅ All 63 games created upfront
- ✅ Automatic team advancement based on picks
- ✅ TBD teams displayed properly
- 🔄 Scoring when tournament completes
- 🔄 Leaderboards comparing brackets
- 🔄 Confidence points system
- 🔄 Sharing brackets with friends
- 🔄 Live updates as real games complete

## Summary

You asked how to fix tournaments so users can pick the full bracket. The answer:

**Create all 63 games upfront as "shell" games, then use metadata to link them together and populate later rounds based on user picks.**

This is now implemented! Run `npm run populate-bracket <tournament-id>` and start picking! 🏀🎉
