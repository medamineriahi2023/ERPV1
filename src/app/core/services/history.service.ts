import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, throwError, switchMap } from 'rxjs';
import { UserHistoryStats, UserTimeEntry, MonthlyStats, CalendarDay } from '../interfaces/history.interface';
import { PointageService } from './pointage.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly apiUrl = `${environment.apiUrl}/time-entries`;
  private readonly workStartHour = 9; // Heure de début standard
  private readonly workEndHour = 17;  // Heure de fin standard
  private readonly expectedWorkHours = 8; // Heures de travail attendues

  constructor(
    private http: HttpClient,
    private pointageService: PointageService,
    private authService: AuthService
  ) {}

  /**
   * Récupère l'historique mensuel de l'utilisateur connecté
   */
  getUserMonthlyHistory(month: number, year: number): Observable<MonthlyStats> {
    return this.authService.currentUser$.pipe(
      map(user => {
        if (!user) throw new Error('Utilisateur non connecté');
        return user.id;
      }),
      switchMap(userId => this.fetchMonthlyData(userId, month, year))
    ).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de l\'historique:', error);
        return throwError(() => new Error('Impossible de charger l\'historique'));
      })
    );
  }

  /**
   * Récupère les données mensuelles depuis l'API
   */
  private fetchMonthlyData(userId: number, month: number, year: number): Observable<MonthlyStats> {
    const { startDate, endDate } = this.getMonthDateRange(month, year);

    return this.http.get<UserTimeEntry[]>(
      `${this.apiUrl}?userId=${userId}&date_gte=${startDate.toISOString()}&date_lte=${endDate.toISOString()}&_sort=date&_order=desc`
    ).pipe(
      map(entries => this.processMonthlyData(entries, month, year))
    );
  }

  /**
   * Traite les données mensuelles
   */
  private processMonthlyData(entries: UserTimeEntry[], month: number, year: number): MonthlyStats {
    console.log('Entrées brutes:', entries);
    const processedEntries = entries.map(entry => {
      const processed = this.processTimeEntry(entry);
      console.log('Entrée traitée:', processed);
      return processed;
    });
    const stats = this.calculateMonthlyStats(processedEntries, month, year);
    console.log('Statistiques calculées:', stats);

    return {
      month,
      year,
      entries: processedEntries,
      stats
    };
  }

  /**
   * Traite une entrée de pointage
   */
  private processTimeEntry(entry: UserTimeEntry): UserTimeEntry {
    const entryDate = new Date(entry.date);
    const checkInDate = entry.checkIn ? this.parseTimeString(entryDate, entry.checkIn) : null;
    const checkOutDate = entry.checkOut ? this.parseTimeString(entryDate, entry.checkOut) : null;

    const duration = this.calculateDuration(checkInDate, checkOutDate);
    const lateMinutes = this.calculateLateMinutes(checkInDate);
    const status = this.determineStatus(checkInDate, checkOutDate, duration);

    return {
      ...entry,
      duration,
      lateMinutes,
      status,
      isComplete: !!checkOutDate
    };
  }

  /**
   * Calcule les statistiques mensuelles
   */
  private calculateMonthlyStats(entries: UserTimeEntry[], month: number, year: number): UserHistoryStats {
    const workDays = this.getWorkDaysInMonth(month, year);
    
    // Compte les jours où l'employé a pointé (présent ou en retard)
    const presentDays = entries.filter(entry => 
      entry.checkIn && entry.checkOut && 
      (entry.status === 'present' || entry.status === 'late')
    ).length;
    
    const lateEntries = entries.filter(e => e.status === 'late');
    const totalHours = entries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const averageArrivalTime = this.calculateAverageTime(entries.map(e => e.checkIn));
    const averageDepartureTime = this.calculateAverageTime(entries.map(e => e.checkOut));

    return {
      totalDays: entries.length,
      totalWorkDays: workDays,
      totalHours,
      presentDays,
      absentDays: workDays - presentDays,
      lateCount: lateEntries.length,
      onTimeCount: entries.filter(e => e.status === 'present').length,
      leaveCount: entries.filter(e => e.status === 'leave').length,
      averageArrivalTime,
      averageDepartureTime,
      punctualityRate: (presentDays / workDays) * 100
    };
  }

  /**
   * Génère les données du calendrier
   */
  getCalendarData(month: number, year: number, entries: UserTimeEntry[]): Observable<CalendarDay[]> {
    const { startDate, endDate } = this.getMonthDateRange(month, year);
    const today = new Date();
    const calendarDays: CalendarDay[] = [];

    // Remplir le calendrier
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const entry = entries.find(e => 
        new Date(e.date).toDateString() === currentDate.toDateString()
      );

      calendarDays.push({
        date: new Date(currentDate),
        status: entry?.status,
        entry,
        isToday: this.isSameDay(currentDate, today),
        isCurrentMonth: currentDate.getMonth() === month
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return of(calendarDays);
  }

  /**
   * Utilitaires
   */
  private getMonthDateRange(month: number, year: number) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return { startDate, endDate };
  }

  private parseTimeString(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  private calculateDuration(checkIn: Date | null, checkOut: Date | null): number {
    if (!checkIn || !checkOut) return 0;
    
    let duration = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    
    // Si la durée est négative (passage à minuit), ajouter 24h
    if (duration < 0) {
      duration += 24;
    }
    
    return Number(duration.toFixed(2));
  }

  private calculateLateMinutes(checkIn: Date | null): number {
    if (!checkIn) return 0;
    
    const expectedStart = new Date(checkIn);
    expectedStart.setHours(this.workStartHour, 0, 0);
    
    return checkIn > expectedStart ? 
      (checkIn.getTime() - expectedStart.getTime()) / (1000 * 60) : 
      0;
  }

  private determineStatus(
    checkIn: Date | null, 
    checkOut: Date | null, 
    duration: number
  ): UserTimeEntry['status'] {
    if (!checkIn && !checkOut) return 'absent';
    if (!checkOut) return 'present'; // En cours
    
    const lateMinutes = this.calculateLateMinutes(checkIn);
    
    // Si l'employé est présent, même en retard, on compte le jour
    if (checkIn && checkOut) {
      return lateMinutes > 15 ? 'late' : 'present';
    }
    
    return 'absent';
  }

  private getWorkDaysInMonth(month: number, year: number): number {
    const { startDate, endDate } = this.getMonthDateRange(month, year);
    let workDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) workDays++; // Exclure samedi (6) et dimanche (0)
      current.setDate(current.getDate() + 1);
    }
    
    return workDays;
  }

  private calculateAverageTime(times: (string | undefined | null)[]): string {
    const validTimes = times.filter((time): time is string => !!time);
    if (validTimes.length === 0) return '--:--';

    const totalMinutes = validTimes.reduce((sum, time) => {
      const [hours, minutes] = time.split(':').map(Number);
      return sum + hours * 60 + minutes;
    }, 0);

    const averageMinutes = Math.round(totalMinutes / validTimes.length);
    const hours = Math.floor(averageMinutes / 60);
    const minutes = averageMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }
}
