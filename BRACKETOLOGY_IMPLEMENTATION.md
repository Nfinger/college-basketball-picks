# Bracketology Feature Implementation

**Implementation Date**: November 20, 2025
**Status**: ✅ Complete - Ready for testing

## Overview

Added a season-long NCAA tournament bracket prediction feature to the basketball picks project. Users can now maintain and update their tournament bracket throughout the season from the rankings page.

## Problem Solved

The 404 routing error was caused by **missing route configuration** in `app/routes.ts`. React Router v7 requires explicit route registration - simply creating the file `rankings.bracketology.tsx` is not enough.

**Root Cause**: React Router v7 uses a centralized route configuration file (`app/routes.ts`) and doesn't automatically discover routes from the file system like some other frameworks.

**Solution**: Added nested route configuration in `app/routes.ts`:

```typescript
route("rankings", "routes/rankings.tsx", [
  route("me", "routes/rankings.me.tsx"),
  route("bracketology", "routes/rankings.bracketology.tsx"),  // ← Added this
  route(":rankingId/edit", "routes/rankings.$rankingId.edit.tsx"),
]),
```

## Architecture

### Design Philosophy
- **Ruthless Simplicity**: Phase 1 focuses on team selection only (no game predictions yet)
- **Click-to-select**: Simpler and more intuitive than drag-and-drop for this use case
- **Auto-save**: 1-second debounced saves prevent data loss
- **Modular Design**: Self-contained `bracket-editor/` module following "bricks and studs" philosophy

### Data Model

**Storage**: JSONB in existing `bracket_picks` table

```typescript
interface BracketPicks {
  version: number;
  last_updated: string;
  regions: {
    [regionName: string]: {  // "East", "West", "South", "Midwest"
      seeds: {
        [seed: number]: {     // 1-16
          team_id: string | null;
          team_name?: string;
          selected_at?: string;
        }
      }
    }
  }
}
```

### Component Architecture

```
app/components/bracket-editor/
├── index.ts                    # Public API
├── types.ts                    # TypeScript interfaces
├── utils.ts                    # Helper functions
├── BracketEditor.tsx          # Main container (state + auto-save)
├── RegionSection.tsx          # Region display (16 seeds)
├── SeedSlot.tsx               # Single seed slot (click-to-select)
└── TeamSelector.tsx           # Search modal for team selection
```

**Design Pattern**: Each component is a "brick" with clear contracts (studs). The module can be regenerated independently without breaking the system.

## Files Created

### Core Module (7 files)
1. **`app/components/bracket-editor/index.ts`** - Public API exports
2. **`app/components/bracket-editor/types.ts`** - TypeScript interfaces and types
3. **`app/components/bracket-editor/utils.ts`** - `createEmptyBracket()`, `validateBracket()`, `getAllSelectedTeamIds()`
4. **`app/components/bracket-editor/BracketEditor.tsx`** - Main component with auto-save logic
5. **`app/components/bracket-editor/RegionSection.tsx`** - Displays 16 seed slots per region
6. **`app/components/bracket-editor/SeedSlot.tsx`** - Individual seed slot with team selection
7. **`app/components/bracket-editor/TeamSelector.tsx`** - Modal for searching and selecting teams

### Server & Routing (2 files)
8. **`app/lib/bracket.server.ts`** - Server utilities:
   - `getCurrentSeasonTournament()` - Gets or creates current tournament
   - `getUserBracketPicks()` - Loads user's bracket
   - `saveBracketPicks()` - Saves bracket with upsert
   - `getAllTeams()` - Fetches teams with conference info

9. **`app/routes/rankings.bracketology.tsx`** - Route component with loader/action

## Files Modified

### `app/routes/rankings.tsx`
**Changes**:
- Added tab navigation (Weekly Rankings | Bracketology)
- Integrated `<Outlet />` for nested routes
- Extracted table into `RankingsContent` component
- Added imports: `Outlet, useLocation, Tabs, Trophy`

**Key Code**:
```typescript
const currentTab = location.pathname === '/rankings/bracketology' ? 'bracketology' : 'rankings';

<Tabs value={currentTab}>
  <TabsContent value="rankings">
    <RankingsContent sortedWeeks={sortedWeeks} profiles={profiles} />
  </TabsContent>
  <TabsContent value="bracketology">
    <Outlet />
  </TabsContent>
</Tabs>
```

### `app/routes.ts` ⭐ **Critical Fix**
**Changes**:
- Nested child routes under parent `rankings` route
- Added `bracketology` route configuration

