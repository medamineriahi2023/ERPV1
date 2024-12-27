import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DropdownModule } from 'primeng/dropdown';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { PointageService } from '../../../../core/services/pointage.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/interfaces/user.interface';
import { AvatarModule } from 'primeng/avatar';

interface TeamMemberAttendance {
  employeeId: number;
  name: string;
  position: string;
  photoUrl?: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: number;
  lateCount: number;
  absentCount: number;
  averageHours: number;
}

@Component({
  selector: 'app-team-pointage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CalendarModule,
    TableModule,
    ToastModule,
    DropdownModule,
    ChartModule,
    AvatarModule
  ],
  providers: [MessageService],
  template: `
    <div class="min-h-screen bg-gray-50/50 p-6">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">Suivi de Pointage d'Équipe</h1>
        <p class="text-gray-600 mt-1">Gérez et suivez la présence de votre équipe</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <!-- Present Today -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="bg-green-50 rounded-lg p-3">
              <i class="pi pi-users text-green-500 text-xl"></i>
            </div>
            <span class="text-sm font-medium text-green-500 bg-green-50 px-2.5 py-0.5 rounded-full">
              Présents
            </span>
          </div>
          <h3 class="text-2xl font-bold text-gray-700 mb-2">{{getPresentCount()}}</h3>
          <p class="text-gray-500 text-sm">Employés présents aujourd'hui</p>
        </div>

        <!-- Absent Today -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="bg-red-50 rounded-lg p-3">
              <i class="pi pi-user-minus text-red-500 text-xl"></i>
            </div>
            <span class="text-sm font-medium text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full">
              Absents
            </span>
          </div>
          <h3 class="text-2xl font-bold text-gray-700 mb-2">{{getAbsentCount()}}</h3>
          <p class="text-gray-500 text-sm">Employés absents aujourd'hui</p>
        </div>

        <!-- Late Today -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="bg-orange-50 rounded-lg p-3">
              <i class="pi pi-clock text-orange-500 text-xl"></i>
            </div>
            <span class="text-sm font-medium text-orange-500 bg-orange-50 px-2.5 py-0.5 rounded-full">
              En retard
            </span>
          </div>
          <h3 class="text-2xl font-bold text-gray-700 mb-2">{{getLateCount()}}</h3>
          <p class="text-gray-500 text-sm">Employés en retard aujourd'hui</p>
        </div>

        <!-- On Leave -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="bg-blue-50 rounded-lg p-3">
              <i class="pi pi-calendar text-blue-500 text-xl"></i>
            </div>
            <span class="text-sm font-medium text-blue-500 bg-blue-50 px-2.5 py-0.5 rounded-full">
              En congé
            </span>
          </div>
          <h3 class="text-2xl font-bold text-gray-700 mb-2">{{getOnLeaveCount()}}</h3>
          <p class="text-gray-500 text-sm">Employés en congé aujourd'hui</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="relative">
            <span class="p-input-icon-left w-full">
              <i class="pi pi-search"></i>
              <input type="text" pInputText class="w-full" 
                     placeholder="Rechercher un employé..."
                     (input)="filterEmployees($event)">
            </span>
          </div>
          <div>
            <p-dropdown [options]="[
                         {label: 'Tous les statuts', value: ''},
                         {label: 'Présent', value: 'present'},
                         {label: 'Absent', value: 'absent'},
                         {label: 'En retard', value: 'late'},
                         {label: 'En congé', value: 'leave'}
                       ]" 
                       placeholder="Filtrer par statut"
                       styleClass="w-full"
                       (onChange)="filterByStatus($event)">
            </p-dropdown>
          </div>
          <div>
            <p-calendar [(ngModel)]="selectedDate" 
                       [showIcon]="true"
                       placeholder="Sélectionner une date"
                       styleClass="w-full"
                       (onSelect)="onDateSelect($event)">
            </p-calendar>
          </div>
        </div>
      </div>

      <!-- Team Members List -->
      <div class="bg-white rounded-xl shadow-sm overflow-hidden">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-800">Membres de l'équipe</h3>
        </div>
        
        <div class="grid grid-cols-1 divide-y divide-gray-200">
          <div *ngFor="let member of filteredTeamMembers" 
               class="p-6 hover:bg-gray-50 transition-colors duration-150">
            <div class="flex items-center justify-between">
              <!-- Employee Info -->
              <div class="flex items-center space-x-4">
                <div class="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  <img *ngIf="member.photoUrl" [src]="member.photoUrl" [alt]="member.name" class="w-full h-full object-cover">
                  <span *ngIf="!member.photoUrl" class="text-xl font-medium text-gray-600">
                    {{member.name.charAt(0)}}
                  </span>
                </div>
                <div>
                  <h4 class="text-lg font-medium text-gray-900">{{member.name}}</h4>
                  <p class="text-sm text-gray-500">{{member.position}}</p>
                </div>
              </div>

              <!-- Today's Status -->
              <div class="flex items-center space-x-6">
                <div class="text-right">
                  <div class="text-sm text-gray-500">Arrivée</div>
                  <div class="font-medium" [class.text-red-500]="member.status === 'late'">
                    {{member.checkInTime || '--:--'}}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-500">Départ</div>
                  <div class="font-medium">{{member.checkOutTime || '--:--'}}</div>
                </div>
                <div class="text-right">
                  <div class="text-sm text-gray-500">Total</div>
                  <div class="font-medium">{{member.totalHours || 0}}h</div>
                </div>
                <div>
                  <span [class]="getStatusBadgeClass(member.status)">
                    {{getStatusLabel(member.status)}}
                  </span>
                </div>
              </div>
            </div>

            <!-- Statistics -->
            <div class="mt-4 grid grid-cols-3 gap-4">
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-sm text-gray-500">Retards ce mois</div>
                <div class="font-medium text-orange-600">{{member.lateCount}} fois</div>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-sm text-gray-500">Absences ce mois</div>
                <div class="font-medium text-red-600">{{member.absentCount}} jours</div>
              </div>
              <div class="bg-gray-50 rounded-lg p-3">
                <div class="text-sm text-gray-500">Moyenne d'heures</div>
                <div class="font-medium text-blue-600">{{member.averageHours}}h/jour</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <!-- Attendance Trend -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Tendance de présence</h3>
          <p-chart type="line" [data]="attendanceTrendData" [options]="chartOptions"></p-chart>
        </div>

        <!-- Time Distribution -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Distribution des heures</h3>
          <p-chart type="bar" [data]="timeDistributionData" [options]="chartOptions"></p-chart>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .p-dropdown {
        border-radius: 0.5rem;
        .p-dropdown-label {
          padding: 0.75rem 1rem;
        }
      }

      .p-calendar {
        width: 100%;
        .p-inputtext {
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
        }
      }

      .p-inputtext {
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
        padding-left: 2.5rem;
      }

      .p-input-icon-left > i {
        left: 1rem;
      }

      .p-chart {
        width: 100%;
        height: 300px;
      }
    }
  `]
})
export class TeamPointageComponent implements OnInit {
  teamMembers: TeamMemberAttendance[] = [];
  filteredTeamMembers: TeamMemberAttendance[] = [];
  selectedDate: Date = new Date();
  attendanceTrendData: any;
  timeDistributionData: any;
  chartOptions: any;

