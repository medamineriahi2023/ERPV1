import { TimeEntry } from './user.interface';

export interface UserHistoryStats {
  totalDays: number;
  totalHours: number;
  lateCount: number;
  onTimeCount: number;
  averageArrivalTime: string;
  averageDepartureTime: string;
  punctualityRate: number;
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  leaveCount: number;
}

export interface UserTimeEntry extends TimeEntry {
  duration?: number;
  isComplete?: boolean;
  lateMinutes?: number;
  expectedHours?: number;
  actualHours?: number;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
}

export interface MonthlyStats {
  month: number;
  year: number;
  stats: UserHistoryStats;
  entries: UserTimeEntry[];
}

export interface DailyStatus {
  date: Date;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  checkIn?: string;
  checkOut?: string;
  duration?: number;
  lateMinutes?: number;
}

export interface CalendarDay {
  date: Date;
  status?: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  entry?: UserTimeEntry;
  isToday: boolean;
  isCurrentMonth: boolean;
}
