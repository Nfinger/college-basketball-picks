import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  getMatchupData,
  saveMatchupAnalysis,
  type MatchupData,
} from "../../app/lib/matchup-analysis.server";

// Zod schema for structured output
const analysisSchema = z.object({
  analysis_text: z.string().describe("Comprehensive 2-3 paragraph analysis of the matchup"),
  prediction: z.object({
    winner_team_id: z.string().describe("UUID of the predicted winning team"),
    winner_name: z.string().describe("Name of the predicted winning team"),
    confidence: z.number().min(0).max(100).describe("Confidence level in the prediction (0-100)"),
    predicted_spread: z.number().optional().describe("Predicted point spread"),
  }),
  key_insights: z.array(z.string()).min(3).max(5).describe("3-5 concise key insights about the matchup"),
});

type AnalysisResult = z.infer<typeof analysisSchema>;

export const analyzeMatchup = inngest.createFunction(
  {
    id: "analyze-matchup",
    name: "Analyze Game Matchup with AI",
  },
  { event: "game/analyze.requested" },
  async ({ event, step }) => {
    const { gameId } = event.data;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Step 1: Gather all matchup data
    const matchupData = await step.run("gather-matchup-data", async () => {
      console.log(`Gathering data for game ${gameId}...`);
      const data = await getMatchupData(supabase, gameId);

      if (!data) {
        throw new Error(`Failed to fetch matchup data for game ${gameId}`);
      }

      console.log(
        `Gathered data for ${data.awayTeam.name} @ ${data.homeTeam.name}`
      );
      return data;
    });

    // Step 2: Generate AI analysis
    const analysis = await step.run("generate-ai-analysis", async () => {
      console.log("Generating AI analysis...");
      return await generateMatchupAnalysis(matchupData);
    });

    // Step 3: Save analysis to database
    const saved = await step.run("save-analysis", async () => {
      console.log("Saving analysis to database...");
      return await saveMatchupAnalysis(
        supabase,
        gameId,
        analysis.analysis_text,
        analysis.prediction,
        analysis.key_insights,
        {
          homeTeam: matchupData.homeTeam.stats,
          awayTeam: matchupData.awayTeam.stats,
        }
      );
    });

    if (!saved.success) {
      throw new Error(`Failed to save analysis: ${saved.error}`);
    }

    console.log(`Analysis complete for game ${gameId}`);
    return {
      success: true,
      gameId,
      analysis,
    };
  }
);

/**
 * Generate matchup analysis using Claude via AI SDK with structured outputs
 */
async function generateMatchupAnalysis(
  matchupData: MatchupData
): Promise<AnalysisResult> {
  const prompt = buildAnalysisPrompt(matchupData);

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: analysisSchema,
    system: getSystemPrompt(),
    prompt,
    headers: {
      'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14',
    },
  });

  return object;
}

/**
 * Build the system prompt for Claude
 */
function getSystemPrompt(): string {
  return `You are an expert college basketball analyst with deep knowledge of the game, team dynamics, and statistical analysis. Your job is to analyze matchups between college basketball teams and provide insightful, data-driven predictions.

When analyzing a matchup, consider:
- Advanced metrics (KenPom, BartTorvik ratings, efficiency margins, tempo)
- Recent performance and momentum
- Historical context (similar opponents faced, head-to-head records)
- Injuries and roster changes
- Conference strength and competition level
- Home court advantage
- Team styles and how they match up

Provide your analysis in a structured JSON format with:
1. A comprehensive analysis_text (2-3 paragraphs of natural language analysis)
2. A prediction object with winner, confidence (0-100), and predicted spread
3. An array of 3-5 key_insights (concise bullet points)

Be objective, data-driven, and acknowledge uncertainty where appropriate. Reference specific stats and recent games to support your reasoning.`;
}

/**
 * Build the user prompt with matchup data
 */