  constructor(
    private pointageService: PointageService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadTeamData();
    this.initializeCharts();
  }

  loadTeamData() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    // Mock data - replace with actual service calls
    this.teamMembers = [
      {
        employeeId: 1,
        name: 'John Doe',
        position: 'Développeur Senior',
        status: 'present',
        checkInTime: '08:30',
        checkOutTime: '17:30',
        totalHours: 8,
        lateCount: 2,
        absentCount: 1,
        averageHours: 7.8
      },
      {
        employeeId: 2,
        name: 'Jane Smith',
        position: 'Designer UI/UX',
        status: 'late',
        checkInTime: '09:45',
        totalHours: 6.5,
        lateCount: 4,
        absentCount: 0,
        averageHours: 7.5
      },
      // Add more mock data as needed
    ];

    this.filteredTeamMembers = [...this.teamMembers];
  }

  initializeCharts() {
    // Attendance Trend Chart
    this.attendanceTrendData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
      datasets: [
        {
          label: 'Présents',
          data: [12, 15, 14, 13, 15],
          borderColor: '#10B981',
          tension: 0.4
        },
        {
          label: 'Retards',
          data: [2, 1, 3, 2, 1],
          borderColor: '#F59E0B',
          tension: 0.4
        }
      ]
    };

    // Time Distribution Chart
    this.timeDistributionData = {
      labels: ['8h-9h', '9h-10h', '10h-11h', '11h-12h', '12h-13h'],
      datasets: [
        {
          label: 'Arrivées',
          data: [5, 8, 2, 1, 0],
          backgroundColor: '#3B82F6'
        }
      ]
    };

    // Common Chart Options
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    };
  }

  getPresentCount(): number {
    return this.teamMembers.filter(m => m.status === 'present').length;
  }

  getAbsentCount(): number {
    return this.teamMembers.filter(m => m.status === 'absent').length;
  }

  getLateCount(): number {
    return this.teamMembers.filter(m => m.status === 'late').length;
  }

  getOnLeaveCount(): number {
    return this.teamMembers.filter(m => m.status === 'leave').length;
  }

  filterEmployees(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredTeamMembers = this.teamMembers.filter(member =>
      member.name.toLowerCase().includes(searchTerm) ||
      member.position.toLowerCase().includes(searchTerm)
    );
  }

  filterByStatus(event: any) {
    if (!event.value) {
      this.filteredTeamMembers = [...this.teamMembers];
    } else {
      this.filteredTeamMembers = this.teamMembers.filter(member =>
        member.status === event.value
      );
    }
  }

  onDateSelect(event: Date) {
    // Implement date filtering logic
    console.log('Selected date:', event);
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
    switch (status) {
      case 'present':
        return `${baseClasses} bg-green-50 text-green-700`;
      case 'absent':
        return `${baseClasses} bg-red-50 text-red-700`;
      case 'late':
        return `${baseClasses} bg-orange-50 text-orange-700`;
      case 'leave':
        return `${baseClasses} bg-blue-50 text-blue-700`;
      default:
        return `${baseClasses} bg-gray-50 text-gray-700`;
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      present: 'Présent',
      absent: 'Absent',
      late: 'En retard',
      leave: 'En congé'
    };
    return labels[status] || status;
  }
}
