import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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
      `${this.apiUrl}?${userQuery}&date_gte=${startOfDay}&date_lte=${endOfDay}&status_in=leave,holiday`
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
    return this.http.get<TimeEntry>(`${this.apiUrl}/${entryId}`).pipe(
      switchMap(entry => {
        const now = new Date();
        const checkOutTime = this.formatTime(now);
        
        // Update entry with checkout time
        entry.checkOut = checkOutTime;
        
        // Calculate total hours
        const updatedEntry = { ...entry, checkOut: checkOutTime };
        const totalHours = this.calculateWorkingHours(updatedEntry);

        // Update entry in database
        return this.http.patch<TimeEntry>(`${this.apiUrl}/${entryId}`, {
          checkOut: checkOutTime,
          totalHours: totalHours
        });
      }),
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

  updateTimeEntry(id: number, entry: Partial<TimeEntry>): Observable<TimeEntry> {
    return this.http.patch<TimeEntry>(`${this.apiUrl}/${id}`, entry);
  }

  createTimeEntry(entry: Partial<TimeEntry>): Observable<TimeEntry> {
    return this.http.post<TimeEntry>(`${this.apiUrl}`, entry);
  }

  getTimeEntriesByDate(date: Date): Observable<TimeEntry[]> {
    const formattedDate = date.toISOString().split('T')[0];
    return this.http.get<TimeEntry[]>(`${this.apiUrl}?date=${formattedDate}`);
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }

  private calculateWorkingHours(entry: TimeEntry): number {
    if (!entry.checkIn || !entry.checkOut) return 0;

    // Convert time strings to Date objects for the same day (to avoid date issues)
    const baseDate = '2000-01-01T';
    const checkIn = new Date(baseDate + entry.checkIn);
    const checkOut = new Date(baseDate + entry.checkOut);
    
    // Calculate total duration in milliseconds
    let totalMilliseconds = checkOut.getTime() - checkIn.getTime();
    
    // If total milliseconds is negative or zero, return 0
    if (totalMilliseconds <= 0) return 0;

    // Subtract lunch break if taken
    if (entry.lunchStart && entry.lunchEnd) {
      const lunchStart = new Date(baseDate + entry.lunchStart);
      const lunchEnd = new Date(baseDate + entry.lunchEnd);
      
      // Verify lunch break times are valid
      if (lunchEnd.getTime() > lunchStart.getTime()) {
        const lunchDuration = lunchEnd.getTime() - lunchStart.getTime();
        totalMilliseconds -= lunchDuration;
      }
    }
    
    // Convert to hours and round to 2 decimal places
    const hours = totalMilliseconds / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  }

  private getWorkStatus(entry: TimeEntry): string {
    if (!entry.checkIn) return 'absent';
    
    const checkInTime = new Date(`2000-01-01T${entry.checkIn}`);
    const workStartTime = new Date(`2000-01-01T09:00:00`); // 9 AM
    
    if (checkInTime > workStartTime) {
      return 'late';
    }
    
    return 'present';
  }
  getWeeklyStats(userId: number): Observable<any> {
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekEnd = new Date(today.setDate(today.getDate() + 6));

    return this.http.get<TimeEntry[]>(
      `${this.apiUrl}?userId=${userId}&date_gte=${weekStart.toISOString()}&date_lte=${weekEnd.toISOString()}`
    ).pipe(
      map(entries => {
        const stats = {
          totalHours: 0,
          averageHours: 0,
          daysPresent: 0,
          daysLate: 0,
          averageArrivalTime: 0
        };

        if (entries.length === 0) return stats;

        let totalArrivalMinutes = 0;
        entries.forEach(entry => {
          if (entry.totalHours) stats.totalHours += entry.totalHours;
          if (entry.status === 'present') stats.daysPresent++;
          if (entry.status === 'late') stats.daysLate++;
          
          if (entry.checkIn) {
            const [hours, minutes] = entry.checkIn.split(':').map(Number);
            totalArrivalMinutes += hours * 60 + minutes;
          }
        });

        stats.averageHours = stats.totalHours / entries.length;
        stats.averageArrivalTime = totalArrivalMinutes / entries.length;

        return stats;
      })
    );
  }

  getMonthlyStats(userId: number, month: number, year: number): Observable<any> {
    return this.getMonthlyEntries(userId, month, year).pipe(
      map(entries => {
        const stats = {
          totalDays: entries.length,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          totalHours: 0,
          averageHours: 0,
          averageBreakTime: 0
        };

        let totalBreakMinutes = 0;
        let entriesWithBreak = 0;

        entries.forEach(entry => {
          if (entry.status === 'present') stats.presentDays++;
          else if (entry.status === 'late') stats.lateDays++;
          else if (entry.status === 'absent') stats.absentDays++;

          if (entry.totalHours) stats.totalHours += entry.totalHours;

          if (entry.lunchStart && entry.lunchEnd) {
            const lunchStart = new Date(`2000-01-01T${entry.lunchStart}`);
            const lunchEnd = new Date(`2000-01-01T${entry.lunchEnd}`);
            const breakMinutes = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
            totalBreakMinutes += breakMinutes;
            entriesWithBreak++;
          }
        });

        stats.averageHours = stats.totalHours / (stats.presentDays + stats.lateDays);
        stats.averageBreakTime = entriesWithBreak > 0 ? totalBreakMinutes / entriesWithBreak : 0;

        return stats;
      })
    );
  }
}
