import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { CalendarModule } from 'primeng/calendar';
import { ChartModule } from 'primeng/chart';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

import { HistoryService } from '@app/core/services/history.service';
import { AuthService } from '@app/core/services/auth.service';
import { MonthlyStats, UserTimeEntry, CalendarDay } from '@app/core/interfaces/history.interface';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  styleUrls: ['./historique.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CalendarModule,
    ChartModule,
    TabViewModule,
    ButtonModule,
    DropdownModule,
    CardModule,
    TooltipModule
  ]
})
export class HistoriqueComponent implements OnInit {
  currentMonth: number = new Date().getMonth();
  currentYear: number = new Date().getFullYear();
  monthlyData?: MonthlyStats;
  calendarDays: CalendarDay[] = [];
  activeView: 'calendar' | 'list' | 'stats' = 'calendar';
  loading = false;

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

  years = Array.from({ length: 5 }, (_, i) => ({
    label: String(this.currentYear - 2 + i),
    value: this.currentYear - 2 + i
  }));

  // Configuration des graphiques
  punctualityChartData: any;
  workingHoursChartData: any;

  constructor(
    private historyService: HistoryService,
  ) {}

  ngOnInit() {
    this.loadMonthlyData();
  }

  loadMonthlyData() {
    this.loading = true;
    this.historyService.getCurrentUserMonthlyHistory(this.currentMonth, this.currentYear)
      .subscribe({
        next: (data) => {
          this.monthlyData = data;
          this.updateCharts();
          this.loadCalendarData();
          this.loading = false;
        },
        error: (error) => {
          console.error('Erreur lors du chargement des données:', error);
          this.loading = false;
        }
      });
  }

  loadCalendarData() {
    if (this.monthlyData) {
      this.historyService.getCalendarData(
        this.currentMonth,
        this.currentYear,
        this.monthlyData.entries
      ).subscribe(days => {
        this.calendarDays = days;
      });
    }
  }

  private updateCharts() {
    if (!this.monthlyData) return;

    // Calcul des jours
    const today = new Date();
    const isCurrentMonth = today.getMonth() === this.currentMonth 
                          && today.getFullYear() === this.currentYear;
    
    const totalDaysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const elapsedDays = isCurrentMonth ? today.getDate() : totalDaysInMonth;
    const remainingDays = totalDaysInMonth - elapsedDays;

    // Calcul des différents types de jours
    const workDays = this.monthlyData.entries.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate > today) return acc; // Ne pas compter les jours futurs
      
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
    const entries = this.monthlyData.entries
      .filter(entry => entry.duration)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.workingHoursChartData = {
      labels: entries.map(entry => new Date(entry.date).toLocaleDateString()),
      datasets: [{
        label: 'Heures travaillées',
        data: entries.map(entry => entry.duration),
        borderColor: '#2196F3',
        tension: 0.4,
        fill: false
      }]
    };
  }

  onMonthChange() {
    this.loadMonthlyData();
  }

  onYearChange() {
    this.loadMonthlyData();
  }

  onViewChange(view: 'calendar' | 'list' | 'stats') {
    this.activeView = view;
  }

  getStatusClass(status?: string): string {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'late':
        return 'bg-orange-100 text-orange-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'leave':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusIcon(status?: string): string {
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
    // TODO: Implémenter l'export
  }
}
