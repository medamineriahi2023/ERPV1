import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Employee, PerformanceReview } from '../interfaces/employee.interface';

@Injectable({
  providedIn: 'root'
})
export class PerformanceReviewService {
  private apiUrl = 'api/performance-reviews'; // Update with your actual API endpoint

  constructor(private http: HttpClient) {}

  // Get employees managed by the current user
  getManagedEmployees(managerId: number): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/managed-employees/${managerId}`);
  }

  // Get employees eligible for review (no review in last 6 months)
  getEligibleEmployees(managerId: number): Observable<Employee[]> {
    return this.getManagedEmployees(managerId).pipe(
      map(employees => {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        return employees.filter(emp => {
          const lastReview = emp.lastReviewDate ? new Date(emp.lastReviewDate) : null;
          return !lastReview || lastReview < sixMonthsAgo;
        });
      })
    );
  }

  // Get review history for an employee
  getEmployeeReviews(employeeId: number): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.apiUrl}/employee/${employeeId}`);
  }

  // Save a new performance review
  saveReview(review: PerformanceReview): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(this.apiUrl, review);
  }

  // Check if employee is eligible for review
  isEligibleForReview(employeeId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/check-eligibility/${employeeId}`);
  }

  // Get the next available review date
  getNextReviewDate(employeeId: number): Observable<Date> {
    return this.http.get<Date>(`${this.apiUrl}/next-review-date/${employeeId}`);
  }
}
