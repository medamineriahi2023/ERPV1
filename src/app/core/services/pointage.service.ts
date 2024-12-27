import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TimeEntry } from '../interfaces/user.interface';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PointageService {
  private apiUrl = `${environment.apiUrl}/time-entries`;

  constructor(private http: HttpClient) {}

  getActiveSession(userId: number): Observable<TimeEntry | null> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?userId=${userId}&date_gte=${startOfDay}&date_lte=${endOfDay}&checkOut=null`
    ).pipe(
      map(entries => {
        if (entries.length === 0) return null;
        const entry = entries[0];
        return {
          ...entry,
          date: entry.date ? new Date(entry.date) : new Date()
        };
      })
    );
  }

  getTimeEntry(userId: number, date: Date = new Date()): Observable<TimeEntry | null> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString();

    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?userId=${userId}&date_gte=${startOfDay}&date_lte=${endOfDay}`
    ).pipe(
      map(entries => {
        if (entries.length === 0) return null;
        const entry = entries[0];
        return {
          ...entry,
          date: entry.date ? new Date(entry.date) : new Date()
        };
      })
    );
  }

  getMonthlyEntries(userId: number, month: number, year: number): Observable<TimeEntry[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);
    
    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?userId=${userId}&date_gte=${startDate.toISOString()}&date_lte=${endDate.toISOString()}&_sort=date&_order=desc`
    ).pipe(
      map(entries => entries.map(entry => ({
        ...entry,
        date: entry.date ? new Date(entry.date) : new Date()
      })))
    );
  }

  getTeamEntries(userIds: number[]): Observable<TimeEntry[]> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Construire la requête pour tous les utilisateurs
    const userQuery = userIds.map(id => `userId=${id}`).join('&');
    
    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?${userQuery}&date_gte=${startOfMonth}&date_lte=${endOfMonth}&_sort=date&_order=desc`
    ).pipe(
      map(entries => entries.map(entry => ({
        ...entry,
        date: entry.date ? new Date(entry.date) : new Date()
      })))
    );
  }

  getTeamActiveEntries(userIds: number[]): Observable<TimeEntry[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    // Construire la requête pour tous les utilisateurs
    const userQuery = userIds.map(id => `userId=${id}`).join('&');
    
    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?${userQuery}&date_gte=${startOfDay}&date_lte=${endOfDay}`
    ).pipe(
      map(entries => entries.map(entry => ({
        ...entry,
        date: entry.date ? new Date(entry.date) : new Date()
      })))
    );
  }

  checkIn(userId: number): Observable<TimeEntry> {
    const now = new Date();
    const workStartTime = new Date();
    workStartTime.setHours(9, 0, 0, 0);
    
    const entry = {
      userId,
      date: now,
      checkIn: this.formatTime(now),
      checkOut: null,
      lunchStart: null,
      lunchEnd: null,
      totalHours: 0,
      status: now > workStartTime ? 'late' : 'present',
      isLate: now > workStartTime
    } as TimeEntry;

    return this.http.post<TimeEntry>(this.apiUrl, {
      ...entry,
      date: entry.date.toISOString()
    }).pipe(
      map(response => ({
        ...response,
        date: response.date ? new Date(response.date) : new Date()
      }))
    );
  }

  checkOut(entryId: number): Observable<TimeEntry> {
    const now = new Date();
    return this.http.patch<TimeEntry>(`${this.apiUrl}/${entryId}`, {
      checkOut: this.formatTime(now),
      totalHours: this.calculateTotalHours(entryId, now)
    }).pipe(
      map(response => ({
        ...response,
        date: response.date ? new Date(response.date) : new Date()
      }))
    );
  }

  startLunch(entryId: number): Observable<TimeEntry> {
    const now = new Date();
    return this.http.patch<TimeEntry>(`${this.apiUrl}/${entryId}`, {
      lunchStart: this.formatTime(now)
    }).pipe(
      map(response => ({
        ...response,
        date: response.date ? new Date(response.date) : new Date()
      }))
    );
  }

  endLunch(entryId: number): Observable<TimeEntry> {
    const now = new Date();
    return this.http.patch<TimeEntry>(`${this.apiUrl}/${entryId}`, {
      lunchEnd: this.formatTime(now)
    }).pipe(
      map(response => ({
        ...response,
        date: response.date ? new Date(response.date) : new Date()
      }))
    );
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }

  private calculateTotalHours(entryId: number, checkOutTime: Date): number {
    return 8; // À améliorer avec un vrai calcul
  }
}
