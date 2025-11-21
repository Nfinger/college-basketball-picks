/**
 * Inngest Tournament Scraper Job
 *
 * Background job that automatically scrapes and updates tournament data from ESPN.
 * Runs on a schedule during tournament season.
 */

import { inngest } from '../client';
import { createClient } from '@supabase/supabase-js';
import { importNCAATournament } from '~/lib/tournaments/game-importer';

// Initialize Supabase client for background jobs
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Scrape NCAA Tournament games
 * Runs every 6 hours during March Madness
 */
export const scrapeNCAATournament = inngest.createFunction(
  {
    id: 'scrape-ncaa-tournament',
    name: 'Scrape NCAA Tournament Games',
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ event, step }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Only run during tournament season (March-April)
    if (currentMonth < 3 || currentMonth > 4) {
      return { skipped: true, reason: 'Not tournament season' };
    }

    // Import games
    const result = await step.run('import-ncaa-games', async () => {
      return await importNCAATournament(supabase, currentYear, {
        updateExisting: true,
        dryRun: false,
      });
    });

    // Send notification if there were errors
    if (result.errors.length > 0) {
      await step.run('send-error-notification', async () => {
        // TODO: Send notification to admin (email, Slack, etc.)
        console.error('Tournament scraper errors:', result.errors);
        return { notified: true };
      });
    }

    return {
      gamesCreated: result.gamesCreated,
      gamesUpdated: result.gamesUpdated,
      gamesSkipped: result.gamesSkipped,
      errors: result.errors.length,
      unmatchedTeams: result.unmatchedTeams.length,
    };
  },
);

/**
 * Manually trigger tournament scraping
 * Can be called via Inngest dashboard or API
 */
export const scrapeNCAATournamentManual = inngest.createFunction(
  {
    id: 'scrape-ncaa-tournament-manual',
    name: 'Manually Scrape NCAA Tournament',
  },
  { event: 'tournament/scrape.ncaa' },
  async ({ event, step }) => {
    const year = event.data.year || new Date().getFullYear();
    const dryRun = event.data.dryRun || false;

    const result = await step.run('import-ncaa-games', async () => {
      return await importNCAATournament(supabase, year, {
        updateExisting: true,
        dryRun,
      });
    });

    return {
      year,
      dryRun,
      gamesCreated: result.gamesCreated,
      gamesUpdated: result.gamesUpdated,
      gamesSkipped: result.gamesSkipped,
      errors: result.errors,
      unmatchedTeams: result.unmatchedTeams,
    };
  },
);

/**
 * Update tournament status based on dates
 * Runs daily to update status (upcoming -> in_progress -> completed)
 */
export const updateTournamentStatus = inngest.createFunction(
  {
    id: 'update-tournament-status',
    name: 'Update Tournament Status',
  },
  { cron: '0 0 * * *' }, // Daily at midnight
  async ({ event, step }) => {
    const today = new Date().toISOString().split('T')[0];

    // Update tournaments that should be in_progress
    const { data: startedTournaments } = await step.run('mark-tournaments-in-progress', async () => {
      return await supabase
        .from('tournaments')
        .update({ status: 'in_progress' })
        .eq('status', 'upcoming')
        .lte('start_date', today)
        .gte('end_date', today)
        .select('id, name');
    });

    // Update tournaments that should be completed
    const { data: completedTournaments } = await step.run('mark-tournaments-completed', async () => {
      return await supabase
        .from('tournaments')
        .update({ status: 'completed' })
        .or('status.eq.upcoming,status.eq.in_progress')
        .lt('end_date', today)
        .select('id, name');
    });

    return {
      started: startedTournaments?.length || 0,
      completed: completedTournaments?.length || 0,
    };
  },
);

/**
 * Scrape conference tournament games
 * Triggered manually with conference details
 */
export const scrapeConferenceTournament = inngest.createFunction(
  {
    id: 'scrape-conference-tournament',
    name: 'Scrape Conference Tournament',
  },
  { event: 'tournament/scrape.conference' },
  async ({ event, step }) => {
    const { conferenceId, conferenceName, year, startDate, endDate, dryRun } = event.data;

    const { importConferenceTournament } = await import('~/lib/tournaments/game-importer');

    const result = await step.run('import-conference-games', async () => {
      return await importConferenceTournament(
        supabase,
        conferenceId,
        conferenceName,
        year,
        startDate,
        endDate,
        {
          updateExisting: true,
          dryRun: dryRun || false,
        },
      );
    });

    return {
      conference: conferenceName,
      year,
      dryRun: dryRun || false,
      gamesCreated: result.gamesCreated,
      gamesUpdated: result.gamesUpdated,
      gamesSkipped: result.gamesSkipped,
      errors: result.errors,
      unmatchedTeams: result.unmatchedTeams,
    };
  },
);

/**
 * Scrape MTE games
 * Triggered manually with event details
 */
export const scrapeMTE = inngest.createFunction(
  {
    id: 'scrape-mte',
    name: 'Scrape Multi-Team Event',
  },
  { event: 'tournament/scrape.mte' },
  async ({ event, step }) => {
    const { eventName, year, startDate, endDate, location, dryRun } = event.data;

    const { importMTE } = await import('~/lib/tournaments/game-importer');

    const result = await step.run('import-mte-games', async () => {
      return await importMTE(supabase, eventName, year, startDate, endDate, location, {
        updateExisting: true,
        dryRun: dryRun || false,
      });
    });

    return {
      event: eventName,
      year,
      dryRun: dryRun || false,
      gamesCreated: result.gamesCreated,
      gamesUpdated: result.gamesUpdated,
      gamesSkipped: result.gamesSkipped,
      errors: result.errors,
      unmatchedTeams: result.unmatchedTeams,
    };
  },
);
