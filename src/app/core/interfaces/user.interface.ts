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
  id: number;
  userId: number;
  date: Date;
  checkIn: string;
  checkOut: string;
  lunchStart?: string;
  lunchEnd?: string;
  totalHours: number;
  status: 'complete' | 'incomplete';
}

export interface LeaveRequest {
  id: number;
  userId: number;
  type: 'annual' | 'sick';
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'rejected';
  attachmentUrl?: string; // For sick leave documentation
  reason: string;
  approverComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'on-hold';
  managerId: number;
  teamMembers: number[];
}

export interface WeeklyReport {
  id: number;
  projectId: number;
  userId: number;
  weekStartDate: Date;
  weekEndDate: Date;
  accomplishments: string;
  challenges: string;
  nextWeekPlan: string;
  status: 'draft' | 'submitted' | 'reviewed';
  reviewerComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveBalance {
  annual: {
    total: number;
    used: number;
    pending: number;
    available: number;
  };
  sick: {
    total: number;
    used: number;
    pending: number;
    available: number;
  };
}
