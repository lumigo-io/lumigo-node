import type { EventTrigger } from './event-trigger.enum';

export type IncomingEvent = Record<string, any>;

export type EventInfo = {
  trigger: Trigger[];
};

export interface TriggerExtra {
  arn?: string;
  resource?: string;
  httpMethod?: string;
  api?: string;
  stage?: string;
  approxEventCreationTime?: number;
}

export interface Trigger {
  id: string;
  targetId: string | null;
  triggeredBy: EventTrigger;
  fromMessageIds: string[];
  extra?: TriggerExtra;
}
