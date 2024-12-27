export interface TimeEntry {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string;
  totalHours: number;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
}
