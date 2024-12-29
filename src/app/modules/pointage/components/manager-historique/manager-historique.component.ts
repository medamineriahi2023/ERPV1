import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ChartModule } from 'primeng/chart';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { PointageService } from '../../../../core/services/pointage.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User, TimeEntry } from '../../../../core/interfaces/user.interface';
import { HistoryService } from "@core/services/history.service";
import { firstValueFrom } from 'rxjs';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  entry?: TimeEntry;
}

interface MonthlyStats {
  presentDays: number;
  workDays: number;
  lateCount: number;
  punctualityRate: number;
  totalHours: number;
}

@Component({
  selector: 'app-manager-historique',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    DropdownModule,
    CalendarModule,
    ToastModule,
    ChartModule,
    TabViewModule,
    TooltipModule
  ],
  providers: [MessageService],
  templateUrl: './manager-historique.component.html',
  styleUrls: ['./manager-historique.component.scss']
})
export class ManagerHistoriqueComponent implements OnInit {
  currentUser: User | null = null;
  managedUsers: User[] = [];
  selectedUser: User | null = null;
  monthlyHistory: TimeEntry[] = [];
  selectedMonth: number;
  selectedYear: number;
  loading = false;
  activeView: 'list' | 'calendar' | 'stats' = 'list';
  calendarDays: CalendarDay[] = [];
  monthlyStats: MonthlyStats = {
    presentDays: 0,
    workDays: 0,
    lateCount: 0,
    punctualityRate: 0,
    totalHours: 0
  };

  // Options pour les mois et années
  months = [
    { label: 'Janvier', value: 0 },
    { label: 'Février', value: 1 },
    { label: 'Mars', value: 2 },
    { label: 'Avril', value: 3 },
    { label: 'Mai', value: 4 },
    { label: 'Juin', value: 5 },
    { label: 'Juillet', value: 6 },
    { label: 'Août', value: 7 },
    { label: 'Septembre', value: 8 },
    { label: 'Octobre', value: 9 },
    { label: 'Novembre', value: 10 },
    { label: 'Décembre', value: 11 }
  ];

  years: { label: string; value: number }[];

  // Configuration des graphiques
  punctualityChartData: any;
  workingHoursChartData: any;

