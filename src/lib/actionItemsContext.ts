import { createContext, useContext } from 'react';
import type { ActionItem } from '@/lib/actionItems';

export interface ActionItemsValue {
  items: ActionItem[];
  /** Total across items (an item can stand for several things, e.g. unread messages). */
  count: number;
  /** Re-checks straight away — call after something the user did could have resolved an item. */
  refresh: () => void;
}

export const ActionItemsContext = createContext<ActionItemsValue>({ items: [], count: 0, refresh: () => {} });

export function useActionItems(): ActionItemsValue {
  return useContext(ActionItemsContext);
}
