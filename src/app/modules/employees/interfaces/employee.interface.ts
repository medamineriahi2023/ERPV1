export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  managerId: number;
  department: string;
  lastReviewDate: Date | null;
}

export interface PerformanceReview {
  id?: number;
  employeeId: number;
  managerId: number;
  reviewDate: Date;
  metrics: {
    category: string;
    weight: number;
    score: number;
    comments: string;
  }[];
  overallScore: number;
  nextReviewDate: Date;
  status: 'draft' | 'completed';
}
