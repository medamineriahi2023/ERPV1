import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { TimeEntry, User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';
import { PointageService } from '@app/core/services/pointage.service';
import { ApiService } from '@app/core/services/api.service';
import { MessageService } from 'primeng/api';
import {interval, Subscription, forkJoin, firstValueFrom, Subject, finalize} from 'rxjs';
import { startWith, map, takeUntil } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartData } from 'chart.js/auto';

interface TimeEntryWithUser {
  id?: number;
  userId: number;
  date: Date;
  checkIn?: string;
  checkOut?: string;
  lunchStart?: string;
  lunchEnd?: string;
  totalHours: number;
  isLate?: boolean;
  minutesLate?: number;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  leaveStatus?: 'approved' | 'pending' | 'rejected';
  user?: Omit<User, 'password'>;
}

type ChartType = 'weekly' | 'status' | 'punctuality';

@Component({
  selector: 'app-team-pointage',
  templateUrl: './team-pointage.component.html',
  styleUrls: ['./team-pointage.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    InputTextModule,
    DropdownModule,
    ToastModule
  ],
  providers: [MessageService]
})
export class TeamPointageComponent implements OnInit, AfterViewInit, OnDestroy {
  currentTime: Date = new Date();
  selectedDate: Date = new Date();
  teamEntries: TimeEntryWithUser[] = [];
  filteredEntries: TimeEntryWithUser[] = [];
  selectedDateDetails: TimeEntryWithUser | null = null;
  monthlyHistory: TimeEntryWithUser[] = [];
  monthlyEntries: TimeEntryWithUser[] = [];
  currentUser: any;
  users: any[] = [];
  managedUsers: any[] = []; 
  searchTerm: string = '';
  selectedStatus: string = '';
  private refreshInterval: Subscription | null = null;
  private charts: Record<ChartType, Chart | null> = {
    weekly: null,
    status: null,
    punctuality: null
  };
  private destroy$ = new Subject<void>();
  loading = false;

  selectedPeriod: 'month' | 'year' = 'month';
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth();

  months = [
    { value: 0, label: 'Janvier' },
    { value: 1, label: 'Février' },
    { value: 2, label: 'Mars' },
    { value: 3, label: 'Avril' },
    { value: 4, label: 'Mai' },
    { value: 5, label: 'Juin' },
    { value: 6, label: 'Juillet' },
    { value: 7, label: 'Août' },
    { value: 8, label: 'Septembre' },
    { value: 9, label: 'Octobre' },
    { value: 10, label: 'Novembre' },
    { value: 11, label: 'Décembre' }
  ];

  yearOptions = Array.from({ length: 5 }, (_, i) => ({
    label: (new Date().getFullYear() - i).toString(),
    value: new Date().getFullYear() - i
  }));

  statusOptions = [
    { label: 'Tous les statuts', value: '' },
    { label: 'Présent', value: 'present' },
    { label: 'Absent', value: 'absent' },
    { label: 'En congé', value: 'leave' },
    { label: 'En congé férié', value: 'holiday' },
    { label: 'En retard', value: 'late' }
  ];