  constructor(
    private historyService: HistoryService,
    private authService: AuthService,
    private messageService: MessageService
  ) {
    const currentYear = new Date().getFullYear();
    this.selectedMonth = new Date().getMonth();
    this.selectedYear = currentYear;
    this.years = Array.from({ length: 5 }, (_, i) => ({
      label: String(currentYear - 2 + i),
      value: currentYear - 2 + i
    }));
  }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadManagedUsers();
      }
    });
  }

  private async loadManagedUsers() {
    try {
      this.loading = true;
      this.managedUsers = await this.authService.getManagedEmployees(true);
      
      if (this.managedUsers.length > 0) {
        this.selectedUser = this.managedUsers[0];
        this.loadMonthlyData();
      }
    } catch (error) {
      console.error('Error loading managed users:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger les utilisateurs'
      });
    } finally {
      this.loading = false;
    }
  }

  onUserChange() {
    if (this.selectedUser) {
      this.loadMonthlyData();
    }
  }

  onMonthChange() {
    this.loadMonthlyData();
  }

  onYearChange() {
    this.loadMonthlyData();
  }

  loadMonthlyData() {
    if (!this.selectedUser) return;
    
    this.loading = true;
    const startDate = new Date(this.selectedYear, this.selectedMonth, 1);
    const endDate = new Date(this.selectedYear, this.selectedMonth + 1, 0);

    firstValueFrom(this.historyService.getUserMonthlyHistory(this.selectedUser.id, startDate, endDate))
      .then(history => {
        this.monthlyHistory = history.map(entry => ({
          ...entry,
          date: new Date(entry.date),
          isLate: entry.status === 'late'
        }));
        this.calculateMonthlyStats();
        this.generateCalendarDays();
        this.updateCharts();
      })
      .catch(error => {
        console.error('Error loading monthly history:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger l\'historique'
        });
      })
      .finally(() => {
        this.loading = false;
      });
  }

  private calculateMonthlyStats() {
    const stats: MonthlyStats = {
      presentDays: 0,
      workDays: this.getWorkDaysInMonth(),
      lateCount: 0,
      punctualityRate: 0,
      totalHours: 0
    };

    this.monthlyHistory.forEach(entry => {
      if (entry.status === 'present' || entry.status === 'late') {
        stats.presentDays++;
        stats.totalHours += entry.totalHours || 0;
      }
      if (entry.status === 'late') {
        stats.lateCount++;
      }
    });

    stats.punctualityRate = stats.presentDays > 0 
      ? ((stats.presentDays - stats.lateCount) / stats.presentDays) * 100 
      : 0;

    this.monthlyStats = stats;
  }

  private getWorkDaysInMonth(): number {
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    let workDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(this.selectedYear, this.selectedMonth, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        workDays++;
      }
    }

    return workDays;
  }

  private generateCalendarDays() {
    const firstDay = new Date(this.selectedYear, this.selectedMonth, 1);
    const lastDay = new Date(this.selectedYear, this.selectedMonth + 1, 0);
    
    // Get the first Monday before the first day of the month
    const start = new Date(firstDay);
    start.setDate(start.getDate() - (start.getDay() || 7) + 1);
    
    // Get the last Sunday after the last day of the month
    const end = new Date(lastDay);
    end.setDate(end.getDate() + (7 - end.getDay()) % 7);
    
    const days: CalendarDay[] = [];
    const today = new Date();
    const current = new Date(start);
    
    while (current <= end) {
      const date = new Date(current);
      days.push({
        date,
        isCurrentMonth: date.getMonth() === this.selectedMonth,
        isToday: this.isSameDay(date, today),
        entry: this.monthlyHistory.find(e => this.isSameDay(new Date(e.date), date))
      });
      current.setDate(current.getDate() + 1);
    }
    
    this.calendarDays = days;
  }

  private updateCharts() {
    if (!this.monthlyHistory.length) return;

    // Calcul des jours
    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.selectedMonth 
                          && today.getFullYear() === this.selectedYear;
    
    const totalDaysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    const elapsedDays = isCurrentMonth ? today.getDate() : totalDaysInMonth;
    const remainingDays = totalDaysInMonth - elapsedDays;

    // Calcul des différents types de jours
    const workDays = this.monthlyHistory.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate > today) return acc;
      
      const dayOfWeek = entryDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend) {
        acc.nonWorkingDays++;
      } else if (entry.status === 'present') {
        acc.workedDays++;
      } else if (entry.status === 'late') {
        acc.lateDays++;
      }
      
      return acc;
    }, {
      workedDays: 0,
      lateDays: 0,
      nonWorkingDays: 0
    });

    // Configuration du graphique de répartition du temps
    this.punctualityChartData = {
      type: 'bar',
      data: {
        labels: ['Ce mois'],
        datasets: [
          {
            label: 'Jours restants',
            data: [remainingDays],
            backgroundColor: '#E0E0E0',
            borderColor: '#E0E0E0'
          },
          {
            label: 'Jours travaillés',
            data: [workDays.workedDays],
            backgroundColor: '#4CAF50',
            borderColor: '#4CAF50'
          },
          {
            label: 'Retards',
            data: [workDays.lateDays],
            backgroundColor: '#FFC107',
            borderColor: '#FFC107'
          },
          {
            label: 'Weekends/Fériés',
            data: [workDays.nonWorkingDays],
            backgroundColor: '#90CAF9',
            borderColor: '#90CAF9'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          x: { stacked: true },
          y: { 
            stacked: true,
            max: totalDaysInMonth
          }
        },
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                return `${context.dataset.label}: ${context.raw} jours`;
              }
            }
          }
        }
      }
    };

    // Graphique des heures travaillées
    const entries = this.monthlyHistory
      .filter(entry => entry.totalHours)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.workingHoursChartData = {
      labels: entries.map(entry => new Date(entry.date).toLocaleDateString()),
      datasets: [{
        label: 'Heures travaillées',
        data: entries.map(entry => entry.totalHours),
        borderColor: '#2196F3',
        tension: 0.4,
        fill: false
      }]
    };
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  formatTime(time: string | null): string {
    return time || '--:--';
  }

  calculateDuration(entry: TimeEntry): string {
    if (!entry.checkIn || !entry.checkOut) return '0h';
    return `${entry.totalHours.toFixed(1)}h`;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-700';
      case 'late':
        return 'bg-orange-100 text-orange-700';
      case 'absent':
        return 'bg-red-100 text-red-700';
      case 'leave':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'present':
        return 'Présent';
      case 'late':
        return 'En retard';
      case 'absent':
        return 'Absent';
      case 'leave':
        return 'Congé';
      default:
        return status;
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'present':
        return '✅';
      case 'late':
        return '⚡';
      case 'absent':
        return '❌';
      case 'leave':
        return '🌴';
      default:
        return '';
    }
  }

  formatDuration(duration?: number): string {
    if (!duration) return '--:--';
    const hours = Math.floor(duration);
    const minutes = Math.round((duration - hours) * 60);
    return `${hours}h${minutes ? `${minutes}min` : ''}`;
  }

  exportData(format: 'pdf' | 'excel') {
    // TODO: Implement export functionality
    console.log(`Exporting data in ${format} format`);
  }
}
