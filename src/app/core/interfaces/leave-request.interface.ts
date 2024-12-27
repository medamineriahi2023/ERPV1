export interface LeaveRequest {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick';
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedBy?: number;
  approvedAt?: string;
  attachmentUrl?: string;
}
