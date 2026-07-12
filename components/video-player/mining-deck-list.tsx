import { Card } from "@/components/ui/card";
import { splitSentenceForEmphasis } from "@/lib/mining-format";
import type { MiningCardListItem } from "@/lib/mining-types";
import { MiningClipPlayer } from "./mining-clip-player";

export interface MiningDeckListProps {
  cards: MiningCardListItem[];
}

/**
 * The current user's sentence-mining deck (CLAUDE.md §5 differentiator #3):
 * each card shows its sentence with the target word emphasized (bold +
 * underline, never color alone), reading, translation, and a lazily-mounted
 * "Play clip" control that replays the source segment through the official
 * YouTube embed — a card stores no media of its own.
 */
export function MiningDeckList({ cards }: MiningDeckListProps) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No mined sentences yet. While shadowing a video, tap &quot;Mine&quot; on a transcript line
        to add one.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.id}>
          <Card className="flex h-full flex-col gap-2 p-4">
            <p className="font-jp text-lg leading-relaxed">
              {splitSentenceForEmphasis(card.sentenceJp, card.targetWord).map((segment, index) =>
                segment.emphasized ? (
                  <strong
                    key={index}
                    className="text-primary underline decoration-2 underline-offset-2"
                  >
                    {segment.text}
                  </strong>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </p>
            {card.reading && (
              <p className="font-jp text-sm text-muted-foreground">{card.reading}</p>
            )}
            {card.translation && <p className="text-sm">{card.translation}</p>}
            <div className="mt-auto pt-2">
              <MiningClipPlayer
                videoId={card.videoId}
                startTime={card.startTime}
                endTime={card.endTime}
              />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
