# Stat Chain Connections - Database Schema

Complete database schema for the Stat Chain Connections daily puzzle game.

## Overview

The schema supports a Connections-style game where players group 16 college basketball teams into 4 groups based on shared statistical characteristics.

## Tables

### `stat_chain_puzzles`
Daily puzzle instances with metadata.

```sql
CREATE TABLE stat_chain_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_date DATE NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Points:**
- One puzzle per day (enforced by unique constraint on `puzzle_date`)
- Difficulty rating helps set user expectations
- Public read access via RLS

### `stat_chain_groups`
The correct answer groups for each puzzle (4 groups per puzzle).

```sql
CREATE TABLE stat_chain_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  description TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  stat_value TEXT NOT NULL,
  difficulty_order INTEGER NOT NULL CHECK (difficulty_order BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(puzzle_id, difficulty_order)
);
```

**Key Points:**
- `difficulty_order` (1-4): 1 = easiest to identify, 4 = hardest
- `stat_type`: Category of statistic (e.g., "points_per_game", "conference")
- `stat_value`: The connecting value or condition
- Cascade delete when puzzle is deleted

### `stat_chain_teams`
Teams belonging to each group (4 teams per group).

```sql
CREATE TABLE stat_chain_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES stat_chain_groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL CHECK (display_order BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, team_id),
  UNIQUE(group_id, display_order)
);
```

**Key Points:**
- References existing `teams` table (reuses data)
- Each team appears exactly once per puzzle
- Display order for consistent presentation

### `stat_chain_sessions`
Player game sessions tracking progress and guesses.

```sql
CREATE TABLE stat_chain_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES stat_chain_puzzles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'won', 'lost')),
  guesses_remaining INTEGER NOT NULL DEFAULT 4,
  groups_solved INTEGER NOT NULL DEFAULT 0,
  guess_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, puzzle_id)
);
```

**Key Points:**
- One session per user per puzzle
- 4 incorrect guesses allowed before game over
- `guess_history` JSONB format:
  ```json
  [
    {
      "team_ids": ["uuid1", "uuid2", "uuid3", "uuid4"],
      "correct": true,
      "group_id": "group-uuid",
      "timestamp": "2024-11-20T10:30:00Z"
    }
  ]
  ```
- Users can only access their own sessions (RLS enforced)

## Helper Functions

### `get_daily_puzzle(p_date DATE)`
Returns complete puzzle structure for a given date.

```sql
SELECT * FROM get_daily_puzzle(CURRENT_DATE);
```

**Returns:**
```json
{
  "puzzle_id": "uuid",
  "puzzle_date": "2024-11-20",
  "title": "Elite Programs Edition",
  "description": "...",
  "difficulty": "medium",
  "groups": [
    {
      "id": "uuid",
      "group_name": "Blue Blood Programs",
      "description": "Teams with 5+ national championships",
      "stat_type": "championships",
      "stat_value": "5+",
      "difficulty_order": 1,
      "teams": [
        {
          "team_id": "uuid",
          "team_name": "Duke",
          "team_short_name": "DUKE",
          "display_order": 1
        }
      ]
    }
  ]
}
```

### `get_user_session(p_user_id UUID, p_puzzle_id UUID)`
Gets existing session or creates a new one.

```sql
SELECT * FROM get_user_session('user-uuid', 'puzzle-uuid');
```

**Returns:**
```sql
session_id         | uuid
status             | in_progress
guesses_remaining  | 4
groups_solved      | 0
guess_history      | []
started_at         | 2024-11-20 10:00:00+00
completed_at       | null
```

### `submit_guess(p_session_id UUID, p_team_ids UUID[])`
Validates and records a guess.

```sql
SELECT * FROM submit_guess(
  'session-uuid',
  ARRAY['team1-uuid', 'team2-uuid', 'team3-uuid', 'team4-uuid']::UUID[]
);
```

**Returns:**
```sql
success            | true
message            | Correct! You found: Blue Blood Programs
correct            | true
group_id           | group-uuid
group_name         | Blue Blood Programs
guesses_remaining  | 4
game_status        | in_progress
```

**Behavior:**
- Validates exactly 4 teams selected
- Checks if selection matches a group
- Updates session state (guesses, groups solved)
- Determines win/loss conditions:
  - **Won**: All 4 groups solved
  - **Lost**: 0 guesses remaining and last guess incorrect
- Records guess in history
- Returns detailed result

### `get_puzzle_stats(p_puzzle_id UUID)`
Returns aggregate statistics for a puzzle.

```sql
SELECT * FROM get_puzzle_stats('puzzle-uuid');
```

**Returns:**
```sql
total_attempts    | 150
total_wins        | 120
total_losses      | 30
win_rate          | 80.0
avg_guesses_used  | 2.3
```

## RLS Policies

### Puzzles, Groups, Teams
- **Public read**: Anyone can view (needed for game to function)
- **No write access**: Managed by admin/backend only

### Sessions
- **Read/Write own**: Users can only access their own sessions
- Enforced via `auth.uid() = user_id`

## Indexes

Optimized for common query patterns:

```sql
-- Puzzle lookups
CREATE INDEX idx_stat_chain_puzzles_date ON stat_chain_puzzles(puzzle_date DESC);

