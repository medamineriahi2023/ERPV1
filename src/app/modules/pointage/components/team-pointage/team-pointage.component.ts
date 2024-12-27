import { Component, OnInit, OnDestroy } from '@angular/core';
import { TimeEntry, User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';
import { PointageService } from '@app/core/services/pointage.service';
import { ApiService } from '@app/core/services/api.service';
import { MessageService } from 'primeng/api';
import { interval, Subscription, forkJoin, firstValueFrom } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, ChartData } from 'chart.js/auto';
import { Subject } from 'rxjs';

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
export class TeamPointageComponent implements OnInit, OnDestroy {
  today: Date = new Date();
  currentTime: Date = new Date();
  selectedDate: Date = new Date();
  teamEntries: TimeEntryWithUser[] = [];
  filteredEntries: TimeEntryWithUser[] = [];
  selectedDateDetails: TimeEntryWithUser | null = null;
  monthlyHistory: TimeEntryWithUser[] = [];
  monthlyEntries: TimeEntryWithUser[] = [];
  currentUser: User | null = null;
  searchTerm: string = '';
  selectedStatus: string = '';
  private refreshInterval: Subscription | null = null;
  private charts: Record<ChartType, Chart> = {} as Record<ChartType, Chart>;
  private destroy$ = new Subject<void>();
  loading = false;

  statusOptions = [
    { label: 'Tous les statuts', value: '' },
    { label: 'Présent', value: 'present' },
    { label: 'Absent', value: 'absent' },
    { label: 'En congé', value: 'leave' },
    { label: 'En congé férié', value: 'holiday' },
    { label: 'En retard', value: 'late' }
  ];

  // Chart Data
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
      backgroundColor: ['#22c55e', '#f97316', '#ef4444', '#3b82f6']
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

