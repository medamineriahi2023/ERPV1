import {Component, OnInit, OnDestroy, AfterViewInit} from '@angular/core';
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
export class TeamPointageComponent implements OnInit, AfterViewInit, OnDestroy {
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

  // Nouvelles propriétés pour les graphiques
  private punctualityTrendChart: Chart | null = null;
  private absenceForecastChart: Chart | null = null;
  private workingHoursChart: Chart | null = null;

  constructor(
      private pointageService: PointageService,
      private authService: AuthService,
      private apiService: ApiService,
      private messageService: MessageService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();

    this.initializeCharts();
    this.initializePunctualityTrendChart();
    this.initializeAbsenceForecastChart();
    this.initializeWorkingHoursChart();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
    // Destroy charts
    Object.values(this.charts).forEach(chart => chart.destroy());
    if (this.punctualityTrendChart) {
      this.punctualityTrendChart.destroy();
    }
    if (this.absenceForecastChart) {
      this.absenceForecastChart.destroy();
    }
    if (this.workingHoursChart) {
      this.workingHoursChart.destroy();
    }
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

  private initializePunctualityTrendChart(): void {
    const canvas = document.getElementById('punctualityTrendChart') as HTMLCanvasElement;
    if (!canvas) return;

    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const currentMonth = new Date().getMonth();
    const lastSixMonths = months.slice(currentMonth - 5, currentMonth + 1);

    this.punctualityTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: lastSixMonths,
        datasets: [{
          label: 'Taux de Ponctualité',
          data: this.calculatePunctualityTrend(),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => `${value}%`
            }
          }
        }
      }
    });
  }

  private initializeAbsenceForecastChart(): void {
    const canvas = document.getElementById('absenceForecastChart') as HTMLCanvasElement;
    if (!canvas) return;

    const nextWeekDays = this.getNextWeekDays();
    const forecastData = this.calculateAbsenceForecast();

    this.absenceForecastChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: nextWeekDays,
        datasets: [{
          label: 'Absences Prévues',
          data: forecastData,
          backgroundColor: 'rgba(99, 102, 241, 0.5)',
          borderColor: '#6366f1',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  private initializeWorkingHoursChart(): void {
    const canvas = document.getElementById('workingHoursChart') as HTMLCanvasElement;
    if (!canvas) return;

    const { labels, actualHours, expectedHours } = this.calculateWorkingHours();

    this.workingHoursChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Heures Effectives',
            data: actualHours,
            backgroundColor: 'rgba(20, 184, 166, 0.7)',
            borderColor: '#14b8a6',
            borderWidth: 1
          },
          {
            label: 'Heures Prévues',
            data: expectedHours,
            backgroundColor: 'rgba(20, 184, 166, 0.2)',
            borderColor: '#14b8a6',
            borderWidth: 2,
            type: 'line' as const
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Heures'
            }
          }
        }
      }
    });
  }

  private calculatePunctualityTrend(): number[] {
    // Simuler des données pour l'exemple
    return [85, 88, 82, 90, 87, 92];
  }

  private getNextWeekDays(): string[] {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    return days;
  }

  private calculateAbsenceForecast(): number[] {
    // Simuler des prévisions pour l'exemple
    return [2, 3, 1, 2, 4];
  }

  private calculateWorkingHours(): { labels: string[], actualHours: number[], expectedHours: number[] } {
    // Obtenir les employés et leurs heures
    const employees = this.teamEntries.map(entry => entry.user?.firstName || 'Inconnu');
    const actualHours = this.teamEntries.map(entry => entry.totalHours || 0);
    const expectedHours = this.teamEntries.map(() => 8); // 8 heures standard par jour

    return {
      labels: employees,
      actualHours,
      expectedHours
    };
  }

  async loadMonthlyEntries() {
    this.loading = true;
    try {
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

      console.log('Raw entries from API:', flatEntries);

      // Create TimeEntryWithUser objects
      const entriesWithUser = flatEntries.map((entry: TimeEntry) => {
        const user = managedEmployees.find(emp => emp.id === entry.userId);
        if (!user) {
          console.log('No user found for entry:', entry);
          return null;
        }

        // Traitement des heures de pause déjeuner
        let lunchStart = entry.lunchStart;
        let lunchEnd = entry.lunchEnd;

        // Si les heures sont au format ISO, les convertir en format HH:mm
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

  private calculateMinutesLate(entry: TimeEntry): number | undefined {
    if (!entry.isLate || !entry.checkIn) return undefined;

    const checkInTime = new Date(`1970-01-01T${entry.checkIn}`);
    const expectedTime = new Date(`1970-01-01T09:00:00`); // Assuming 9 AM is the start time

    return Math.floor((checkInTime.getTime() - expectedTime.getTime()) / 60000);
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
    // Si l'heure de début n'est pas encore passée, personne n'est absent
    if (!this.isWorkStarted()) {
      return 0;
    }

    // Filtrer les entrées d'aujourd'hui sans pointage
    return this.teamEntries.filter(entry => {
      // Vérifier si l'entrée est pour aujourd'hui
      const entryDate = new Date(entry.date);
      const isEntryToday = this.isToday(entryDate);

      // Un employé est absent si :
      // - C'est une entrée d'aujourd'hui
      // - Il n'a pas de pointage d'entrée
      // - Ce n'est pas un jour férié
      // - Ce n'est pas un congé validé
      return isEntryToday && 
             !entry.checkIn && 
             entry.status !== 'holiday' && 
             entry.status !== 'leave';
    }).length;
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
            const userRequests = entries.map(entry =>
                this.apiService.getUserById(entry.userId).pipe(
                    map(user => {
                      const { password, ...userWithoutPassword } = user;
                      const timeEntry: TimeEntryWithUser = {
                        ...entry,
                        user: userWithoutPassword,
                        checkIn: entry.checkIn,
                        checkOut: entry.checkOut?.toString(),
                        lunchStart: entry.lunchStart?.toString(),
                        lunchEnd: entry.lunchEnd?.toString(),
                        totalHours: entry.totalHours
                      };
                      return timeEntry;
                    })
                )
            );
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

  // Méthodes utilitaires pour la gestion du temps
  private convertToTimeString(time: string | null | undefined): string | null {
    if (!time) return null;

    try {
      // Si c'est déjà au format HH:mm ou HH:mm:ss
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return time.substring(0, 5);
      }

      // Si c'est une date ISO
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
      // Convertir les heures en minutes depuis minuit
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      let startMinutes = startHour * 60 + startMinute;
      let endMinutes = endHour * 60 + endMinute;
      
      // Si l'heure de fin est avant l'heure de début, on considère que c'est le jour suivant
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Ajouter 24 heures
      }
      
      const duration = endMinutes - startMinutes;
      return duration > 0 ? duration : null;
    } catch (error) {
      console.error('Error calculating duration:', error);
      return null;
    }
  }

  private getExpectedWorkMinutes(entry: TimeEntryWithUser): number {
    // Par défaut : 8 heures de travail
    const DEFAULT_WORK_HOURS = 8 * 60; // en minutes
    
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
      
      // Soustraire la pause déjeuner si définie
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

    // Soustraire la pause déjeuner si elle existe
    let actualWorkDuration = duration;
    if (entry.lunchStart && entry.lunchEnd) {
      const lunchDuration = this.calculateDuration(entry.lunchStart, entry.lunchEnd);
      if (lunchDuration !== null) {
        actualWorkDuration -= lunchDuration;
      }
    }

    const expectedMinutes = this.getExpectedWorkMinutes(entry);
    
    // Calculer le pourcentage du temps travaillé
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

    // Soustraire la pause déjeuner si elle existe
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

  ngAfterViewInit(): void {
    if (this.currentUser) {
      this.loadMonthlyEntries();
      if (this.currentUser.role === 'manager' && this.currentUser.managedEmployees) {
        this.loadTeamEntries();
      }
    }
  }

  formatTime(time: string | undefined | null): string {
    if (!time) return '--:--';
    
    try {
      // Si c'est déjà au format HH:mm ou HH:mm:ss
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return time.substring(0, 5); // Retourne seulement HH:mm
      }
      
      // Si c'est une date ISO
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

      // Si on a seulement l'heure de début
      if (entry.lunchStart && !entry.lunchEnd) {
        return `${startTime} - En cours`;
      }

      // Si on a seulement l'heure de fin (cas peu probable)
      if (!entry.lunchStart && entry.lunchEnd) {
        return `??? - ${endTime}`;
      }

      // Si on a les deux heures
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

  private readonly WORK_START_HOUR = 9;
  private readonly WORK_START_MINUTES = 0;

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  private isWorkStarted(): boolean {
    const now = new Date();
    const workStart = new Date();
    workStart.setHours(this.WORK_START_HOUR, this.WORK_START_MINUTES, 0, 0);
    return now >= workStart;
  }
}
