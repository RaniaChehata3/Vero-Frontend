export interface Formation {
  id?: number;
  title: string;
  description: string;
  duration: number; // in hours
  maxCapacity: number;
  status: FormationStatus;
  participantIds?: number[];
}

export enum FormationStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export interface Session {
  id?: number;
  title: string;
  startDate: string; // ISO format
  endDate: string;
  status: SessionStatus;
  meetLink?: string;
  trainerId: number;
  formation?: Formation;
}

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}
