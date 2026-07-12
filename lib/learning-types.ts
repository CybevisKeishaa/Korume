/** A card in an SRS review session. Neutral type shared by server + client. */
export interface ReviewItem {
  id: string;
  front: string;
  back: string;
  sub?: string;
}
