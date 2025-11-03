# College Basketball Picks

A full-stack web application for making and tracking college basketball picks against the spread.

## Features

- User authentication with Supabase
- Daily game scraping from The Odds API
- Pick against the spread for college basketball games
- Real-time score updates
- Personal metrics dashboard with win/loss tracking
- Conference-based filtering and analytics
- Head-to-head comparison with other users
- Mobile-responsive design

## Tech Stack

- **Frontend**: React Router v7, TypeScript, Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Background Jobs**: Inngest
- **Data Source**: The Odds API
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- Supabase account
- Inngest account
- The Odds API key

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for Inngest)
- `ODDS_API_KEY` - The Odds API key
- `INNGEST_EVENT_KEY` - Inngest event key
- `INNGEST_SIGNING_KEY` - Inngest signing key

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

Link your Supabase project and run migrations:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase db seed
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

### 4. Start Inngest Dev Server (Optional)

In a separate terminal:

```bash
npm run inngest
```

## Database Schema

- **profiles** - User profiles
- **conferences** - College basketball conferences
- **teams** - College basketball teams
- **games** - Scheduled and completed games
- **picks** - User picks with results

## Background Jobs

- **Scrape Games** - Runs daily at 6 AM to fetch upcoming games
- **Update Scores** - Runs every 5 minutes to update game scores and pick results

## Deployment

Deploy to Vercel:

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

Configure Inngest webhook after deployment:
- Add `https://your-app.vercel.app/api/inngest` as your Inngest app URL

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run typecheck` - Run TypeScript type checking
- `npm run inngest` - Start Inngest dev server
- `npm run db:push` - Push database migrations
- `npm run db:seed` - Seed database with initial data

## License

MIT
