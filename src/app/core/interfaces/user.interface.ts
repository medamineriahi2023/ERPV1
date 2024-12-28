export interface User {
  id: number;
  username: string;
  password?: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: 'admin' | 'manager' | 'employee';
  photoUrl?: string;
  department: string;
  position: string;
  managerId: number | null;
  managedEmployees: number[];
  hireDate: Date;
  leaveBalance: {
    annual: number;
    sick: number;
  };
  workSchedule: {
    startTime: string;
    endTime: string;
    lunchBreakDuration: number; // in minutes
  };
  rating?: number;
  status?: 'active' | 'inactive' | 'pending';
  contractType?: 'CDI' | 'CDD' | 'Intern';
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TimeEntry {
  id?: number;
  userId: number;
  date: Date;
  checkIn: string;
  checkOut?: string | null;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  totalHours: number;
  status: 'present' | 'absent' | 'leave' | 'holiday' | 'late';
  isLate?: boolean;
}



