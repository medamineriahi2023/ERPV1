// noinspection JSUnusedGlobalSymbols

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, delay } from 'rxjs/operators';

export interface CongeRequest {
  id: number;
  employeeId: number;
  managerId: number;
  type: string | {
    label: string;
    value: string;
    icon: string;
    color: string;
  };
  startDate: string;
  endDate: string;
  duration: number;
  status: 'APPROUVE' | 'REFUSE' | 'EN_ATTENTE';
  reason: string;
  createdAt: string;
  updatedAt: string;
  urgencyLevel: string | {
    label: string;
    value: string;
    icon: string;
  };
  impactOnTraining?: boolean;
  trainingAdjustments?: {
    trainingId: number;
    newEndDate: string;
    currentProgress: number;
  }[];
  attachments?: string[];
  approverComment?: string;
}

export interface CongeBalance {
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  sickDays: number;
  trainingDays: number;
  upcomingRequests: number;
}

// noinspection JSUnusedGlobalSymbols
@Injectable({
  providedIn: 'root'
})
export class CongeService {
  private apiUrl = 'http://localhost:3000/conges';

  constructor(private http: HttpClient) {}

  getCongeRequests(): Observable<CongeRequest[]> {
    return this.http.get<CongeRequest[]>(this.apiUrl).pipe(
      map(conges => conges.map(conge => ({
        ...conge,
        startDate: conge.startDate,
        endDate: conge.endDate,
        createdAt: conge.createdAt,
        updatedAt: conge.updatedAt
      }))),
      catchError(error => {
        console.error('Error fetching conge requests:', error);
        return of([]);
      })
    );
  }

  getCongeRequest(id: number): Observable<CongeRequest | undefined> {
    return this.http.get<CongeRequest>(`${this.apiUrl}/${id}`).pipe(
      map(conge => ({
        ...conge,
        startDate: conge.startDate,
        endDate: conge.endDate,
        createdAt: conge.createdAt,
        updatedAt: conge.updatedAt
      })),
      catchError(error => {
        console.error(`Error fetching conge request ${id}:`, error);
        return of(undefined);
      })
    );
  }

  createCongeRequest(request: Partial<CongeRequest>): Observable<CongeRequest> {
    const newRequest = {
      ...request,
      id: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.http.post<CongeRequest>(this.apiUrl, newRequest).pipe(
      map(conge => ({
        ...conge,
        startDate: conge.startDate,
        endDate: conge.endDate,
        createdAt: conge.createdAt,
        updatedAt: conge.updatedAt
      })),
      catchError(error => {
        console.error('Error creating conge request:', error);
        throw error;
      })
    );
  }

  updateCongeRequest(id: number, updates: Partial<CongeRequest>): Observable<CongeRequest> {
    const updatedRequest = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return this.http.patch<CongeRequest>(`${this.apiUrl}/${id}`, updatedRequest).pipe(
      map(conge => ({
        ...conge,
        startDate: conge.startDate,
        endDate: conge.endDate,
        createdAt: conge.createdAt,
        updatedAt: conge.updatedAt
      })),
      catchError(error => {
        console.error(`Error updating conge request ${id}:`, error);
        throw error;
      })
    );
  }

  getCongeBalance(employeeId: number): Observable<CongeBalance> {
    return this.getCongeRequests().pipe(
      map(conges => {
        const usedDays = conges
          .filter(c => c.status === 'APPROUVE' && c.employeeId === employeeId)
          .reduce((sum, c) => sum + c.duration, 0);

        return {
          totalDays: 30, // Default values, you might want to get these from user data
          usedDays,
          remainingDays: 30 - usedDays,
          sickDays: 15,
          trainingDays: 10,
          upcomingRequests: conges.filter(c => c.status === 'EN_ATTENTE' && c.employeeId === employeeId).length
        };
      })
    );
  }

  getPublicHolidays(year: number): Observable<Date[]> {
    const holidays = [
      new Date(`${year}-01-01`), // New Year's Day
      new Date(`${year}-01-11`), // Independence Manifesto Day
      new Date(`${year}-05-01`), // Labor Day
      new Date(`${year}-07-30`), // Throne Day
      new Date(`${year}-08-14`), // Oued Ed-Dahab Day
      new Date(`${year}-08-20`), // Revolution Day
      new Date(`${year}-08-21`), // Youth Day
      new Date(`${year}-11-06`), // Green March
      new Date(`${year}-11-18`)  // Independence Day
    ];
    return of(holidays).pipe(
      catchError(error => {
        console.error('Error fetching public holidays:', error);
        return of([]);
      })
    );
  }
}
