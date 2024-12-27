export interface PerformanceReview {
  id: number;
  employeeId: number;
  reviewerId: number;
  date: string;
  period: string;
  rating: number;
  strengths: string[];
  areasForImprovement: string[];
  goals: string[];
  comments: string;
  status: 'draft' | 'completed';
}
