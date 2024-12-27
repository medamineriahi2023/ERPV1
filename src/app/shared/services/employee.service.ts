import { Injectable } from '@angular/core';
import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  position: string;
  department: string;
  joinDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  contractType: string;
  avatar: string;
  skills: string[];
  salary: {
    base: number;
    bonus: number;
    lastReview: string;
  };
  performanceRating: number;
  role: 'manager' | 'employee';
  username: string;
  password: string;
  managerId: number | null;
  managedEmployees: number[];
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
  birthDate: string;
  address: string;
  position: string;
  department: string;
  joinDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  contractType: string;
  avatar: string;
  skills: string[];
  salary: {
    base: number;
    bonus: number;
    lastReview: string;
  };
  performanceRating: number;
  role: 'manager' | 'employee';
  username: string;
  password: string;
  managerId: number | null;
  managedEmployees: number[];
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeService {
  private mockEmployees: Employee[] = [
    {
      id: 1,
      firstName: 'Sarah',
      lastName: 'Martin',
      email: 'sarah.martin@company.com',
      phone: '+212 6XX-XXXXXX',
      birthDate: '1990-01-01',
      address: '123 Main St',
      position: 'Senior Developer',
      department: 'Engineering',
      joinDate: '2022-03-15',
      status: 'ACTIVE',
      contractType: 'CDI',
      avatar: 'https://example.com/avatar.jpg',
      skills: ['Angular', 'TypeScript', 'Node.js'],
      salary: {
        base: 45000,
        bonus: 5000,
        lastReview: '2023-12-01'
      },
      performanceRating: 4.5,
      role: 'employee',
      username: 'sarah',
      password: 'password',
      managerId: null,
      managedEmployees: []
    },
    {
      id: 2,
      firstName: 'Mohammed',
      lastName: 'Alami',
      email: 'mohammed.alami@company.com',
      phone: '+212 6XX-XXXXXX',
      birthDate: '1992-01-01',
      address: '456 Elm St',
      position: 'Product Manager',
      department: 'Product',
      joinDate: '2021-06-01',
      status: 'ACTIVE',
      contractType: 'CDI',
      avatar: '',
      skills: ['Product Strategy', 'Agile', 'User Research'],
      salary: {
        base: 52000,
        bonus: 8000,
        lastReview: '2023-11-15'
      },
      performanceRating: 4.8,
      role: 'manager',
      username: 'mohammed',
      password: 'password',
      managerId: null,
      managedEmployees: [1]
    }
  ];

  private refreshNeededSource = new Subject<void>();
  refreshNeeded$ = this.refreshNeededSource.asObservable();

  constructor() {}

  refreshEmployeeList() {
    this.refreshNeededSource.next();
  }

  getEmployees(): Observable<Employee[]> {
    return of(this.mockEmployees).pipe(delay(100));
  }

  getEmployee(id: number): Observable<Employee | undefined> {
    const employee = this.mockEmployees.find(e => e.id === id);
    return of(employee).pipe(delay(100));
  }

  createEmployee(employeeDto: CreateEmployeeDto): Observable<Employee> {
    const newEmployee: Employee = {
      id: Math.max(...this.mockEmployees.map(e => e.id)) + 1,
      ...employeeDto
    };
    this.mockEmployees.push(newEmployee);
    return of(newEmployee).pipe(delay(100));
  }

  updateEmployee(id: number, updates: Partial<Employee>): Observable<Employee> {
    const index = this.mockEmployees.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Employee not found');

    this.mockEmployees[index] = { ...this.mockEmployees[index], ...updates };
    return of(this.mockEmployees[index]).pipe(delay(100));
  }

  deleteEmployee(id: number): Observable<void> {
    const index = this.mockEmployees.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Employee not found');

    this.mockEmployees.splice(index, 1);
    return of(void 0).pipe(delay(100));
  }

  getEmployeeLeaveRequests(employeeId: number): Observable<LeaveRequest[]> {
    return of([]).pipe(delay(100));
  }

  createLeaveRequest(request: Omit<LeaveRequest, 'id'>): Observable<LeaveRequest> {
    const newRequest: LeaveRequest = {
      id: Math.floor(Math.random() * 1000) + 1,
      ...request
    };
    return of(newRequest).pipe(delay(100));
  }

  getEmployeeTimeEntries(employeeId: number): Observable<TimeEntry[]> {
    return of([]).pipe(delay(100));
  }

  getDepartments(): Observable<Department[]> {
    return of([]).pipe(delay(100));
  }

  getPositions(): Observable<Position[]> {
    return of([]).pipe(delay(100));
  }

  getEmployeeStats(): Observable<EmployeeStats> {
    return of({
      totalEmployees: this.mockEmployees.length,
      activeEmployees: this.mockEmployees.filter(e => e.status === 'ACTIVE').length,
      onLeave: this.mockEmployees.filter(e => e.status === 'ON_LEAVE').length,
      departmentDistribution: {},
      contractTypeDistribution: {},
      averagePerformance: 0
    }).pipe(delay(100));
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
