// Stat Chain Connections - Main Game Route
// Daily puzzle game where users identify groups of 3 teams with shared connections

import { useEffect, useState } from 'react'
import { redirect, type Route } from 'react-router'
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { requireAuth } from '~/lib/auth.server'
import { checkGuess, isGameComplete, shuffleArray } from '~/lib/stat-chain/game-logic'
import type { GroupDTO, GuessResult, PuzzleDTO, SessionDTO, TeamDTO } from '~/lib/stat-chain/types'
import { GameGrid } from '~/components/stat-chain/GameGrid'
import { CompletedGroups } from '~/components/stat-chain/CompletedGroups'
import { MistakesCounter } from '~/components/stat-chain/MistakesCounter'
import { GameOverModal } from '~/components/stat-chain/GameOverModal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'

export async function loader({ request }: Route.LoaderArgs) {
  const { user, supabase, headers } = await requireAuth(request)
  const url = new URL(request.url)
  const dateParam = url.searchParams.get('date')

  // Use today's date if not specified
  const targetDate = dateParam || new Date().toISOString().split('T')[0]

  // Fetch puzzle for the target date
  const { data: puzzleData, error: puzzleError } = await supabase
    .from('stat_chain_puzzles')
    .select(`
      id,
      puzzle_date,
      stat_chain_groups (
        id,
        group_order,
        difficulty,
        connection_title,
        connection_explanation,
        stat_chain_teams (
          team:teams (
            id,
            name,
            short_name,
            logo_url
          )
        )
      )
    `)
    .eq('puzzle_date', targetDate)
    .single()

  // No puzzle for this date
  if (puzzleError || !puzzleData) {
    return {
      puzzle: null,
      session: null,
      noPuzzle: true,
      headers,
    }
  }

  // Transform puzzle data
  const groups: GroupDTO[] = puzzleData.stat_chain_groups.map((g: any) => ({
    id: g.id,
    order: g.group_order,
    difficulty: g.difficulty,
    title: g.connection_title,
    explanation: g.connection_explanation,
    teams: g.stat_chain_teams.map((st: any) => ({
      id: st.team.id,
      name: st.team.name,
      shortName: st.team.short_name,
      logoUrl: st.team.logo_url,
    })),
  }))

  const allTeams = groups.flatMap((g) => g.teams)

  const puzzle: PuzzleDTO = {
    id: puzzleData.id,
    date: puzzleData.puzzle_date,
    teams: allTeams,
    groups,
  }

  // Get or create session
  let { data: session } = await supabase
    .from('stat_chain_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('puzzle_id', puzzle.id)
    .single()

  if (!session) {
    const { data: newSession, error: sessionError } = await supabase
      .from('stat_chain_sessions')
      .insert({
        user_id: user.id,
        puzzle_id: puzzle.id,
        mistakes: 0,
        solved_groups: [],
        guess_history: [],
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return { puzzle, session: null, headers }
    }

    session = newSession
  }

  // Transform session data
  const solvedGroupIds = session.solved_groups || []
  const solvedGroups = groups.filter((g) => solvedGroupIds.includes(g.id))

  const sessionDTO: SessionDTO = {
    id: session.id,
    puzzleId: session.puzzle_id,
    mistakes: session.mistakes,
    maxMistakes: 4,
    solvedGroups,
    completed: session.completed_at !== null,
    won: solvedGroupIds.length === 4 && session.mistakes < 4,
    completedAt: session.completed_at,
  }

  return {
    puzzle,
    session: sessionDTO,
    noPuzzle: false,
    headers,
  }
}

export async function action({ request }: Route.ActionArgs) {
  const { user, supabase, headers } = await requireAuth(request)
  const formData = await request.formData()
  const actionType = formData.get('_action') as string

  if (actionType === 'submit_guess') {
    const sessionId = formData.get('sessionId') as string
    const teamIdsJson = formData.get('teamIds') as string
    const teamIds = JSON.parse(teamIdsJson) as string[]

    // Validate input
    if (!Array.isArray(teamIds) || teamIds.length !== 3) {
      return {
        error: 'Must select exactly 3 teams',
        headers,
      }
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('stat_chain_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return {
        error: 'Invalid session',
        headers,
      }
    }

    if (session.completed_at) {
      return {
        error: 'Game already completed',
        headers,
      }
    }

    // Get all groups for this puzzle
    const { data: groupsData } = await supabase
      .from('stat_chain_groups')
      .select(`
        id,
        group_order,
        difficulty,
        connection_title,
        connection_explanation,
        stat_chain_teams (
          team:teams (
            id,
            name,
            short_name,
            logo_url
          )
        )
      `)
      .eq('puzzle_id', session.puzzle_id)

    if (!groupsData) {
      return { error: 'Puzzle not found', headers }
    }

    const groups: GroupDTO[] = groupsData.map((g: any) => ({
      id: g.id,
      order: g.group_order,
      difficulty: g.difficulty,
      title: g.connection_title,
      explanation: g.connection_explanation,
      teams: g.stat_chain_teams.map((st: any) => ({
        id: st.team.id,
        name: st.team.name,
        shortName: st.team.short_name,
        logoUrl: st.team.logo_url,
      })),
    }))

    // Check the guess
    const solvedGroupIds = session.solved_groups || []
    const { correct, matchedGroup } = checkGuess(teamIds, groups, solvedGroupIds)

    // Update session
    const newMistakes = correct ? session.mistakes : session.mistakes + 1
    const newSolvedGroups = correct ? [...solvedGroupIds, matchedGroup!.id] : solvedGroupIds
    const newGuessHistory = [
      ...(session.guess_history || []),
      {
        teamIds,
        correct,
        groupId: matchedGroup?.id,
        timestamp: new Date().toISOString(),
      },
    ]

    const { complete, won } = isGameComplete(newSolvedGroups.length, newMistakes, 4)

    const { data: updatedSession } = await supabase
      .from('stat_chain_sessions')
      .update({
        mistakes: newMistakes,
        solved_groups: newSolvedGroups,
        guess_history: newGuessHistory,
        completed_at: complete ? new Date().toISOString() : null,
      })
      .eq('id', sessionId)
      .select()
      .single()

    const result: GuessResult = {
      result: correct ? 'correct' : complete ? 'game_over' : 'incorrect',
      group: matchedGroup || undefined,
      mistakes: newMistakes,
      gameCompleted: complete,
      won,
    }

    return { ...result, headers }
  }

  return { error: 'Invalid action', headers }
}

export default function StatChainRoute() {
  const { puzzle, session, noPuzzle } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const [selectedTeams, setSelectedTeams] = useState<string[]>([])
  const [showGameOver, setShowGameOver] = useState(false)

  const isSubmitting = navigation.state === 'submitting'

  // Handle team selection
  const handleTeamSelect = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter((id) => id !== teamId))
    } else if (selectedTeams.length < 3) {
      setSelectedTeams([...selectedTeams, teamId])
    }
  }

  // Handle action results
  useEffect(() => {
    if (actionData && 'result' in actionData) {
      if (actionData.result === 'correct') {
        // Clear selection on correct guess
        setTimeout(() => setSelectedTeams([]), 600)
      } else if (actionData.result === 'incorrect') {
        // Clear selection after shake animation
        setTimeout(() => setSelectedTeams([]), 400)
      } else if (actionData.result === 'game_over') {
        setShowGameOver(true)
        setSelectedTeams([])
      }
    }
  }, [actionData])

  // Show game over modal if session is completed
  useEffect(() => {
    if (session?.completed) {
      setShowGameOver(true)
    }
  }, [session?.completed])

  // No puzzle available
  if (noPuzzle) {
    return (
      <div className="container mx-auto py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>No Puzzle Available</CardTitle>
            <CardDescription>
              There is no puzzle available for today yet. Check back soon!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!puzzle || !session) {
    return null
  }

  const canSubmit = selectedTeams.length === 3 && !session.completed && !isSubmitting

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>College Hoops Connections</CardTitle>
          <CardDescription>
            Find groups of 3 teams that share a connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Completed Groups */}
          {session.solvedGroups.length > 0 && (
            <CompletedGroups groups={session.solvedGroups} />
          )}

          {/* Game Grid */}
          <GameGrid
            teams={puzzle.teams}
            selectedTeams={selectedTeams}
            solvedGroups={session.solvedGroups}
            onTeamSelect={handleTeamSelect}
            disabled={session.completed || isSubmitting}
            isIncorrect={actionData && 'result' in actionData && actionData.result === 'incorrect'}
          />

          {/* Mistakes Counter */}
          <MistakesCounter
            mistakes={session.mistakes}
            maxMistakes={session.maxMistakes}
          />

          {/* Submit Button */}
          {!session.completed && (
            <Form method="post" className="flex justify-center">
              <input type="hidden" name="_action" value="submit_guess" />
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="teamIds" value={JSON.stringify(selectedTeams)} />
              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit}
              >
                {isSubmitting ? 'Checking...' : 'Submit Guess'}
              </Button>
            </Form>
          )}

          {/* Error Message */}
          {actionData && 'error' in actionData && (
            <div className="text-center text-sm text-red-600">
              {actionData.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Game Over Modal */}
      {showGameOver && session.completed && (
        <GameOverModal
          won={session.won}
          groups={puzzle.groups}
          mistakes={session.mistakes}
          maxMistakes={session.maxMistakes}
          date={puzzle.date}
          onClose={() => setShowGameOver(false)}
        />
      )}
    </div>
  )
}
