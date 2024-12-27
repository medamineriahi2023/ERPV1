import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TimeEntry } from '../interfaces/user.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PointageService {
  private readonly POINTAGE_KEY = 'timeEntries';
  private timeEntriesSubject: BehaviorSubject<TimeEntry[]>;

  constructor(private authService: AuthService) {
    const storedEntries = localStorage.getItem(this.POINTAGE_KEY);
    this.timeEntriesSubject = new BehaviorSubject<TimeEntry[]>(
      storedEntries ? JSON.parse(storedEntries) : []
    );
  }

  getTimeEntry(userId: number, date: Date = new Date()): TimeEntry | undefined {
    const targetDate = new Date(date);
    return this.timeEntriesSubject.value.find(entry => {
      const entryDate = new Date(entry.date);
      return entry.userId === userId &&
        entryDate.getDate() === targetDate.getDate() &&
        entryDate.getMonth() === targetDate.getMonth() &&
        entryDate.getFullYear() === targetDate.getFullYear();
    });
  }

  getMonthlyEntries(userId: number, month: number, year: number): TimeEntry[] {
    return this.timeEntriesSubject.value.filter(entry => {
      const entryDate = new Date(entry.date);
      return entry.userId === userId &&
        entryDate.getMonth() === month &&
        entryDate.getFullYear() === year;
    });
  }

  checkIn(userId: number): TimeEntry {
    const existingEntry = this.getTimeEntry(userId);
    if (existingEntry) {
      throw new Error('Already checked in for today');
    }

    const now = new Date();
    const newEntry: TimeEntry = {
      id: this.generateId(),
      userId,
      date: now,
      checkIn: this.formatTime(now),
      checkOut: '',
      totalHours: 0,
      status: 'incomplete'
    };

    const updatedEntries = [...this.timeEntriesSubject.value, newEntry];
    this.saveEntries(updatedEntries);
    return newEntry;
  }

  checkOut(userId: number): TimeEntry {
    const entry = this.getTimeEntry(userId);
    if (!entry) {
      throw new Error('No check-in found for today');
    }

    const now = new Date();
    const checkOutTime = this.formatTime(now);
    
    const updatedEntry: TimeEntry = {
      ...entry,
      checkOut: checkOutTime,
      totalHours: this.calculateTotalHours(entry.checkIn, checkOutTime, entry.lunchStart, entry.lunchEnd),
      status: 'complete'
    };

    this.updateEntry(updatedEntry);
    return updatedEntry;
  }

  startLunch(userId: number): TimeEntry {
    const entry = this.getTimeEntry(userId);
    if (!entry) {
      throw new Error('No check-in found for today');
    }

    if (entry.lunchStart) {
      throw new Error('Lunch break already started');
    }

    const now = new Date();
    const updatedEntry: TimeEntry = {
      ...entry,
      lunchStart: this.formatTime(now)
    };

    this.updateEntry(updatedEntry);
    return updatedEntry;
  }

  endLunch(userId: number): TimeEntry {
    const entry = this.getTimeEntry(userId);
    if (!entry) {
      throw new Error('No check-in found for today');
    }

    if (!entry.lunchStart) {
      throw new Error('Lunch break not started');
    }

    const now = new Date();
    const updatedEntry: TimeEntry = {
      ...entry,
      lunchEnd: this.formatTime(now)
    };

    this.updateEntry(updatedEntry);
    return updatedEntry;
  }

  getUserEntries(userId: number): Observable<TimeEntry[]> {
    return this.timeEntriesSubject.asObservable();
  }

  getTeamEntries(managerId: number): TimeEntry[] {
    const manager = this.authService.getCurrentUser();
    if (!manager || !manager.managedEmployees) return [];

    return this.timeEntriesSubject.value.filter(entry =>
      manager.managedEmployees.includes(entry.userId)
    );
  }

  getMonthlyStats(userId: number, month: number, year: number): {
    totalDays: number;
    totalHours: number;
    averageHours: number;
    lateArrivals: number;
  } {
    const entries = this.getMonthlyEntries(userId, month, year)
      .filter(entry => entry.status === 'complete');

    const totalHours = entries.reduce((sum, entry) => sum + entry.totalHours, 0);

    return {
      totalDays: entries.length,
      totalHours,
      averageHours: entries.length ? totalHours / entries.length : 0,
      lateArrivals: entries.filter(entry => this.isLateArrival(entry.checkIn)).length
    };
  }

  private getTodayEntry(userId: number): TimeEntry | undefined {
    const today = new Date();
    return this.timeEntriesSubject.value.find(entry => {
      const entryDate = new Date(entry.date);
      return entry.userId === userId &&
        entryDate.getDate() === today.getDate() &&
        entryDate.getMonth() === today.getMonth() &&
        entryDate.getFullYear() === today.getFullYear();
    });
  }

  private updateEntry(updatedEntry: TimeEntry): void {
    const currentEntries = this.timeEntriesSubject.value;
    const updatedEntries = currentEntries.map(entry =>
      entry.id === updatedEntry.id ? updatedEntry : entry
    );
    this.saveEntries(updatedEntries);
  }

  private calculateTotalHours(checkIn: string, checkOut: string, lunchStart?: string, lunchEnd?: string): number {
    const startTime = this.parseTime(checkIn);
    const endTime = this.parseTime(checkOut);
    let lunchDuration = 0;

    if (lunchStart && lunchEnd) {
      const lunchStartTime = this.parseTime(lunchStart);
      const lunchEndTime = this.parseTime(lunchEnd);
      lunchDuration = (lunchEndTime - lunchStartTime) / (1000 * 60 * 60);
    }

    const totalHours = (endTime - startTime) / (1000 * 60 * 60) - lunchDuration;
    return Math.round(totalHours * 100) / 100;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().split(' ')[0];
  }

  private parseTime(timeString: string): number {
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, seconds);
    return date.getTime();
  }

  private isLateArrival(checkIn: string): boolean {
    const [hours, minutes] = checkIn.split(':').map(Number);
    const user = this.authService.getCurrentUser();
    if (!user || !user.workSchedule) return false;

    const [scheduleHours, scheduleMinutes] = user.workSchedule.startTime.split(':').map(Number);
    return hours > scheduleHours || (hours === scheduleHours && minutes > scheduleMinutes + 15);
  }

  private generateId(): number {
    const entries = this.timeEntriesSubject.value;
    return entries.length ? Math.max(...entries.map(e => e.id)) + 1 : 1;
  }

  private saveEntries(entries: TimeEntry[]): void {
    localStorage.setItem(this.POINTAGE_KEY, JSON.stringify(entries));
    this.timeEntriesSubject.next(entries);
  }
}