  weeklyAttendanceData: ChartConfiguration['data'] = {
    labels: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0],
        label: 'Présents',
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)'
      },
      {
        data: [0, 0, 0, 0, 0],
        label: 'Retards',
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)'
      },
      {
        data: [0, 0, 0, 0, 0],
        label: 'Absents',
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)'
      }
    ]
  };

  statusDistributionData: ChartData = {
    labels: ['Présents', 'Retards', 'Absents', 'En congé'],
    datasets: [{
      data: [0, 0, 0, 0],
      backgroundColor: ['#4CAF50', '#FFC107', '#F44336', '#2196F3']
    }]
  };

  punctualityTrendData: ChartConfiguration['data'] = {
    labels: ['0-15 min', '15-30 min', '30+ min'],
    datasets: [{
      data: [0, 0, 0],
      backgroundColor: ['#FFB1C1', '#FFD1C1', '#FFE1C1']
    }]
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' }
    }
  };

  private punctualityTrendChart: Chart | null = null;
  private absenceForecastChart: Chart | null = null;
  private workingHoursChart: Chart | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private pointageService: PointageService,
    private messageService: MessageService
  ) {
    this.charts = {
      weekly: null,
      status: null,
      punctuality: null
    };
  }

  ngOnInit() {
    this.loadCurrentUser();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCurrentUser() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser?.managedEmployees?.length) {
      // Charger les détails de tous les utilisateurs gérés
      this.apiService.getUsers().subscribe(
        (allUsers) => {
          // Filtrer pour n'avoir que les utilisateurs gérés
          this.managedUsers = allUsers.filter(user => 
            this.currentUser?.managedEmployees.includes(user.id)
          );
          this.users = this.managedUsers;
          this.loadTeamEntries();
        },
        (error) => {
          console.error('Erreur lors du chargement des utilisateurs:', error);
        }
      );
    }
  }

  getEmployeeFullName(entry: TimeEntryWithUser): string {
    if (entry.user) {
      return `${entry.user.firstName} ${entry.user.lastName}`;
    }

    // Si l'utilisateur n'est pas dans l'entrée, chercher dans managedUsers
    const user = this.managedUsers.find(u => u.id === entry.userId);
    if (user) {
      return `${user.firstName} ${user.lastName}`;
    }

    return 'Utilisateur inconnu';
  }

  private getUserName(userId: number): string {
    // Chercher d'abord dans managedUsers
    const user = this.managedUsers.find(u => u.id === userId);
    if (user) {
      return `${user.firstName} ${user.lastName}`;
    }
    
    // Si non trouvé, chercher dans les entrées
    const entry = this.monthlyEntries.find(e => e.userId === userId && e.user);
    if (entry?.user) {
      return `${entry.user.firstName} ${entry.user.lastName}`;
    }
    
    // Si toujours pas trouvé, retourner un message plus descriptif
    return `Utilisateur ${userId}`;
  }

  private initializeCharts() {
    const weeklyCtx = document.getElementById('weeklyChart') as HTMLCanvasElement;
    const statusCtx = document.getElementById('statusChart') as HTMLCanvasElement;
    const punctualityCtx = document.getElementById('punctualityChart') as HTMLCanvasElement;

    if (weeklyCtx) {
      this.charts.weekly = new Chart(weeklyCtx, {
        type: 'bar',
        data: {} as ChartData<'bar'>,
        options: {}
      });
    }

    if (statusCtx) {
      this.charts.status = new Chart(statusCtx, {
        type: 'doughnut',
        data: {} as ChartData<'doughnut'>,
        options: {}
      });
    }

    if (punctualityCtx) {
      this.charts.punctuality = new Chart(punctualityCtx, {
        type: 'bar',
        data: {} as ChartData<'bar'>,
        options: {}
      });
    }

    this.updateChartData();
    this.updateWeeklyChart();
    this.updateStatusChart();
  }

  private updateStatusChart() {
    // Obtenir les entrées d'aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEntries = this.monthlyEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    // Calculer le nombre total d'employés
    const totalEmployees = this.currentUser?.managedEmployees?.length || 0;

    // Compter les différents statuts
    const presentCount = todayEntries.filter(entry => 
      entry.status === 'present' && !this.isLate(entry)
    ).length;

    const lateCount = todayEntries.filter(entry => 
      this.isLate(entry)
    ).length;

    const leaveCount = todayEntries.filter(entry => 
      entry.status === 'leave'
    ).length;

    const holidayCount = todayEntries.filter(entry => 
      entry.status === 'holiday'
    ).length;

    // Les employés absents sont ceux qui n'ont pas d'entrée ou qui sont marqués comme absents
    const absentCount = totalEmployees - (presentCount + lateCount + leaveCount + holidayCount);

    // Configurer les données pour le graphique en anneau
    const statusData = {
      labels: ['Présents', 'En retard', 'Absents', 'En congé', 'Jour férié'],
      datasets: [{
        data: [presentCount, lateCount, absentCount, leaveCount, holidayCount],
        backgroundColor: [
          'rgba(34, 197, 94, 0.7)',  // Vert pour présents
          'rgba(249, 115, 22, 0.7)', // Orange pour retards
          'rgba(239, 68, 68, 0.7)',  // Rouge pour absents
          'rgba(59, 130, 246, 0.7)', // Bleu pour congés
          'rgba(168, 85, 247, 0.7)'  // Violet pour jours fériés
        ],
        borderColor: [
          '#22c55e', // Vert
          '#f97316', // Orange
          '#ef4444', // Rouge
          '#3b82f6', // Bleu
          '#a855f7'  // Violet
        ],
        borderWidth: 1
      }]
    };

    const statusOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'right' as const,
        },
        title: {
          display: true,
          text: 'Distribution des Statuts'
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      cutout: '50%'
    };

    if (this.charts.status) {
      this.charts.status.data = statusData as ChartData<'doughnut'>;
      this.charts.status.options = statusOptions;
      this.charts.status.update();
    }
  }

  private setupTimeUpdate() {
    interval(60000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentTime = new Date();
      });
  }

  private setupDataRefresh() {
    this.refreshInterval = interval(300000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadTeamEntries();
      });
  }

  private async checkAbsences(): Promise<void> {
    if (!this.teamEntries.length) return;

    const currentTime = new Date();
    let needsUpdate = false;

    for (const entry of this.teamEntries) {
      if (this.shouldBeMarkedAsAbsent(entry, currentTime)) {
        await this.updateEntryStatus(entry);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await this.loadTeamEntries();
    }
  }

  private calculateMinutesLate(entry: TimeEntry): number | undefined {
    if (!entry.isLate || !entry.checkIn) return undefined;

    const checkInTime = new Date(`1970-01-01T${entry.checkIn}`);
    const expectedTime = new Date(`1970-01-01T09:00:00`);

    return Math.floor((checkInTime.getTime() - expectedTime.getTime()) / 60000);
  }

  getPresentCount(): number {
    return this.teamEntries.filter(e => e.status === 'present').length;
  }

  getAbsentCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filtrer les entrées d'aujourd'hui
    const todayEntries = this.monthlyEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    });

    // Compter les employés absents
    return this.currentUser.managedEmployees.filter(employeeId => {
      const employeeEntry = todayEntries.find(entry => entry.userId === employeeId);
      return !employeeEntry || 
             (!employeeEntry.checkIn && 
              employeeEntry.status !== 'leave' && 
              employeeEntry.status !== 'holiday');
    }).length;
  }

  getLateCount(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.monthlyEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime() && this.isLate(entry);
    }).length;
  }

  getLeaveCount(): number {
    return this.teamEntries.filter(e => e.status === 'leave' || e.status === 'holiday').length;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    try {
      if (isNaN(date.getTime())) {
        console.error('Invalid date object:', date);
        return '-';
      }
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  }

  getStatusLabel(status: string): string {
    return this.STATUS_LABELS[status as keyof typeof this.STATUS_LABELS] || status;
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
    switch (status) {
      case 'present':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'absent':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'late':
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case 'leave':
      case 'holiday':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'present':
        return 'pi-check-circle';
      case 'absent':
        return 'pi-times-circle';
      case 'late':
        return 'pi-clock';
      case 'leave':
        return 'pi-calendar';
      case 'holiday':
        return 'pi-star';
      default:
        return 'pi-filter';
    }
  }

  getStatusColor(status: string): string {
    return this.STATUS_COLORS[status as keyof typeof this.STATUS_COLORS] || this.STATUS_COLORS.default;
  }

  private readonly STATUS_COLORS = {
    present: '#22c55e',
    absent: '#ef4444',
    late: '#f97316',
    leave: '#3b82f6',
    holiday: '#6366f1',
    default: '#64748b'
  } as const;

  private readonly STATUS_LABELS = {
    present: 'Présent',
    absent: 'Absent',
    late: 'En retard',
    leave: 'En congé',
    holiday: 'Jour férié'
  } as const;

  private async loadMonthlyEntries() {
    this.loading = true;
    try {
      const managedEmployees = await this.authService.getManagedEmployees();

      if (!managedEmployees.length) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Attention',
          detail: 'Vous n\'avez pas d\'employés sous votre responsabilité'
        });
        this.monthlyEntries = [];
        return;
      }

      const today = new Date();
      const entriesPromises = managedEmployees.map(employee =>
          firstValueFrom(this.pointageService.getMonthlyEntries(
              employee.id,
              today.getMonth(),
              today.getFullYear()
          ))
      );

      const allEntries = await Promise.all(entriesPromises);
      const flatEntries = allEntries.flat();

      console.log('Raw entries from API:', flatEntries);

      const entriesWithUser = flatEntries.map((entry: TimeEntry) => {
        const user = managedEmployees.find(emp => emp.id === entry.userId);
        if (!user) {
          console.log('No user found for entry:', entry);
          return null;
        }

        let lunchStart = entry.lunchStart;
        let lunchEnd = entry.lunchEnd;

        if (lunchStart && /^\d{4}-\d{2}-\d{2}T/.test(lunchStart)) {
          const date = new Date(lunchStart);
          lunchStart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        if (lunchEnd && /^\d{4}-\d{2}-\d{2}T/.test(lunchEnd)) {
          const date = new Date(lunchEnd);
          lunchEnd = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }

        const timeEntry: TimeEntryWithUser = {
          id: entry.id,
          userId: entry.userId,
          date: new Date(entry.date),
          checkIn: entry.checkIn,
          checkOut: entry.checkOut,
          lunchStart: lunchStart,
          lunchEnd: lunchEnd,
          totalHours: entry.totalHours || 0,
          isLate: entry.isLate,
          minutesLate: this.calculateMinutesLate(entry),
          status: entry.status,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            role: user.role,
            photoUrl: user.photoUrl,
            department: user.department,
            position: user.position,
            managerId: user.managerId,
            managedEmployees: user.managedEmployees,
            hireDate: user.hireDate,
            leaveBalance: user.leaveBalance,
            workSchedule: user.workSchedule,
            rating: user.rating,
            status: user.status,
            contractType: user.contractType
          }
        };

        console.log('Processed entry:', timeEntry);
        return timeEntry;
      });

      this.monthlyEntries = entriesWithUser.filter((entry): entry is TimeEntryWithUser => entry !== null);
      this.monthlyEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

      console.log('Final monthlyEntries:', this.monthlyEntries);

      this.updateChartData();
    } catch (error) {
      console.error('Error loading monthly entries:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger l\'historique mensuel'
      });
    } finally {
      this.loading = false;
    }
  }

  private loadMonthlyHistory() {
    if (!this.currentUser?.managedEmployees?.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Aucun employé à gérer'
      });
      return;
    }

    this.pointageService.getTeamEntries(this.currentUser.managedEmployees)
        .subscribe({
          next: (entries) => {
            const entriesWithUser = entries.map(entry => ({
              ...entry,
              checkIn: entry.checkIn || undefined,
              checkOut: entry.checkOut?.toString() || undefined,
              lunchStart: entry.lunchStart?.toString() || undefined,
              lunchEnd: entry.lunchEnd?.toString() || undefined,
              totalHours: entry.totalHours || 0
            } as TimeEntryWithUser));

            this.monthlyHistory = entriesWithUser;
            this.updateChartData();
          },
          error: (error: any) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Impossible de charger l\'historique mensuel'
            });
          }
        });
  }

  private async loadTeamEntries(): Promise<void> {
    if (!this.currentUser?.managedEmployees?.length) {
      return;
    }

    const startDate = new Date(this.selectedYear,
      this.selectedPeriod === 'month' ? this.selectedMonth : 0,
      1);
    const endDate = new Date(this.selectedYear,
      this.selectedPeriod === 'month' ? this.selectedMonth + 1 : 12,
      0);

    this.loading = true;
    this.pointageService.getTeamEntries(this.currentUser.managedEmployees)
      .pipe(
        map((entries: TimeEntryWithUser[]) => {
          // Enrichir les entrées avec les informations utilisateur
          return entries.map(entry => {
            if (!entry.user) {
              const user = this.managedUsers.find(u => u.id === entry.userId);
              if (user) {
                entry.user = user;
              }
            }
            return entry;
          }).filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= startDate && entryDate <= endDate;
          });
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (entries) => {
          this.monthlyEntries = entries;
          this.teamEntries = entries;
          this.filterEntries();
          this.updateChartData();
          this.loading = false;
          this.setupTimeUpdate();
          this.setupDataRefresh();
          this.initializeCharts();
        },
        error: (error) => {
          console.error('Erreur lors du chargement des entrées:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de charger les entrées de pointage'
          });
          this.loading = false;
        }
      });
  }

  onDateSelect(date: Date) {
    this.selectedDate = date;
    this.loadSelectedDateDetails();
  }

  private loadSelectedDateDetails() {
    const selectedEntry = this.monthlyHistory.find(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getDate() === this.selectedDate.getDate() &&
          entryDate.getMonth() === this.selectedDate.getMonth() &&
          entryDate.getFullYear() === this.selectedDate.getFullYear();
    });

    this.selectedDateDetails = selectedEntry || null;
  }

  filterEntries() {
    if (!this.teamEntries) {
      this.filteredEntries = [];
      return;
    }

    this.filteredEntries = this.teamEntries.filter(entry => {
      const matchesSearch = !this.searchTerm || 
        entry.user && (
          entry.user.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          entry.user.lastName.toLowerCase().includes(this.searchTerm.toLowerCase())
        );

      const matchesStatus = !this.selectedStatus || entry.status === this.selectedStatus;

      const entryDate = new Date(entry.date);
      const matchesDate = !this.selectedDate || this.isToday(entryDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.selectedStatus || this.selectedDate);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filterEntries();
  }

  clearStatus(): void {
    this.selectedStatus = '';
    this.filterEntries();
  }

  clearDate(): void {
    this.selectedDate = new Date();
    this.onDateSelect(this.selectedDate);
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.selectedDate = new Date();
    this.filterEntries();
  }

  isWorkStarted(): boolean {
    const now = new Date();
    const workStart = new Date();
    workStart.setHours(this.WORK_START_HOUR, this.WORK_START_MINUTES, 0);
    return now >= workStart;
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  private shouldBeMarkedAsAbsent(entry: TimeEntryWithUser, currentTime: Date = new Date()): boolean {

    if (entry.status === 'leave' || entry.status === 'holiday') {
      return false;
    }

    const workSchedule = entry.user?.workSchedule;
    if (!workSchedule) {
      return false;
    }

    const [startHours, startMinutes] = workSchedule.startTime.split(':').map(Number);
    const entryDate = new Date(entry.date);
    const workStartTime = new Date(entryDate);
    workStartTime.setHours(startHours, startMinutes, 0);

    const graceTime = new Date(workStartTime);
    graceTime.setMinutes(graceTime.getMinutes() + 30);

    return currentTime > graceTime && !entry.checkIn;
  }

  private async updateEntryStatus(entry: TimeEntryWithUser): Promise<void> {
    if (this.shouldBeMarkedAsAbsent(entry)) {
      await firstValueFrom(this.pointageService.updateTimeEntry(entry.id!, {
        ...entry,
        status: 'absent',
        totalHours: 0
      }));
    }
  }

  private convertToTimeString(time: string | null | undefined): string | null {
    if (!time) return null;

    try {
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return time.substring(0, 5);
      }

      if (/^\d{4}-\d{2}-\d{2}T/.test(time)) {
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Error converting time:', error, 'Input:', time);
      return null;
    }
  }

  private calculateDuration(startTime: string | null, endTime: string | null): number | null {
    if (!startTime || !endTime) return null;

    try {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);

      let startMinutes = startHour * 60 + startMinute;
      let endMinutes = endHour * 60 + endMinute;

      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
      }

      const duration = endMinutes - startMinutes;
      return duration > 0 ? duration : null;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return null;
    }
  }

  private getExpectedWorkMinutes(entry: TimeEntryWithUser): number {
    const DEFAULT_WORK_HOURS = 8 * 60;

    if (!entry.user?.workSchedule) {
      return DEFAULT_WORK_HOURS;
    }

    const { startTime, endTime, lunchBreakDuration } = entry.user.workSchedule;

    if (!startTime || !endTime) {
      return DEFAULT_WORK_HOURS;
    }

    try {
      const workDuration = this.calculateDuration(startTime, endTime);
      if (workDuration === null) return DEFAULT_WORK_HOURS;

      return workDuration - (lunchBreakDuration || 60);
    } catch {
      return DEFAULT_WORK_HOURS;
    }
  }

  private getWorkStatus(entry: TimeEntryWithUser): string {
    if (!entry.checkIn) return 'Non pointé';
    if (!entry.checkOut) return 'En cours';

    const duration = this.calculateDuration(entry.checkIn, entry.checkOut);
    if (duration === null) return 'Erreur';

    let actualWorkDuration = duration;
    if (entry.lunchStart && entry.lunchEnd) {
      const lunchDuration = this.calculateDuration(entry.lunchStart, entry.lunchEnd);
      if (lunchDuration !== null) {
        actualWorkDuration -= lunchDuration;
      }
    }

    const expectedMinutes = this.getExpectedWorkMinutes(entry);

    const completionPercentage = (actualWorkDuration / expectedMinutes) * 100;

    if (completionPercentage >= 100) return 'Terminé';
    if (completionPercentage >= 90) return 'Presque terminé';
    if (completionPercentage >= 50) return 'Mi-temps';
    return 'Incomplet';
  }

  formatWorkDuration(entry: TimeEntryWithUser): string {
    if (!entry.checkIn || !entry.checkOut) return '-';

    const duration = this.calculateDuration(entry.checkIn, entry.checkOut);
    if (duration === null) return '-';

    let actualWorkDuration = duration;
    if (entry.lunchStart && entry.lunchEnd) {
      const lunchDuration = this.calculateDuration(entry.lunchStart, entry.lunchEnd);
      if (lunchDuration !== null) {
        actualWorkDuration -= lunchDuration;
      }
    }

    const hours = Math.floor(actualWorkDuration / 60);
    const minutes = actualWorkDuration % 60;
    const status = this.getWorkStatus(entry);
    const expectedMinutes = this.getExpectedWorkMinutes(entry);
    const expectedHours = Math.floor(expectedMinutes / 60);

    return `${hours}h${minutes > 0 ? minutes + 'm' : ''} / ${expectedHours}h (${status})`;
  }

  private updateChartData(): void {
    if (!this.currentUser?.managedEmployees) {
      return;
    }

    // Filtrer les entrées selon la période sélectionnée
    const filteredEntries = this.monthlyEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      if (this.selectedPeriod === 'year') {
        return entryDate.getFullYear() === this.selectedYear;
      } else {
        return entryDate.getFullYear() === this.selectedYear && 
               entryDate.getMonth() === this.selectedMonth;
      }
    });

    // Grouper les entrées par utilisateur
    const userEntriesMap = new Map<number, TimeEntryWithUser[]>();
    
    // Initialiser la map avec tous les utilisateurs gérés
    this.currentUser.managedEmployees.forEach(userId => {
      userEntriesMap.set(userId, []);
    });
    
    // Ajouter les entrées existantes
    filteredEntries.forEach(entry => {
      if (userEntriesMap.has(entry.userId)) {
        userEntriesMap.get(entry.userId)!.push(entry);
      }
    });

    // Calculer les statistiques pour chaque utilisateur
    const userStatsList = Array.from(userEntriesMap.entries())
      .map(([userId, entries]) => {
        const userName = this.getUserName(userId);

        if (entries.length === 0) {
          return {
            name: userName,
            absenceRate: 100,
            lateRate: 0
          };
        }

        const stats = this.calculateAttendanceStats(entries);
        const workingDays = this.getDaysInPeriod() - stats.leaveDays;
        
        return {
          name: userName,
          absenceRate: (stats.absentDays / workingDays) * 100,
          lateRate: (stats.lateDays / workingDays) * 100
        };
      })
      .sort((a, b) => (b.absenceRate + b.lateRate) - (a.absenceRate + a.lateRate));

    // Mettre à jour le graphique de ponctualité
    const punctualityData = {
      labels: userStatsList.map(stats => stats.name),
      datasets: [
        {
          label: 'Taux de retard (%)',
          data: userStatsList.map(stats => Number(stats.lateRate.toFixed(1))),
          backgroundColor: 'rgba(249, 115, 22, 0.7)',
          borderColor: '#f97316',
          borderWidth: 1
        },
        {
          label: 'Taux d\'absence (%)',
          data: userStatsList.map(stats => Number(stats.absenceRate.toFixed(1))),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: '#ef4444',
          borderWidth: 1
        }
      ]
    };

    const punctualityOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `Analyse des retards et absences - ${this.selectedPeriod === 'year' ? 
            this.selectedYear : 
            `${this.months[this.selectedMonth].label} ${this.selectedYear}`}`
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Pourcentage (%)'
          },
          max: 100,
          stacked: false
        },
        x: {
          stacked: false,
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    };

    if (this.charts.punctuality) {
      this.charts.punctuality.data = punctualityData as ChartData<'bar'>;
      this.charts.punctuality.options = punctualityOptions;
      this.charts.punctuality.update();
    }
  }

  private getDaysInPeriod(): number {
    if (this.selectedPeriod === 'year') {
      return this.isLeapYear(this.selectedYear) ? 366 : 365;
    } else {
      return new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    }
  }

  private isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  private calculateAttendanceStats(entries: TimeEntryWithUser[]): {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
    attendanceRate: number;
    absenceRate: number;
    punctualityRate: number;
  } {
    if (!entries || entries.length === 0) {
      return {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        leaveDays: 0,
        attendanceRate: 0,
        absenceRate: 0,
        punctualityRate: 0
      };
    }

    const stats = entries.reduce((acc, entry) => {
      acc.totalDays++;

      if (entry.status === 'leave' || entry.status === 'holiday') {
        acc.leaveDays++;
      } else if (entry.status === 'absent') {
        acc.absentDays++;
      } else if (entry.status === 'present') {
        if (this.isLate(entry)) {
          acc.lateDays++;
        } else {
          acc.presentDays++;
        }
      }

      return acc;
    }, {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      leaveDays: 0,
      attendanceRate: 0,
      absenceRate: 0,
      punctualityRate: 0
    });

    const workingDays = stats.totalDays - stats.leaveDays;
    
    if (workingDays > 0) {
      stats.attendanceRate = ((stats.presentDays + stats.lateDays) / workingDays) * 100;
      stats.absenceRate = (stats.absentDays / workingDays) * 100;
      const totalPresent = stats.presentDays + stats.lateDays;
      stats.punctualityRate = totalPresent > 0 ? (stats.presentDays / totalPresent) * 100 : 0;
    }

    return stats;
  }

  private isLate(entry: TimeEntryWithUser): boolean {
    if (!entry.checkIn) return false;

    const [hours, minutes] = entry.checkIn.split(':').map(Number);
    const checkInTime = hours * 60 + minutes;
    
    // Heure de début standard (9h00)
    const startTime = 9 * 60;
    
    // Si l'employé a un horaire personnalisé
    if (entry.user?.workSchedule?.startTime) {
      const [scheduleHours, scheduleMinutes] = entry.user.workSchedule.startTime.split(':').map(Number);
      const scheduleStartTime = scheduleHours * 60 + scheduleMinutes;
      return checkInTime > scheduleStartTime;
    }
    
    // Sinon, on utilise l'heure standard
    return checkInTime > startTime;
  }

  formatTime(time: string | undefined): string {
    if (!time) return '--:--';

    try {
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return time.substring(0, 5);
      }

      if (/^\d{4}-\d{2}-\d{2}T/.test(time)) {
        const date = new Date(time);
        if (!isNaN(date.getTime())) {
          return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
      }

      return '--:--';
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', time);
      return '--:--';
    }
  }

  formatLunchTime(entry: TimeEntryWithUser): string {
    try {
      if (!entry.lunchStart && !entry.lunchEnd) return '--:--';

      const startTime = this.formatTime(entry.lunchStart);
      const endTime = this.formatTime(entry.lunchEnd);

      if (entry.lunchStart && !entry.lunchEnd) {
        return `${startTime} - En cours`;
      }

      if (!entry.lunchStart && entry.lunchEnd) {
        return `??? - ${endTime}`;
      }

      const duration = this.calculateDuration(entry.lunchStart, entry.lunchEnd);
      const expectedDuration = entry.user?.workSchedule?.lunchBreakDuration || 60;

      let status = '';
      if (duration !== null) {
        if (duration > expectedDuration) {
          status = ' ⚠️ Dépassement';
        } else if (duration < expectedDuration) {
          status = ' ⚠️ Pause courte';
        }
      }

      return `${startTime} - ${endTime} (${duration || 0} min)${status}`;
    } catch (error) {
      console.error('Error formatting lunch time:', error, 'Entry:', entry);
      return '--:--';
    }
  }

  private showMessage(severity: string, detail: string) {
    this.messageService.add({
      severity,
      summary: severity === 'error' ? 'Erreur' : 'Succès',
      detail,
      life: 3000
    });
  }

  ngAfterViewInit(): void {
    if (this.currentUser) {
      this.loadMonthlyEntries();
      if (this.currentUser.role === 'manager' && this.currentUser.managedEmployees) {
        this.loadTeamEntries();
      }
    }
  }

  private readonly WORK_START_HOUR = 9;
  private readonly WORK_START_MINUTES = 0;

  private readonly WORK_END_HOUR = 17;
  private readonly WORK_END_MINUTES = 0;

  private readonly LUNCH_BREAK_DURATION = 60;

  private readonly GRACE_TIME = 30;

  onPeriodChange(period: 'month' | 'year'): void {
    this.selectedPeriod = period;
    this.loadTeamEntries();
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.loadTeamEntries();
  }

  onMonthChange(month: number): void {
    this.selectedMonth = month;
    this.loadTeamEntries();
  }

  private updateWeeklyChart() {
    // Obtenir la date de début de la semaine (lundi)
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Créer un tableau pour les 7 jours de la semaine
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });

    // Préparer les données pour chaque jour
    const dailyStats = weekDays.map(date => {
      const dayEntries = this.monthlyEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate.getDate() === date.getDate() &&
               entryDate.getMonth() === date.getMonth() &&
               entryDate.getFullYear() === date.getFullYear();
      });

      const totalEmployees = this.currentUser?.managedEmployees?.length || 0;
      const presentCount = dayEntries.filter(entry => entry.status === 'present' || entry.status === 'late').length;
      const absentCount = totalEmployees - presentCount;
      const lateCount = dayEntries.filter(entry => this.isLate(entry)).length;
      const leaveCount = dayEntries.filter(entry => entry.status === 'leave').length;

      return {
        date,
        presentCount,
        absentCount,
        lateCount,
        leaveCount
      };
    });

    // Configurer les données du graphique
    const weeklyData = {
      labels: dailyStats.map(stat => this.formatDayLabel(stat.date)),
      datasets: [
        {
          label: 'Présents',
          data: dailyStats.map(stat => stat.presentCount),
          backgroundColor: 'rgba(34, 197, 94, 0.7)',
          borderColor: '#22c55e',
          borderWidth: 1
        },
        {
          label: 'Absents',
          data: dailyStats.map(stat => stat.absentCount),
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          borderColor: '#ef4444',
          borderWidth: 1
        },
        {
          label: 'En retard',
          data: dailyStats.map(stat => stat.lateCount),
          backgroundColor: 'rgba(249, 115, 22, 0.7)',
          borderColor: '#f97316',
          borderWidth: 1
        },
        {
          label: 'En congé',
          data: dailyStats.map(stat => stat.leaveCount),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3b82f6',
          borderWidth: 1
        }
      ]
    };

    const weeklyOptions = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Tendance de Présence Hebdomadaire'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Nombre d\'employés'
          },
          stacked: true
        },
        x: {
          stacked: true
        }
      }
    };

    if (this.charts.weekly) {
      this.charts.weekly.data = weeklyData as ChartData<'bar'>;
      this.charts.weekly.options = weeklyOptions;
      this.charts.weekly.update();
    }
  }

  private formatDayLabel(date: Date): string {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
  }
}
