import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Employee {
  id?: number;
  avatar?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: Date;
  gender: string;
  address: string;
  city: string;
  country: string;
  position: string;
  department: string;
  joinDate: Date;
  salary: {
    base: number;
    bonus: number;
    lastReview: Date;
  };
  status: string;
  contractType: string;
  skills: string[];
  workSchedule: WorkSchedule;
  performanceRating: number;
  photoUrl?: string;
}

export interface WorkSchedule {
  startTime: string;
  endTime: string;
  lunchBreakDuration: number;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  type: string | {
    label: string;
    value: string;
    icon: string;
    color: string;
  };
  reason: string;
  status: 'APPROUVE' | 'REFUSE' | 'EN_ATTENTE';
  createdAt: string;
  updatedAt: string;
  urgencyLevel: string | {
    label: string;
    value: string;
    icon: string;
  };
  duration: number;
  approverComment?: string;
  impactOnTraining?: boolean;
  trainingAdjustments?: {
    trainingId: number;
    newEndDate: string;
    currentProgress: number;
  }[];
  attachments?: string[];
}

export interface TimeEntry {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string;
  totalHours: number;
  status: string;
}

export interface Department {
  id: number;
  name: string;
  description: string;
}

export interface Position {
  id: number;
  name: string;
  department: string;
  level: string;
}

export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: Date;
  gender: string;
  address: string;
  city: string;
  country: string;
  position: string;
  department: string;
  joinDate: Date;
  salary: {
    base: number;
    bonus: number;
    lastReview: Date;
  };
  status: string;
  contractType: string;
  skills: string[];
  workSchedule: WorkSchedule;
  performanceRating: number;
  photoUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private apiUrl = `${environment.apiUrl}/employees`;
  private refreshNeededSource = new Subject<void>();
  refreshNeeded$ = this.refreshNeededSource.asObservable();

  constructor(private http: HttpClient) {}

  refreshEmployeeList() {
    this.refreshNeededSource.next();
  }

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(this.apiUrl);
  }

  getEmployee(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/${id}`);
  }

  createEmployee(employeeDto: CreateEmployeeDto): Observable<Employee> {
    return this.http.post<Employee>(this.apiUrl, employeeDto)
      .pipe(
        tap(() => {
          this.refreshEmployeeList();
        })
      );
  }

  updateEmployee(id: number, employeeDto: Partial<Employee>): Observable<Employee> {
    return this.http.put<Employee>(`${this.apiUrl}/${id}`, employeeDto)
      .pipe(
        tap(() => {
          this.refreshEmployeeList();
        })
      );
  }

  deleteEmployee(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
      .pipe(
        tap(() => {
          this.refreshEmployeeList();
        })
      );
  }

  getEmployeeStats(): Observable<EmployeeStats> {
    return this.http.get<EmployeeStats>(`${this.apiUrl}/stats`);
  }
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  departmentDistribution: { [key: string]: number };
  contractTypeDistribution: { [key: string]: number };
  averagePerformance: number;
}
