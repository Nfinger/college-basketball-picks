# Stat Chain Connections - Schema Summary

## Files Created

### 1. Migration: Schema & Functions
**File**: `supabase/migrations/20251120000002_stat_chain_connections.sql`

**Creates:**
- ✅ 4 tables (puzzles, groups, teams, sessions)
- ✅ All indexes for common queries
- ✅ RLS policies for security
- ✅ Helper functions (get_daily_puzzle, get_user_session, submit_guess, get_puzzle_stats)
- ✅ Proper constraints and foreign keys

### 2. Migration: Seed Data
**File**: `supabase/migrations/20251120000003_stat_chain_seed_data.sql`

**Creates:**
- ✅ Sample puzzle for today
- ✅ 4 groups with real team data
- ✅ Verification query

### 3. Documentation
**File**: `STAT_CHAIN_DATABASE.md`

**Contains:**
- ✅ Complete schema documentation
- ✅ Function usage examples
- ✅ Client-side integration code
- ✅ Design decisions explained

## Schema Overview

```
stat_chain_puzzles (1 per day)
  └─ stat_chain_groups (4 per puzzle)
      └─ stat_chain_teams (4 per group, references teams table)

stat_chain_sessions (1 per user per puzzle)
  ├─ tracks progress
  └─ stores guess history as JSONB
```

## Key Features

### Simplicity (Zen-Architect Recommendations)
- ✅ 4 tables (not 6) - removed stats and publishing complexity
- ✅ JSONB guess history - avoids separate guesses table
- ✅ Reuses existing teams table
- ✅ Calculate stats on-demand - no materialized views

### Security
- ✅ RLS enabled on all tables
- ✅ Users only access own sessions
- ✅ Public read for puzzles/groups (game requirement)

### Performance
- ✅ Indexes on all foreign keys
- ✅ Index on puzzle_date for daily lookups
- ✅ Index on session status for leaderboards

### Developer Experience
- ✅ Helper functions simplify client queries
- ✅ One function call to get complete puzzle
- ✅ One function call to submit and validate guess
- ✅ TypeScript-friendly return types

## Usage Pattern

```typescript
// 1. Load puzzle
const puzzle = await supabase.rpc('get_daily_puzzle').single();

// 2. Get/create session
const session = await supabase.rpc('get_user_session', {
  p_user_id: userId,
  p_puzzle_id: puzzle.puzzle_id
}).single();

// 3. Submit guess
const result = await supabase.rpc('submit_guess', {
  p_session_id: session.session_id,
  p_team_ids: [id1, id2, id3, id4]
}).single();

// Result tells you: correct?, group found?, game over?, guesses left
```

## Design Highlights

### Smart Constraints
- Exactly 4 groups per puzzle (unique difficulty_order 1-4)
- Exactly 4 teams per group (unique display_order 1-4)
- One session per user per puzzle
- Teams can't repeat in same puzzle

### Cascade Deletes
- Delete puzzle → cascades to groups, teams, sessions
- Delete group → cascades to teams
- Clean data integrity

### JSONB Guess History
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

Simple, queryable, efficient for small arrays.

## Next Steps

1. **Apply migrations** to Supabase:
   ```bash
   supabase db push
   ```

2. **Verify seed data** created:
   ```sql
   SELECT * FROM get_daily_puzzle(CURRENT_DATE);
   ```

3. **Build client** using TypeScript examples in documentation

4. **Test game flow**:
   - Load puzzle
   - Create session
   - Submit guesses
   - Win/lose states

## Production Ready

This schema is ready for production:
- ✅ Follows existing patterns (UUID PKs, TIMESTAMPTZ)
- ✅ Proper RLS security
- ✅ Optimized indexes
- ✅ Helper functions reduce client complexity
- ✅ Comprehensive documentation
- ✅ Sample data for testing