-- Group and team joins
CREATE INDEX idx_stat_chain_groups_puzzle ON stat_chain_groups(puzzle_id);
CREATE INDEX idx_stat_chain_teams_group ON stat_chain_teams(group_id);
CREATE INDEX idx_stat_chain_teams_team ON stat_chain_teams(team_id);

-- Session queries
CREATE INDEX idx_stat_chain_sessions_user ON stat_chain_sessions(user_id);
CREATE INDEX idx_stat_chain_sessions_puzzle ON stat_chain_sessions(puzzle_id);
CREATE INDEX idx_stat_chain_sessions_status ON stat_chain_sessions(status);
```

## Usage Examples

### Client-Side Flow

**1. Load today's puzzle:**
```typescript
const { data: puzzle } = await supabase
  .rpc('get_daily_puzzle', { p_date: new Date().toISOString().split('T')[0] })
  .single();
```

**2. Get or create user session:**
```typescript
const { data: session } = await supabase
  .rpc('get_user_session', {
    p_user_id: userId,
    p_puzzle_id: puzzle.puzzle_id
  })
  .single();
```

**3. Submit a guess:**
```typescript
const { data: result } = await supabase
  .rpc('submit_guess', {
    p_session_id: session.session_id,
    p_team_ids: [teamId1, teamId2, teamId3, teamId4]
  })
  .single();

if (result.correct) {
  // Show success animation
  // Update solved groups display
}

if (result.game_status === 'won') {
  // Show victory screen
} else if (result.game_status === 'lost') {
  // Show game over screen
}
```

**4. Display puzzle stats:**
```typescript
const { data: stats } = await supabase
  .rpc('get_puzzle_stats', { p_puzzle_id: puzzle.puzzle_id })
  .single();

// Show: "80% win rate, avg 2.3 guesses"
```

## Data Integrity

### Constraints
- Exactly 4 groups per puzzle (enforced by unique difficulty_order 1-4)
- Exactly 4 teams per group (enforced by unique display_order 1-4)
- One session per user per puzzle (enforced by unique constraint)
- Teams can't appear multiple times in same puzzle (enforced by foreign keys)

### Cascade Deletes
- Delete puzzle → deletes all groups, teams, and sessions
- Delete group → deletes all teams in that group
- Delete user → deletes all their sessions

## Migration Files

1. **20251120000002_stat_chain_connections.sql**
   - Creates tables, indexes, RLS policies
   - Creates helper functions
   - Complete schema setup

2. **20251120000003_stat_chain_seed_data.sql**
   - Sample puzzle for testing
   - Uses real teams from teams table
   - Demonstrates proper data structure

## Design Decisions

### Why JSONB for guess_history?
- Avoids separate `guesses` table
- Simpler schema (4 tables instead of 5)
- Efficient for small arrays (max 10 guesses per game)
- Easy to query in functions
- Natural fit for time-ordered data

### Why no stats table in MVP?
- Stats calculated on-demand via functions
- Reduces complexity and maintenance
- Can add materialized view later if needed
- Functions provide flexibility for different stats

### Why reuse teams table?
- Avoid data duplication
- Leverage existing team data
- Maintain referential integrity
- Single source of truth for team info

### Why difficulty_order instead of color?
- More flexible (not tied to UI colors)
- Backend determines difficulty, not presentation
- UI can map order to colors/themes
- Easier to reorder groups

## Future Enhancements

Potential additions (not in MVP):

- **Leaderboards**: Add `stat_chain_leaderboards` table
- **Stats cache**: Materialized view for puzzle statistics
- **Hints**: Store hint progression in sessions
- **Achievements**: Track user milestones
- **Team stats**: Add stats table if calculating on-demand becomes slow