function buildAnalysisPrompt(matchupData: MatchupData): string {
  const { game, homeTeam, awayTeam } = matchupData;
  const gameDate = new Date(game.game_date).toLocaleDateString();

  let prompt = `Analyze this college basketball matchup:\n\n`;
  prompt += `**${awayTeam.name} @ ${homeTeam.name}**\n`;
  prompt += `Date: ${gameDate}\n`;
  if (game.spread) {
    const favTeamId = game.favorite_team_id;
    const favTeam =
      favTeamId === homeTeam.id
        ? homeTeam.short_name
        : awayTeam.short_name;
    prompt += `Spread: ${favTeam} -${Math.abs(game.spread)}\n`;
  }
  prompt += `\n`;

  // Add team stats and recent performance
  prompt += formatTeamData("Away Team", awayTeam);
  prompt += `\n`;
  prompt += formatTeamData("Home Team", homeTeam);

  prompt += `\n**TASK:**\nAnalyze this matchup and provide your assessment. Consider the statistical profiles, recent performance, injuries, and any relevant context. `;
  prompt += `Look for patterns like "Team X recently played a similar opponent to Team Y and dominated/struggled in that matchup" to draw meaningful comparisons.\n\n`;

  prompt += `Provide:\n`;
  prompt += `1. A detailed 2-3 paragraph analysis of the matchup\n`;
  prompt += `2. Your prediction including the winner (use team ID: ${homeTeam.id} for ${homeTeam.name} or ${awayTeam.id} for ${awayTeam.name}), confidence level (0-100), and predicted point spread\n`;
  prompt += `3. 3-5 key insights as concise bullet points\n`;

  return prompt;
}

/**
 * Format team data for the prompt
 */
function formatTeamData(
  label: string,
  team: MatchupData["homeTeam"] | MatchupData["awayTeam"]
): string {
  let output = `## ${label}: ${team.name}\n`;
  output += `Conference: ${team.conference.name} ${team.conference.is_power_conference ? "(Power Conference)" : ""}\n\n`;

  // Stats
  if (team.stats) {
    output += `**Advanced Metrics:**\n`;
    output += `- Source: ${team.stats.source || 'Unknown'}\n`;
    if (team.stats.overall_rank) {
      output += `- Overall Rank: #${team.stats.overall_rank}\n`;
    }
    if (team.stats.offensive_efficiency && team.stats.defensive_efficiency) {
      const effMargin = team.stats.offensive_efficiency - team.stats.defensive_efficiency;
      output += `- Efficiency Margin: ${effMargin.toFixed(1)}\n`;
      output += `- Offensive Efficiency: ${team.stats.offensive_efficiency.toFixed(1)} (Rank: ${team.stats.offensive_efficiency_rank || 'N/A'})\n`;
      output += `- Defensive Efficiency: ${team.stats.defensive_efficiency.toFixed(1)} (Rank: ${team.stats.defensive_efficiency_rank || 'N/A'})\n`;
    }
    if (team.stats.tempo) {
      output += `- Tempo: ${team.stats.tempo.toFixed(1)} possessions/game\n`;
    }
    if (team.stats.wins !== undefined && team.stats.losses !== undefined) {
      const winPct = team.stats.games_played ? (team.stats.wins / team.stats.games_played * 100).toFixed(1) : 'N/A';
      output += `- Record: ${team.stats.wins}-${team.stats.losses} (${winPct}%)\n`;
    }
    if (team.stats.points_per_game && team.stats.points_allowed_per_game) {
      output += `- PPG: ${team.stats.points_per_game.toFixed(1)} | Opp PPG: ${team.stats.points_allowed_per_game.toFixed(1)}\n`;
    }
    if (team.stats.strength_of_schedule) {
      output += `- Strength of Schedule: ${team.stats.strength_of_schedule.toFixed(2)} (Rank: ${team.stats.strength_of_schedule_rank || 'N/A'})\n`;
    }
    output += `\n`;
  }

  // Recent games
  if (team.recentGames.length > 0) {
    output += `**Recent Games (Last ${Math.min(5, team.recentGames.length)}):**\n`;
    team.recentGames.slice(0, 5).forEach((game) => {
      const location = game.was_home ? "vs" : "@";
      const result = game.result === "won" ? "W" : "L";
      const pointDiff = game.point_differential !== null ? `${game.point_differential > 0 ? "+" : ""}${game.point_differential}` : "N/A";
      output += `- ${result} ${location} ${game.opponent_short_name} (${game.team_score}-${game.opponent_score}, ${pointDiff})\n`;
    });
    output += `\n`;
  }

  // Injuries
  if (team.injuries.length > 0) {
    output += `**Injury Report:**\n`;
    team.injuries.slice(0, 5).forEach((injury) => {
      output += `- ${injury.player_name}: ${injury.status}${injury.description ? ` (${injury.description})` : ""}\n`;
    });
    output += `\n`;
  }

  // Recent news
  if (team.recentNews.length > 0) {
    output += `**Recent News:**\n`;
    team.recentNews.slice(0, 3).forEach((news) => {
      output += `- ${news.title} (${news.source})\n`;
    });
    output += `\n`;
  }

  return output;
}
