export interface TimeEntry {
  id?: number;
  employeeId: number;
  date: string;
  time: string;
  type: 'ARRIVAL' | 'DEPARTURE' | 'BREAK_START' | 'BREAK_END';
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
}

export type TimeEntryType = 'ARRIVAL' | 'DEPARTURE' | 'BREAK_START' | 'BREAK_END';
