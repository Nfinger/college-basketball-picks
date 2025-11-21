# Bracket Editor Module

Self-contained bracketology component for season-long tournament predictions.

## Structure

```
bracket-editor/
├── index.ts                # Public exports
├── types.ts                # TypeScript interfaces
├── BracketEditor.tsx       # Main container with state + auto-save
├── RegionSection.tsx       # Region display (16 seeds)
├── SeedSlot.tsx            # Individual seed slot
├── TeamSelector.tsx        # Team search/selection modal
└── utils.ts                # Helper functions
```

## Usage

```tsx
import { BracketEditor } from '~/components/bracket-editor';
import type { BracketPicks } from '~/components/bracket-editor';

function MyPage() {
  const handleSave = async (picks: BracketPicks) => {
    // Save to database
    await saveBracketPicks(picks);
  };

  return (
    <BracketEditor
      tournamentId="2025-ncaa-tournament"
      initialPicks={existingPicks || null}
      teams={allTeams}
      onSave={handleSave}
      autoSave={true}
    />
  );
}
```

## Data Structure

```typescript
interface BracketPicks {
  version: number;
  last_updated: string;
  regions: {
    [regionName: string]: {
      seeds: {
        [seed: number]: {
          team_id: string | null;
          picked_at: string;
        };
      };
    };
  };
}
```

## Features

### Phase 1 (MVP - Implemented)
- ✅ Click-to-select team assignment
- ✅ Four regions (East, West, South, Midwest)
- ✅ 16 seeds per region
- ✅ Team search modal with filtering
- ✅ Duplicate team prevention
- ✅ Auto-save with debouncing (1s)
- ✅ Validation errors display
- ✅ Save status indicator
- ✅ Responsive layout

### Phase 2 (Future)
- ⏳ Drag-and-drop seed assignment
- ⏳ Version history
- ⏳ Comparison with actual results

## Key Components

### BracketEditor
Main container managing:
- State (bracket picks)
- Auto-save with 1s debounce
- Team selection modal
- Validation

### RegionSection
Displays one region:
- 16 seed slots
- Grid layout (1 col mobile, 2 cols desktop)
- Team lookup

### SeedSlot
Individual seed slot:
- Seed number badge
- Team name + conference
- Click to select/change
- Remove button

### TeamSelector
Modal for team selection:
- Search filtering
- Conference badges
- Disabled already-selected teams
- Auto-close on selection

## Validation

Validates:
- All 64 slots filled (16 per region)
- No duplicate teams across bracket
- Returns errors array for display

## Auto-Save

- Debounced 1s after last edit
- Shows "Saving..." indicator
- Shows "Saved" confirmation (2s)
- Error handling with console logging

## Integration

The module is self-contained and requires:

1. **Teams data**: Array of Team objects
2. **Save handler**: Async function to persist picks
3. **Initial picks**: Existing bracket or null
4. **Tournament ID**: For tracking context

## TypeScript

All types are exported from `types.ts`:
- `BracketPicks` - Main data structure
- `Team` - Team with conference
- `ValidationResult` - Validation output
- Component prop interfaces

## Testing

Verify:
- TypeScript compiles without errors ✅
- Components render without console errors
- Team selection modal opens/closes
- Search filters teams correctly
- Selected teams disabled in modal
- Remove button works
- Auto-save triggers after edits
- Validation shows for incomplete brackets
- Responsive on mobile/tablet/desktop
