// GameOverModal Component - Results screen after game completion

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import type { GroupDTO } from '~/lib/stat-chain/types'
import { DIFFICULTY_COLORS } from '~/lib/stat-chain/types'
import { generateShareText } from '~/lib/stat-chain/game-logic'
import { toast } from 'sonner'

type GameOverModalProps = {
  won: boolean
  groups: GroupDTO[]
  mistakes: number
  maxMistakes: number
  date: string
  onClose: () => void
}

export function GameOverModal({
  won,
  groups,
  mistakes,
  maxMistakes,
  date,
  onClose,
}: GameOverModalProps) {
  const [open, setOpen] = useState(true)

  const handleClose = () => {
    setOpen(false)
    onClose()
  }

  const handleShare = () => {
    const shareText = generateShareText(date, groups, mistakes, maxMistakes)

    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).then(() => {
        toast.success('Results copied to clipboard!')
      }).catch(() => {
        toast.error('Failed to copy to clipboard')
      })
    } else {
      toast.error('Clipboard not supported')
    }
  }

  // Sort groups by order
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {won ? '🎉 Congratulations!' : '😔 Game Over'}
          </DialogTitle>
          <DialogDescription>
            {won
              ? `You solved the puzzle with ${mistakes} mistake${mistakes !== 1 ? 's' : ''}!`
              : 'You ran out of mistakes. Better luck next time!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* All Groups with Solutions */}
          <div>
            <h3 className="font-semibold mb-3">Today's Connections:</h3>
            <div className="space-y-2">
              {sortedGroups.map((group) => {
                const colors = DIFFICULTY_COLORS[group.difficulty]
                return (
                  <div
                    key={group.id}
                    className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border} ${colors.text}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{group.title}</div>
                      <div className="text-xs uppercase font-semibold opacity-75">
                        {group.difficulty}
                      </div>
                    </div>
                    <div className="text-sm mb-2">
                      {group.teams.map((t) => t.shortName || t.name).join(' • ')}
                    </div>
                    <div className="text-sm opacity-90 border-t border-current/20 pt-2 mt-2">
                      {group.explanation}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={handleShare}>
              Share Results
            </Button>
            <Button onClick={handleClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
