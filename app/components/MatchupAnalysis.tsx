import { useState } from 'react'
import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface MatchupAnalysisData {
  id: string
  analysis_text: string
  prediction: {
    winner_team_id: string
    winner_name: string
    confidence: number
    predicted_spread?: number
  }
  key_insights: string[]
  analyzed_at: string
}

interface MatchupAnalysisProps {
  gameId: string
  analysis: MatchupAnalysisData | null
  homeTeamName: string
  awayTeamName: string
}

export function MatchupAnalysis({
  gameId,
  analysis,
  homeTeamName,
  awayTeamName,
}: MatchupAnalysisProps) {
  const fetcher = useFetcher()
  const [isExpanded, setIsExpanded] = useState(false)

  const isGenerating = fetcher.state === 'submitting' || fetcher.state === 'loading'

  const handleGenerateAnalysis = () => {
    fetcher.submit(
      { gameId },
      {
        method: 'POST',
        action: '/api/analyze-matchup',
        encType: 'application/json',
      }
    )
  }

  // If no analysis and not generating, show the generate button
  if (!analysis && !isGenerating) {
    return (
      <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Sparkles className="h-10 w-10 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">AI Matchup Analysis</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Get AI-powered insights comparing {awayTeamName} and {homeTeamName}
              </p>
            </div>
            <Button onClick={handleGenerateAnalysis} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // If generating, show loading state
  if (isGenerating) {
    return (
      <Card className="border-purple-200 dark:border-purple-900">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Loader2 className="h-10 w-10 text-purple-500 animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Analyzing Matchup...</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Our AI is analyzing team stats, recent games, and historical matchups
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show the analysis (analysis is guaranteed to be non-null here)
  if (!analysis) {
    return null;
  }

  return (
    <Card className="border-purple-200 dark:border-purple-900 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Matchup Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Insights */}
        <div>
          <h4 className="font-semibold text-sm mb-2 text-slate-700 dark:text-slate-300">
            Key Insights
          </h4>
          <ul className="space-y-2">
            {analysis.key_insights.map((insight, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="text-purple-500 mt-0.5">•</span>
                <span className="text-slate-700 dark:text-slate-300">{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Prediction */}
        <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
          <div className="flex-1">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              Prediction
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {analysis.prediction.winner_name}
            </div>
            {analysis.prediction.predicted_spread && (
              <div className="text-sm text-slate-600 dark:text-slate-400">
                by {Math.abs(analysis.prediction.predicted_spread).toFixed(1)} points
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
              Confidence
            </div>
            <Badge className="bg-purple-600 text-white text-lg px-3 py-1">
              {analysis.prediction.confidence}%
            </Badge>
          </div>
        </div>

        {/* Full Analysis - Expandable */}
        <div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Full Analysis
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                View Full Analysis
              </>
            )}
          </button>
          {isExpanded && (
            <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {analysis.analysis_text}
              </div>
            </div>
          )}
        </div>

        {/* Timestamp and Regenerate */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Analyzed {new Date(analysis.analyzed_at).toLocaleDateString()} at{' '}
            {new Date(analysis.analyzed_at).toLocaleTimeString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateAnalysis}
            className="text-xs gap-1"
            disabled={isGenerating}
          >
            <Sparkles className="h-3 w-3" />
            Regenerate
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
