import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  private readonly API_URL = 'http://localhost:3000';

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

  getUsersByIds(ids: number[]): Observable<User[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<User[]>(`${this.API_URL}/users`, { params });
  }

}
