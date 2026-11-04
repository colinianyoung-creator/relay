import { createContext, useContext } from 'react';

export interface FeedbackValue {
  openFeedback: () => void;
}

export const FeedbackContext = createContext<FeedbackValue>({ openFeedback: () => {} });

export function useFeedback(): FeedbackValue {
  return useContext(FeedbackContext);
}
