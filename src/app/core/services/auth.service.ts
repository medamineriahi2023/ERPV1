import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { User, LoginRequest, LoginResponse } from '../interfaces/user.interface';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'currentUser';
  private currentUserSubject: BehaviorSubject<Omit<User, 'password'> | null>;
  public currentUser$: Observable<Omit<User, 'password'> | null>;

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {
    this.currentUserSubject = new BehaviorSubject<Omit<User, 'password'> | null>(null);
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    const storedUser = localStorage.getItem(this.STORAGE_KEY);
    if (storedUser) {
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
  }

  async login(credentials: LoginRequest): Promise<void> {
    const users = await firstValueFrom(this.apiService.getUsers());
    const user = users.find(
      u => u.username === credentials.username && u.password === credentials.password
    );

    if (!user) {
      throw new Error('Nom d\'utilisateur ou mot de passe incorrect');
    }

    const { password, ...userWithoutPassword } = user;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userWithoutPassword));
    this.currentUserSubject.next(userWithoutPassword);
    
    if (user.role === 'manager') {
      this.router.navigate(['/employees']);
    } else {
      this.router.navigate(['/pointage/dashboard']);
    }
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  getCurrentUser(): Omit<User, 'password'> | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  isManager(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser?.role === 'manager';
  }

  isEmployee(): boolean {
    const currentUser = this.getCurrentUser();
    return currentUser?.role === 'employee';
  }

  async getUserById(id: number): Promise<Omit<User, 'password'> | null> {
    try {
      const user = await firstValueFrom(this.apiService.getUserById(id));
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch {
      return null;
    }
  }

  async getManagedEmployees(forceRefresh: boolean = false): Promise<Omit<User, 'password'>[]> {
    const currentUser = forceRefresh ? 
      await firstValueFrom(this.apiService.getUserById(this.getCurrentUser()?.id || 0)) : 
      this.getCurrentUser();
      
    if (!currentUser || !this.isManager()) {
      return [];
    }

    const users = await firstValueFrom(this.apiService.getUsers());
    return users
      .filter(user => currentUser.managedEmployees.includes(user.id))
      .map(({ password, ...user }) => user);
  }

  async createUser(newUser: Omit<User, 'id'>): Promise<User> {
    const users = await firstValueFrom(this.apiService.getUsers());
    const maxId = Math.max(...users.map(u => u.id));
    
    const user: Omit<User, 'id'> = {
      ...newUser,
      managedEmployees: [],
      hireDate: new Date(),
      leaveBalance: {
        annual: 25,
        sick: 12
      },
      workSchedule: {
        startTime: '09:00',
        endTime: '17:00',
        lunchBreakDuration: 60
      },
      status: 'active',
      contractType: 'CDI'
    };

    // Create the user
    const createdUser = await firstValueFrom(this.apiService.createUser(user));

    // Update the manager's managedEmployees array if needed
    if (createdUser.managerId) {
      const manager = await firstValueFrom(this.apiService.getUserById(createdUser.managerId));
      if (manager) {
        const updatedManager = {
          ...manager,
          managedEmployees: [...manager.managedEmployees, createdUser.id]
        };
        await firstValueFrom(this.apiService.updateUser(manager.id, updatedManager));

        // Update current user if needed
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === manager.id) {
          const { password, ...managerWithoutPassword } = updatedManager;
          this.currentUserSubject.next(managerWithoutPassword);
        }
      }
    }

    return createdUser;
  }
}
