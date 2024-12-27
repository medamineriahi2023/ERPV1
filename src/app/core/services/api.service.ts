import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../interfaces/user.interface';
import { LeaveRequest } from '../interfaces/leave-request.interface';
import { TimeEntry } from '../interfaces/time-entry.interface';
import { PerformanceReview } from '../interfaces/performance-review.interface';
import { Department } from '../interfaces/department.interface';
import { Position } from '../interfaces/position.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_URL = 'http://172.174.209.57:3000';

  constructor(private http: HttpClient) {}

  // Users endpoints
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.API_URL}/users`);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/users/${id}`);
  }

  createUser(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(`${this.API_URL}/users`, user);
  }

  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/users/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/users/${id}`);
  }

  // Leave Requests endpoints
  getLeaveRequests(): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.API_URL}/leaveRequests`);
  }

  getLeaveRequestsByUser(userId: number): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.API_URL}/leaveRequests?employeeId=${userId}`);
  }

  getLeaveRequestsForManager(managerId: number): Observable<LeaveRequest[]> {
    return this.http.get<LeaveRequest[]>(`${this.API_URL}/leaveRequests?managerId=${managerId}`);
  }

  getLeaveRequestById(id: number): Observable<LeaveRequest> {
    return this.http.get<LeaveRequest>(`${this.API_URL}/leaveRequests/${id}`);
  }

  createLeaveRequest(request: Omit<LeaveRequest, 'id'>): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`${this.API_URL}/leaveRequests`, request);
  }

  updateLeaveRequest(id: number, request: Partial<LeaveRequest>): Observable<LeaveRequest> {
    return this.http.patch<LeaveRequest>(`${this.API_URL}/leaveRequests/${id}`, request);
  }

  deleteLeaveRequest(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/leaveRequests/${id}`);
  }

  // Time Entries endpoints
  getTimeEntries(): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${this.API_URL}/timeEntries`);
  }

  getTimeEntriesByUser(userId: number): Observable<TimeEntry[]> {
    return this.http.get<TimeEntry[]>(`${this.API_URL}/timeEntries?employeeId=${userId}`);
  }

  getTimeEntryById(id: number): Observable<TimeEntry> {
    return this.http.get<TimeEntry>(`${this.API_URL}/timeEntries/${id}`);
  }

  createTimeEntry(entry: Omit<TimeEntry, 'id'>): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.API_URL}/timeEntries`, entry);
  }

  updateTimeEntry(id: number, entry: Partial<TimeEntry>): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(`${this.API_URL}/timeEntries/${id}`, entry);
  }

  deleteTimeEntry(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/timeEntries/${id}`);
  }

  // Performance Reviews endpoints
  getPerformanceReviews(): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.API_URL}/performanceReviews`);
  }

  getPerformanceReviewsByEmployee(employeeId: number): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.API_URL}/performanceReviews?employeeId=${employeeId}`);
  }

  getPerformanceReviewsByReviewer(reviewerId: number): Observable<PerformanceReview[]> {
    return this.http.get<PerformanceReview[]>(`${this.API_URL}/performanceReviews?reviewerId=${reviewerId}`);
  }

  getPerformanceReviewById(id: number): Observable<PerformanceReview> {
    return this.http.get<PerformanceReview>(`${this.API_URL}/performanceReviews/${id}`);
  }

  createPerformanceReview(review: Omit<PerformanceReview, 'id'>): Observable<PerformanceReview> {
    return this.http.post<PerformanceReview>(`${this.API_URL}/performanceReviews`, review);
  }

  updatePerformanceReview(id: number, review: Partial<PerformanceReview>): Observable<PerformanceReview> {
    return this.http.patch<PerformanceReview>(`${this.API_URL}/performanceReviews/${id}`, review);
  }

  deletePerformanceReview(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/performanceReviews/${id}`);
  }

  // Departments endpoints
  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.API_URL}/departments`);
  }

  getDepartmentById(id: number): Observable<Department> {
    return this.http.get<Department>(`${this.API_URL}/departments/${id}`);
  }

  createDepartment(department: Omit<Department, 'id'>): Observable<Department> {
    return this.http.post<Department>(`${this.API_URL}/departments`, department);
  }

  updateDepartment(id: number, department: Partial<Department>): Observable<Department> {
    return this.http.patch<Department>(`${this.API_URL}/departments/${id}`, department);
  }

  deleteDepartment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/departments/${id}`);
  }

  // Positions endpoints
  getPositions(): Observable<Position[]> {
    return this.http.get<Position[]>(`${this.API_URL}/positions`);
  }

  getPositionsByDepartment(departmentId: number): Observable<Position[]> {
    return this.http.get<Position[]>(`${this.API_URL}/positions?departmentId=${departmentId}`);
  }

  getPositionById(id: number): Observable<Position> {
    return this.http.get<Position>(`${this.API_URL}/positions/${id}`);
  }

  createPosition(position: Omit<Position, 'id'>): Observable<Position> {
    return this.http.post<Position>(`${this.API_URL}/positions`, position);
  }

  updatePosition(id: number, position: Partial<Position>): Observable<Position> {
    return this.http.patch<Position>(`${this.API_URL}/positions/${id}`, position);
  }

  deletePosition(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/positions/${id}`);
  }
}
