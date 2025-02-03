import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, LoginRequest, LoginResponse } from '../interfaces/user.interface';
import { LeaveRequest } from '../interfaces/leave-request.interface';
import { TimeEntry } from '../interfaces/time-entry.interface';
import { PerformanceReview } from '../interfaces/performance-review.interface';
import { Department } from '../interfaces/department.interface';
import { Position } from '../interfaces/position.interface';
import { Message } from '../interfaces/message.interface';
import { UserStatus } from './messaging.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_URL = 'https://erpbackend.duckdns.org:3000';

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

  updateUser(id: number, userData: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/users/${id}`, userData);
  }

  updateUserStatus(userId: number, status: UserStatus, lastActive: string): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/users/${userId}`, { status, lastActive });
  }

  getUsersByIds(ids: number[]): Observable<User[]> {
    const params = new HttpParams().set('ids', ids.join(','));
    return this.http.get<User[]>(`${this.API_URL}/users`, { params });
  }

  // Message endpoints
  getMessages(): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.API_URL}/messages`);
  }

  sendMessage(message: Message): Observable<Message> {
    return this.http.post<Message>(`${this.API_URL}/messages`, message);
  }

  updateMessage(messageId: string, updates: Partial<Message>): Observable<Message> {
    return this.http.patch<Message>(`${this.API_URL}/messages/${messageId}`, updates);
  }

  deleteMessage(messageId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/messages/${messageId}`);
  }
}