**Before** (incorrect - flat structure):
```typescript
route("rankings", "routes/rankings.tsx"),
route("rankings/me", "routes/rankings.me.tsx"),
route("rankings/:rankingId/edit", "routes/rankings.$rankingId.edit.tsx"),
```

**After** (correct - nested structure):
```typescript
route("rankings", "routes/rankings.tsx", [
  route("me", "routes/rankings.me.tsx"),
  route("bracketology", "routes/rankings.bracketology.tsx"),
  route(":rankingId/edit", "routes/rankings.$rankingId.edit.tsx"),
]),
```

## Key Features

### 1. Auto-Save with Debouncing
Saves automatically 1 second after any change:
```typescript
useEffect(() => {
  if (!autoSave) return;

  const timeout = setTimeout(() => {
    setSaveStatus('saving');
    onSave(picks)
      .then(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      });
  }, 1000);  // 1-second debounce

  return () => clearTimeout(timeout);
}, [picks, autoSave, onSave]);
```

### 2. Team Selection with Search
- Modal opens when clicking empty seed slot
- Search filters by team name
- Shows conference badges (power conferences highlighted)
- Disables already-selected teams to prevent duplicates

### 3. Real-time Validation
- Checks for duplicate team selections
- Validates bracket completeness
- Provides clear error messages

### 4. Tournament Management
- Auto-creates placeholder tournament if none exists
- Named: "YYYY NCAA Tournament - Pre-Season Predictions"
- Includes standard NCAA regions: East, West, South, Midwest
- Stores metadata for future enhancements

## Database Schema

**Table**: `bracket_picks` (already existed)

```sql
CREATE TABLE bracket_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),

  -- JSONB structure (flexible for phase 1)
  picks JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Track overall winner (Phase 2)
  champion_team_id UUID REFERENCES teams(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, tournament_id)
);
```

**RLS Policies**: Users can only view/modify their own brackets

## API Routes

### Loader (GET)
**Route**: `/rankings/bracketology`

**Returns**:
```typescript
{
  tournament: Tournament | null,
  bracketPicks: BracketPicks | null,
  teams: Team[]
}
```

**Handles**:
- Creates tournament if missing
- Loads user's existing bracket
- Fetches all teams with conference info

### Action (POST)
**Route**: `/rankings/bracketology`

**Accepts**:
```typescript
FormData {
  picks: JSON.stringify(BracketPicks),
  tournamentId: string
}
```

**Returns**: `{ success: boolean, error?: string }`

## User Flow

1. **Navigate**: Click "Bracketology" tab on rankings page
2. **View**: See 4 regions (East, West, South, Midwest) with 16 seeds each
3. **Select**: Click any empty seed slot
4. **Search**: Modal opens - search for team
5. **Choose**: Click team to assign to that seed
6. **Auto-save**: Bracket saves automatically after 1 second
7. **Edit**: Click filled slot to remove team or reassign
8. **Return**: Bracket persists - reloads on next visit

## Testing Checklist

Once logged in, verify:

- [ ] `/rankings/bracketology` route loads without 404
- [ ] Tabs display: "Weekly Rankings" and "Bracketology"
- [ ] Clicking Bracketology tab shows bracket editor
- [ ] All 4 regions display: East, West, South, Midwest
- [ ] Each region shows seeds 1-16
- [ ] Clicking empty seed opens team selector modal
- [ ] Search filters teams correctly
- [ ] Selecting team assigns to correct seed
- [ ] "Saving..." indicator appears
- [ ] "Saved ✓" indicator appears after save
- [ ] Refreshing page preserves selections
- [ ] Can remove team from seed slot
- [ ] Cannot select same team twice (disabled in selector)
- [ ] Bracket data persists across sessions

## Known Issues / Future Enhancements

### Current Limitations (Phase 1)
- **Team selection only** - No game predictions yet
- **No bracket progression** - Teams don't advance through rounds
- **No sharing** - Brackets are private
- **No validation** - Can leave seeds empty
- **Tournament auto-creation might fail** due to RLS policies (seen in logs)

### RLS Policy Issue
**Error observed**:
```
Error creating tournament: {
  code: '42501',
  message: 'new row violates row-level security policy for table "tournaments"'
}
```

**Impact**: First-time users might not get a tournament created automatically.

**Solution needed**: Add RLS policy allowing service role or authenticated users to create tournaments, OR seed tournaments via migration instead of dynamic creation.