  constructor(
      private pointageService: PointageService,
      private authService: AuthService,
      private apiService: ApiService,
      private messageService: MessageService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (this.currentUser) {
      this.loadMonthlyEntries();
      if (this.currentUser.role === 'manager' && this.currentUser.managedEmployees) {
        this.loadTeamEntries();
      }
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
    // Destroy charts
    Object.values(this.charts).forEach(chart => chart.destroy());
  }

  private initializeCharts() {
    const weeklyCtx = document.getElementById('weeklyChart') as HTMLCanvasElement;
    const statusCtx = document.getElementById('statusChart') as HTMLCanvasElement;
    const punctualityCtx = document.getElementById('punctualityChart') as HTMLCanvasElement;

    if (weeklyCtx) {
      this.charts['weekly'] = new Chart(weeklyCtx, {
        type: 'line',
        data: this.weeklyAttendanceData,
        options: this.chartOptions
      });
    }

    if (statusCtx) {
      this.charts['status'] = new Chart(statusCtx, {
        type: 'pie',
        data: this.statusDistributionData,
        options: this.chartOptions
      });
    }

    if (punctualityCtx) {
      this.charts['punctuality'] = new Chart(punctualityCtx, {
        type: 'bar',
        data: this.punctualityTrendData,
        options: this.chartOptions
      });
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
            // Convert TimeEntry to TimeEntryWithUser
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

  async loadMonthlyEntries() {
    try {
      this.loading = true;

      // Get managed employees
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
      // Fetch entries only for managed employees
      const entriesPromises = managedEmployees.map(employee =>
          firstValueFrom(this.pointageService.getMonthlyEntries(
              employee.id,
              today.getMonth(),
              today.getFullYear()
          ))
      );

      const allEntries = await Promise.all(entriesPromises);
      const flatEntries = allEntries.flat();

      // Create TimeEntryWithUser objects
      const entriesWithUser = flatEntries.map((entry: TimeEntry) => {
        const user = managedEmployees.find(emp => emp.id === entry.userId);
        if (!user) return null;

        // Convert dates to proper format
        const timeEntry: TimeEntryWithUser = {
          id: entry.id,
          userId: entry.userId,
          date: new Date(entry.date),
          checkIn: this.formatTimeToString(entry.checkIn),
          checkOut: this.formatTimeToString(entry.checkOut),
          lunchStart: this.formatTimeToString(entry.lunchStart),
          lunchEnd: this.formatTimeToString(entry.lunchEnd),
          totalHours: entry.totalHours,
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

        return timeEntry;
      });

      this.monthlyEntries = entriesWithUser.filter((entry): entry is TimeEntryWithUser => entry !== null);

      // Sort entries by date in descending order
      this.monthlyEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

      // Update charts
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

  private calculateMinutesLate(entry: TimeEntry): number | undefined {
    if (!entry.isLate || !entry.checkIn) return undefined;

    const checkInTime = new Date(`1970-01-01T${entry.checkIn}`);
    const expectedTime = new Date(`1970-01-01T09:00:00`); // Assuming 9 AM is the start time

    return Math.floor((checkInTime.getTime() - expectedTime.getTime()) / 60000);
  }

  determineStatus(entry: TimeEntryWithUser): 'present' | 'absent' | 'late' | 'leave' | 'holiday' {
    if (!entry.checkIn) return 'absent';
    if (entry.isLate) return 'late';
    if (entry.leaveStatus === 'approved') return 'leave';
    if (this.isHoliday(new Date(entry.date))) return 'holiday';
    return 'present';
  }

  isHoliday(date: Date): boolean {
    // Add your holiday logic here
    // For example, check if the date is a weekend or a known holiday
    return date.getDay() === 0 || date.getDay() === 6; // Weekend check
  }

  private updateChartData() {
    if (!this.monthlyEntries.length) return;

    const lateEntries = this.monthlyEntries.filter(entry => entry.isLate);
    const presentEntries = this.monthlyEntries.filter(entry => entry.status === 'present');
    const absentEntries = this.monthlyEntries.filter(entry => entry.status === 'absent');
    const leaveEntries = this.monthlyEntries.filter(entry => entry.status === 'leave');

    // Update punctuality chart data
    const punctualityData = {
      labels: ['0-15 min', '15-30 min', '30+ min'],
      datasets: [{
        data: [
          lateEntries.filter(e => e.minutesLate && e.minutesLate <= 15).length,
          lateEntries.filter(e => e.minutesLate && e.minutesLate > 15 && e.minutesLate <= 30).length,
          lateEntries.filter(e => e.minutesLate && e.minutesLate > 30).length
        ],
        backgroundColor: ['#FFB1C1', '#FFD1C1', '#FFE1C1']
      }]
    };

    if (this.charts.punctuality) {
      this.charts.punctuality.data = punctualityData;
      this.charts.punctuality.update();
    }

    // Update status chart data
    const statusData = {
      labels: ['Présent', 'En retard', 'Absent', 'En congé'],
      datasets: [{
        data: [
          presentEntries.length,
          lateEntries.length,
          absentEntries.length,
          leaveEntries.length
        ],
        backgroundColor: ['#4CAF50', '#FFC107', '#F44336', '#2196F3']
      }]
    };

    if (this.charts.status) {
      this.charts.status.data = statusData;
      this.charts.status.update();
    }
  }

  // Méthodes de calcul pour le template
  getPresentCount(): number {
    return this.teamEntries.filter(e => e.status === 'present').length;
  }

  getAbsentCount(): number {
    return this.teamEntries.filter(e => e.status === 'absent').length;
  }

  getLateCount(): number {
    return this.teamEntries.filter(e => e.status === 'late').length;
  }

  getLeaveCount(): number {
    return this.teamEntries.filter(e => e.status === 'leave' || e.status === 'holiday').length;
  }

  private setupTimeUpdate() {
    interval(1000).subscribe(() => {
      this.currentTime = new Date();
    });
  }

  private setupDataRefresh() {
    if (!this.currentUser?.managedEmployees?.length) return;

    this.refreshInterval = interval(60000)
        .pipe(startWith(0))
        .subscribe(() => {
          this.loadTeamEntries();
        });
  }

  private loadTeamEntries() {
    if (!this.currentUser?.managedEmployees?.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Aucun employé à gérer'
      });
      return;
    }

    this.pointageService.getTeamActiveEntries(this.currentUser.managedEmployees)
        .subscribe({
          next: (entries) => {
            // Créer un tableau de requêtes pour obtenir les détails de chaque utilisateur
            const userRequests = entries.map(entry =>
                this.apiService.getUserById(entry.userId).pipe(
                    map(user => {
                      const { password, ...userWithoutPassword } = user;
                      const timeEntry: TimeEntryWithUser = {
                        ...entry,
                        user: userWithoutPassword,
                        checkIn: entry.checkIn || undefined,
                        checkOut: entry.checkOut?.toString() || undefined,
                        lunchStart: entry.lunchStart?.toString() || undefined,
                        lunchEnd: entry.lunchEnd?.toString() || undefined,
                        totalHours: entry.totalHours || 0
                      };
                      return timeEntry;
                    })
                )
            );

            // Exécuter toutes les requêtes en parallèle
            forkJoin(userRequests).subscribe({
              next: (entriesWithUsers) => {
                this.teamEntries = entriesWithUsers;
                this.filteredEntries = entriesWithUsers;
                this.filterEntries();
              },
              error: (error) => {
                console.error('Erreur lors du chargement des détails des utilisateurs:', error);
                this.messageService.add({
                  severity: 'error',
                  summary: 'Erreur',
                  detail: 'Erreur lors du chargement des détails des utilisateurs'
                });
              }
            });
          },
          error: (error) => {
            console.error('Erreur lors du chargement des données de l\'équipe:', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors du chargement des données de l\'équipe'
            });
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
    this.filteredEntries = this.teamEntries.filter(entry => {
      const matchesSearch = this.searchTerm ?
          (entry.user ?
                  `${entry.user.firstName} ${entry.user.lastName}`.toLowerCase().includes(this.searchTerm.toLowerCase()) :
                  entry.userId.toString().includes(this.searchTerm.toLowerCase())
          ) :
          true;

      const matchesStatus = this.selectedStatus ?
          entry.status === this.selectedStatus :
          true;

      return matchesSearch && matchesStatus;
    });
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'present': 'Présent',
      'absent': 'Absent',
      'late': 'En retard',
      'leave': 'En congé',
      'holiday': 'Jour férié'
    };
    return statusMap[status] || status;
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

  getEmployeeFullName(entry: TimeEntryWithUser): string {
    if (!entry.user) return `Employé #${entry.userId}`;
    return `${entry.user.firstName} ${entry.user.lastName}`;
  }

  private showMessage(severity: string, detail: string) {
    this.messageService.add({
      severity,
      summary: severity === 'error' ? 'Erreur' : 'Succès',
      detail,
      life: 3000
    });
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
    switch (status) {
      case 'present':
        return '#22c55e';
      case 'absent':
        return '#ef4444';
      case 'late':
        return '#f97316';
      case 'leave':
        return '#3b82f6';
      case 'holiday':
        return '#6366f1';
      default:
        return '#64748b';
    }
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

  formatTime(time: string | undefined | null): string {
    return time || '-';
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

  formatLunchTime(entry: TimeEntryWithUser): string {
    if (!entry.lunchStart || !entry.lunchEnd) return '-';
    return `${entry.lunchStart} - ${entry.lunchEnd}`;
  }

  formatTimeToString(time: any): string | undefined {
    if (!time) return undefined;

    try {
      // If it's already in HH:mm format
      if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
        return time;
      }

      // If it's a timestamp or date string
      const date = new Date(time);
      if (!isNaN(date.getTime())) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      }

      return undefined;
    } catch (error) {
      console.error('Error processing time:', error);
      return undefined;
    }
  }
}
