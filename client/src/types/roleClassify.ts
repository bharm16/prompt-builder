import type { LabeledSpan } from '../schemas/roleClassify';

export interface ClientSpan {
  text: string;
  start: number;
  end: number;
}

export type { LabeledSpan };