### Phase 2 Plans
- Game-by-game predictions
- Bracket progression (winners advance)
- Validation (all seeds required before locking)
- Public bracket sharing
- Comparison with other users' brackets
- Scoring system based on actual tournament results

## Technical Decisions

### Why Click-to-Select vs Drag-and-Drop?
**Decision**: Click-to-select with modal
**Rationale**:
- Simpler implementation for Phase 1
- More intuitive for team search (64 teams to choose from)
- Better mobile experience
- Drag-and-drop can be added later for reordering

### Why JSONB Storage?
**Decision**: Store picks as JSONB instead of relational tables
**Rationale**:
- Flexibility for Phase 1 experimentation
- Fewer tables to manage initially
- Easier to evolve structure
- Can normalize later if needed

### Why Auto-Save?
**Decision**: 1-second debounced auto-save
**Rationale**:
- Prevents data loss
- Reduces cognitive load (no "Save" button to remember)
- Familiar pattern from modern apps (Google Docs, etc.)
- Low API overhead with debouncing

## Troubleshooting

### Route returns 404
**Solution**: Check `app/routes.ts` - ensure `bracketology` route is nested under `rankings`:
```typescript
route("rankings", "routes/rankings.tsx", [
  route("bracketology", "routes/rankings.bracketology.tsx"),
  // ... other child routes
]),
```

### "No tournament available"
**Cause**: RLS policy prevents tournament creation
**Temporary workaround**: Manually create tournament via SQL:
```sql
INSERT INTO tournaments (name, type, year, status, start_date, end_date)
VALUES (
  '2026 NCAA Tournament - Pre-Season Predictions',
  'ncaa',
  2026,
  'upcoming',
  '2026-03-17',
  '2026-04-06'
);
```

### Changes not saving
**Check**:
1. Network tab - is POST request succeeding?
2. Console - any errors?
3. Dev server logs - RLS policy errors?

### Teams not loading
**Check**: Database connection and `getAllTeams()` query in `bracket.server.ts`

## File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `bracket-editor/index.ts` | Public API | 10 |
| `bracket-editor/types.ts` | Interfaces | 60 |
| `bracket-editor/utils.ts` | Helpers | 40 |
| `bracket-editor/BracketEditor.tsx` | Main component | 150 |
| `bracket-editor/RegionSection.tsx` | Region display | 50 |
| `bracket-editor/SeedSlot.tsx` | Seed slot | 60 |
| `bracket-editor/TeamSelector.tsx` | Team search | 120 |
| `lib/bracket.server.ts` | Server utilities | 145 |
| `routes/rankings.bracketology.tsx` | Route component | 100 |
| `routes/rankings.tsx` (modified) | Parent route | 277 |
| `routes.ts` (modified) | Route config | 40 |

## Architecture Diagram

```
/rankings
├── [Weekly Rankings Tab]
│   └── RankingsContent (side-by-side tables)
│
└── [Bracketology Tab]
    └── <Outlet /> renders rankings.bracketology.tsx
        └── BracketEditor
            ├── RegionSection (East)
            │   └── 16 × SeedSlot
            ├── RegionSection (West)
            │   └── 16 × SeedSlot
            ├── RegionSection (South)
            │   └── 16 × SeedSlot
            └── RegionSection (Midwest)
                └── 16 × SeedSlot

Each SeedSlot clicks → TeamSelector modal
```

## Dependencies Used

All existing dependencies from `package.json`:
- **React Router v7** - Routing and nested routes
- **Radix UI** - Dialog, Select, ScrollArea, Tabs components
- **Supabase** - Database and authentication
- **date-fns** - Timestamp formatting
- **Lucide React** - Icons (Trophy, X, Search)
- **TypeScript** - Type safety throughout

No new dependencies added! ✅

## Summary

Successfully implemented a season-long bracketology feature for the basketball picks project:

✅ **Modular architecture** following project philosophy
✅ **Self-contained components** in `bracket-editor/` module
✅ **Tab integration** on rankings page
✅ **Auto-save functionality** with debouncing
✅ **Team search and selection** with validation
✅ **Persistent storage** via Supabase
✅ **Type-safe** throughout with TypeScript
✅ **Routing fixed** via proper `routes.ts` configuration

**Status**: Ready for user testing. Route now returns 302 (redirects to login when unauthenticated), which is expected behavior. When logged in, users should see the full bracket editor interface.

**Next Steps**:
1. Test with authenticated user
2. Address RLS policy for tournament creation
3. Gather user feedback
4. Plan Phase 2 features (game predictions, progression)
