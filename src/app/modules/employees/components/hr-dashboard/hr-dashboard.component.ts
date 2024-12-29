import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/interfaces/user.interface';
import { Subscription } from 'rxjs';
import { EmployeeService } from '../../../../shared/services/employee.service';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule,
    ChartModule,
    TableModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="min-h-screen bg-gray-50/50">
      <div class="p-3 sm:p-6">
        <!-- Header -->
        <div class="mb-4 sm:mb-8">
          <h1 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Tableau de Bord RH</h1>
          <p class="text-sm sm:text-base text-gray-600 dark:text-gray-300">Vue d'ensemble de la gestion des ressources humaines</p>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 mb-4 sm:mb-8">
          <!-- Total Employees Card -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6 hover:shadow-lg transition-shadow duration-300">
            <div class="flex items-center justify-between mb-2 sm:mb-4">
              <div class="bg-blue-50 rounded-lg p-2 sm:p-3">
                <i class="pi pi-users text-blue-500 text-lg sm:text-xl"></i>
              </div>
              <span class="text-xs sm:text-sm font-medium text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                Employés
              </span>
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-gray-700 mb-1 sm:mb-2">{{employees.length}}</h3>
            <p class="text-xs sm:text-sm text-gray-500">Total Employés</p>
          </div>

          <!-- Departments Card -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6 hover:shadow-lg transition-shadow duration-300">
            <div class="flex items-center justify-between mb-2 sm:mb-4">
              <div class="bg-purple-50 rounded-lg p-2 sm:p-3">
                <i class="pi pi-briefcase text-purple-500 text-lg sm:text-xl"></i>
              </div>
              <span class="text-xs sm:text-sm font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                {{uniqueDepartments.length}} actifs
              </span>
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-gray-700 mb-1 sm:mb-2">{{uniqueDepartments.length}}</h3>
            <p class="text-xs sm:text-sm text-gray-500">Départements</p>
          </div>

          <!-- Active Employees Card -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6 hover:shadow-lg transition-shadow duration-300">
            <div class="flex items-center justify-between mb-2 sm:mb-4">
              <div class="bg-green-50 rounded-lg p-2 sm:p-3">
                <i class="pi pi-user-plus text-green-500 text-lg sm:text-xl"></i>
              </div>
              <span class="text-xs sm:text-sm font-medium text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
                Actifs
              </span>
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-gray-700 mb-1 sm:mb-2">{{activeEmployees}}</h3>
            <p class="text-xs sm:text-sm text-gray-500">Employés Actifs</p>
          </div>

          <!-- Inactive Employees Card -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6 hover:shadow-lg transition-shadow duration-300">
            <div class="flex items-center justify-between mb-2 sm:mb-4">
              <div class="bg-red-50 rounded-lg p-2 sm:p-3">
                <i class="pi pi-user-minus text-red-500 text-lg sm:text-xl"></i>
              </div>
              <span class="text-xs sm:text-sm font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Inactifs
              </span>
            </div>
            <h3 class="text-lg sm:text-xl font-bold text-gray-700 mb-1 sm:mb-2">{{inactiveEmployees}}</h3>
            <p class="text-xs sm:text-sm text-gray-500">Employés Inactifs</p>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-8">
          <!-- Department Distribution Chart -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6">
            <h3 class="text-base sm:text-lg font-semibold text-gray-700 mb-4">Distribution par Département</h3>
            <div class="h-[250px] sm:h-[300px]">
              <p-chart type="pie" [data]="departmentChartData" [options]="chartOptions"></p-chart>
            </div>
          </div>

          <!-- Status Distribution Chart -->
          <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6">
            <h3 class="text-base sm:text-lg font-semibold text-gray-700 mb-4">Distribution par Statut</h3>
            <div class="h-[250px] sm:h-[300px]">
              <p-chart type="doughnut" [data]="statusChartData" [options]="chartOptions"></p-chart>
            </div>
          </div>
        </div>

        <!-- Employees Table -->
        <div class="bg-white rounded-xl shadow-sm p-3 sm:p-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
            <h3 class="text-base sm:text-lg font-semibold text-gray-700">Liste des Employés</h3>
            <button pButton 
                    label="Ajouter un employé" 
                    icon="pi pi-plus" 
                    class="p-button-sm w-full sm:w-auto"
                    routerLink="/employees/new">
            </button>
          </div>
          
          <!-- Responsive Table Container -->
          <div class="overflow-x-auto">
            <p-table [value]="employees" 
                     [paginator]="true" 
                     [rows]="10"
                     [showCurrentPageReport]="true"
                     responsiveLayout="stack"
                     [breakpoint]="'960px'"
                     [rowHover]="true"
                     currentPageReportTemplate="Affichage {first} à {last} sur {totalRecords} employés"
                     [filterDelay]="0"
                     [globalFilterFields]="['name','email','department','position']"
                     styleClass="min-w-full">
              <ng-template pTemplate="header">
                <tr>
                  <th class="text-sm">Nom</th>
                  <th class="text-sm hidden sm:table-cell">Email</th>
                  <th class="text-sm hidden sm:table-cell">Département</th>
                  <th class="text-sm hidden sm:table-cell">Position</th>
                  <th class="text-sm">Statut</th>
                  <th class="text-sm">Actions</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-employee>
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <img [src]="employee.photoUrl || 'assets/images/default-avatar.png'" 
                           class="w-8 h-8 rounded-full object-cover"
                           [alt]="employee.name">
                      <span class="text-sm">{{employee.name}}</span>
                    </div>
                  </td>
                  <td class="hidden sm:table-cell">
                    <span class="text-sm">{{employee.email}}</span>
                  </td>
                  <td class="hidden sm:table-cell">
                    <span class="text-sm">{{employee.department}}</span>
                  </td>
                  <td class="hidden sm:table-cell">
                    <span class="text-sm">{{employee.position}}</span>
                  </td>
                  <td>
                    <span class="px-2 py-1 text-xs rounded-full inline-block"
                          [ngClass]="{
                            'bg-green-100 text-green-800': employee.status === 'active',
                            'bg-red-100 text-red-800': employee.status === 'inactive',
                            'bg-yellow-100 text-yellow-800': employee.status === 'pending'
                          }">
                      {{employee.status === 'active' ? 'Actif' : 
                        employee.status === 'inactive' ? 'Inactif' : 'En attente'}}
                    </span>
                  </td>
                  <td>
                    <button pButton 
                            icon="pi pi-eye" 
                            class="p-button-text p-button-sm"
                            [routerLink]="['/employees', employee.id]">
                    </button>
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class HrDashboardComponent implements OnInit, OnDestroy {
  employees: User[] = [];
  uniqueDepartments: string[] = [];
  activeEmployees = 0;
  inactiveEmployees = 0;
  departmentChartData: any;
  statusChartData: any;
  chartOptions: any;
  private refreshSubscription: Subscription;

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private employeeService: EmployeeService
  ) {
    this.initChartOptions();
    
    // S'abonner aux événements de rafraîchissement
    this.refreshSubscription = this.employeeService.refreshNeeded$.subscribe(() => {
      this.loadEmployees();
    });
  }

  ngOnInit() {
    this.loadEmployees();
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  private async loadEmployees() {
    try {
      // Get managed employees from AuthService with force refresh
      this.employees = await this.authService.getManagedEmployees(true);
      
      // Calculate statistics
      this.calculateStatistics();
      
      // Update charts
      this.updateCharts();
      
    } catch (error) {
      console.error('Error loading employees:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement des employés',
        life: 3000
      });
    }
  }

  private calculateStatistics() {
    // Get unique departments
    this.uniqueDepartments = [...new Set(this.employees.map(emp => emp.department))];
    
    // Count active/inactive employees
    this.activeEmployees = this.employees.filter(emp => emp.status === 'active').length;
    this.inactiveEmployees = this.employees.filter(emp => emp.status === 'inactive').length;
  }

  private updateCharts() {
    // Department distribution chart
    const departmentCounts = this.employees.reduce((acc: { [key: string]: number }, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {});

    this.departmentChartData = {
      labels: Object.keys(departmentCounts),
      datasets: [{
        data: Object.values(departmentCounts),
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FFC107',
          '#9C27B0',
          '#F44336'
        ]
      }]
    };

    // Status distribution chart
    this.statusChartData = {
      labels: ['Actifs', 'Inactifs', 'En attente'],
      datasets: [{
        data: [
          this.activeEmployees,
          this.inactiveEmployees,
          this.employees.filter(emp => emp.status === 'pending').length
        ],
        backgroundColor: [
          '#4CAF50',
          '#F44336',
          '#FFC107'
        ]
      }]
    };
  }

  private initChartOptions() {
    this.chartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }
}
