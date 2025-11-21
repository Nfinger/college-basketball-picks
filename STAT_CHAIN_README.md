# Stat Chain Connections

A daily puzzle game where players identify groups of 3 college basketball teams that share statistical or categorical connections.

## Overview

Stat Chain Connections is inspired by the NYT Connections game, adapted for college basketball. Each day presents 12 teams organized into 4 hidden groups of 3 teams each. Players must identify which teams belong together based on shared characteristics.

## Game Rules

- **12 teams** arranged randomly in a 4x3 grid
- **4 groups** of 3 teams each
- **4 difficulty levels**: Easy (Yellow), Medium (Green), Hard (Blue), Expert (Purple)
- **Maximum 4 mistakes** allowed
- **One puzzle per day** (date-based)

### How to Play

1. Select exactly 3 teams you think form a group
2. Click "Submit Guess" to check your answer
3. If correct, the group is revealed with its connection
4. If incorrect, you lose one mistake and can try again
5. Win by finding all 4 groups before running out of mistakes

## Database Schema

### Tables

**stat_chain_puzzles**
- `id` (UUID, PK): Puzzle identifier
- `puzzle_date` (DATE, UNIQUE): Date of puzzle
- `created_at` (TIMESTAMPTZ): Creation timestamp

**stat_chain_groups**
- `id` (UUID, PK): Group identifier
- `puzzle_id` (UUID, FK): Reference to puzzle
- `group_order` (INTEGER 1-4): Display order
- `difficulty` (TEXT): easy, medium, hard, expert
- `connection_title` (TEXT): Short description of connection
- `connection_explanation` (TEXT): Detailed explanation

**stat_chain_teams**
- `id` (UUID, PK): Link identifier
- `group_id` (UUID, FK): Reference to group
- `team_id` (UUID, FK): Reference to teams table

**stat_chain_sessions**
- `id` (UUID, PK): Session identifier
- `puzzle_id` (UUID, FK): Reference to puzzle
- `user_id` (UUID, FK): Reference to user
- `started_at` (TIMESTAMPTZ): When puzzle started
- `completed_at` (TIMESTAMPTZ): When puzzle finished
- `mistakes` (INTEGER 0-4): Number of mistakes made
- `solved_groups` (UUID[]): Array of solved group IDs
- `guess_history` (JSONB): Array of previous guesses
- Unique constraint on (user_id, puzzle_id)

## Implementation

### Routes

**Main Game**: `/stat-chain`
- Loader: Fetches daily puzzle and user session
- Action: Validates guesses and updates session

**Admin** (Not yet implemented): `/stat-chain/admin`
- Create and manage daily puzzles

### Components

**TeamCard** (`app/components/stat-chain/TeamCard.tsx`)
- Individual team tile with logo and name
- States: default, selected, disabled, incorrect (shake)

**GameGrid** (`app/components/stat-chain/GameGrid.tsx`)
- 4x3 responsive grid container
- Filters out solved teams
- Handles selection (max 3 teams)

**CompletedGroups** (`app/components/stat-chain/CompletedGroups.tsx`)
- Displays solved groups color-coded by difficulty
- Expandable to show explanation

**MistakesCounter** (`app/components/stat-chain/MistakesCounter.tsx`)
- Visual dots showing mistakes used/remaining

**GameOverModal** (`app/components/stat-chain/GameOverModal.tsx`)
- Results modal after completion
- Shows all groups with solutions
- Share button for results

### Core Logic

**Game Logic** (`app/lib/stat-chain/game-logic.ts`)
- `checkGuess()`: Validates team selection against groups
- `isGameComplete()`: Determines win/loss state
- `shuffleArray()`: Fisher-Yates shuffle with optional seeding
- `generateShareText()`: Creates shareable results text

**Types** (`app/lib/stat-chain/types.ts`)
- Complete TypeScript definitions
- DTOs for API transport
- Constants for colors and limits

## Example Connection Types

**Easy (Yellow)**
- "ACC Teams" - Teams from same conference
- "Top 10 Teams" - Ranked teams
- "Blue Mascots" - Teams with blue in colors

**Medium (Green)**
- "Over 80 PPG" - High-scoring offenses
- "Under 60 PPG Allowed" - Strong defenses
- "Tournament Teams" - NCAA tournament history

**Hard (Blue)**
- "Similar KenPom Rank" - Statistical similarity
- "Upset Victories" - Beat ranked opponents
- "Comeback Wins" - Won after trailing by 10+

**Expert (Purple)**
- "Share Alumni Coach" - Obscure connections
- "Similar 3PT %" - Specific stat ranges
- "Same Game Score Pattern" - Win/loss sequences

## Setup

### Database Migration

```bash
# Run migrations to create tables
supabase migration up
```

### Seed Data

The seed migration includes a sample puzzle with teams from ACC, Big Ten, Big 12, and SEC conferences.

### Navigation

Add a link to the stat-chain route in your navigation:

```tsx
<Link to="/stat-chain">Stat Chain</Link>
```

## Development Notes

### Philosophy Alignment

This implementation follows the project's core principles:

**Ruthless Simplicity**
- Simplified schema (4 tables vs 6 in original spec)
- JSONB for guess history (no separate guesses table)
- Reuses existing teams table (no duplication)

**Server-First Architecture**
- All validation happens server-side (action)
- Session state persisted in database
- No complex client-side state management

**Modular Design**
- Self-contained components with clear responsibilities
- Game logic separated from UI
- Types defined explicitly

### Security

- Row Level Security (RLS) policies on all tables
- User can only read own sessions
- Admins required for puzzle creation
- Server-side guess validation

### Performance

- Indexes on foreign keys and unique constraints
- Date-based lookup optimization
- Eager loading of puzzle with groups and teams
- Minimal re-renders with React.useState

## Future Enhancements

### Admin Features
- Visual puzzle builder
- Team search and selection
- Difficulty assignment
- Preview and testing
- Schedule future puzzles

### Game Features
- Hints system (reveal one team per group)
- Daily streak tracking
- Leaderboard (fastest solves)
- Statistics dashboard
- Share to social media

### Content
- Historical puzzles archive
- Practice mode (unlimited attempts)
- Custom puzzles by users
- Tournament-specific puzzles

## Testing

Manual testing checklist:

- [ ] Load today's puzzle
- [ ] Select 3 teams
- [ ] Submit correct guess → group reveals
- [ ] Submit incorrect guess → shake animation, mistake counter
- [ ] Reach 4 mistakes → game over modal (loss)
- [ ] Solve all 4 groups → game over modal (win)
- [ ] Share results → clipboard copy
- [ ] Refresh page → session persists
- [ ] Different date query param → loads different puzzle

## Troubleshooting

**Puzzle not loading**
- Check database migrations ran successfully
- Verify seed data exists for the date
- Check Supabase RLS policies

**Session not saving**
- Verify user authentication
- Check database constraints (unique user/puzzle)
- Review server action response

**Teams not showing**
- Confirm teams exist in teams table
- Check stat_chain_teams foreign key references
- Verify logo URLs are accessible

## Credits

Inspired by the New York Times Connections puzzle game, adapted for college basketball statistics and team attributes.
