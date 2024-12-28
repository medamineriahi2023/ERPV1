import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Employee, PerformanceReview } from '../interfaces/employee.interface';

@Injectable({
  providedIn: 'root'
})
export class MockPerformanceReviewService {
  private mockEmployees: Employee[] = [
    {
      id: 1,
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@example.com',
      position: 'Développeur Senior',
      managerId: 1,
      department: 'IT',
      lastReviewDate: new Date('2023-06-15')
    },
    {
      id: 2,
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie.martin@example.com',
      position: 'Chef de Projet',
      managerId: 1,
      department: 'IT',
      lastReviewDate: null
    },
    {
      id: 3,
      firstName: 'Pierre',
      lastName: 'Bernard',
      email: 'pierre.bernard@example.com',
      position: 'Développeur Full Stack',
      managerId: 1,
      department: 'IT',
      lastReviewDate: new Date('2024-01-10')
    }
  ];

  private mockReviews: PerformanceReview[] = [
    {
      id: 1,
      employeeId: 1,
      managerId: 1,
      reviewDate: new Date('2023-06-15'),
      metrics: [
        { category: 'Performance technique', weight: 0.4, score: 4, comments: 'Excellent travail technique' },
        { category: 'Communication', weight: 0.3, score: 3.5, comments: 'Bonne communication avec l\'équipe' },
        { category: 'Leadership', weight: 0.15, score: 4, comments: 'Montre de bonnes qualités de leader' },
        { category: 'Travail d\'équipe', weight: 0.15, score: 4.5, comments: 'Excellent esprit d\'équipe' }
      ],
      overallScore: 4.0,
      nextReviewDate: new Date('2023-12-15'),
      status: 'completed'
    }
  ];

  getEligibleEmployees(managerId: number): Observable<Employee[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const eligibleEmployees = this.mockEmployees.filter(emp => {
      if (!emp.lastReviewDate) return true;
      return new Date(emp.lastReviewDate) < sixMonthsAgo;
    });

    return of(eligibleEmployees).pipe(delay(500));
  }

  getEmployeeReviews(employeeId: number): Observable<PerformanceReview[]> {
    const reviews = this.mockReviews.filter(review => review.employeeId === employeeId);
    return of(reviews).pipe(delay(500));
  }

  isEligibleForReview(employeeId: number): Observable<boolean> {
    const employee = this.mockEmployees.find(emp => emp.id === employeeId);
    if (!employee) return of(false);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    if (!employee.lastReviewDate) return of(true);
    return of(new Date(employee.lastReviewDate) < sixMonthsAgo).pipe(delay(500));
  }

  saveReview(review: PerformanceReview): Observable<PerformanceReview> {
    // Simulate saving the review
    const newReview = {
      ...review,
      id: this.mockReviews.length + 1
    };
    this.mockReviews.push(newReview);

    // Update the employee's last review date
    const employee = this.mockEmployees.find(emp => emp.id === review.employeeId);
    if (employee) {
      employee.lastReviewDate = review.reviewDate;
    }

    return of(newReview).pipe(delay(1000));
  }
}
