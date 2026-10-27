export interface BuyerReview {
  id: string;
  author: string;
  comment: string;
  purchaseVerified: boolean;
  approvedForPublication: boolean;
}

// Connect the purchase verification and review approval flow before adding entries.
export const buyerReviews: BuyerReview[] = [];
