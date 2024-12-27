import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/interfaces/user.interface';

@Component({
  selector: 'app-employees-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TableModule,
    ButtonModule,
    ToastModule,
    InputTextModule,
    DropdownModule
  ],
  template: `
    <div class="min-h-screen bg-gray-50/50">
      <div class="p-6">
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">Mes Employés</h1>
            <p class="text-gray-600 mt-1">Gérez vos employés et leurs informations</p>
          </div>
          
          <div class="flex gap-3">
            <button *ngIf="isManager" pButton 
                    class="p-button-primary shadow-sm"
                    icon="pi pi-chart-pie" 
                    label="Tableau de bord" 
                    routerLink="/employees/dashboard">
            </button>
            <button *ngIf="isManager" pButton 
                    class="p-button-success shadow-sm"
                    icon="pi pi-plus" 
                    label="Ajouter un employé" 
                    routerLink="/employees/add">
            </button>
            <button pButton 
                    class="p-button-info shadow-sm"
                    icon="pi pi-refresh" 
                    label="Rafraîchir" 
                    (click)="refreshList()">
            </button>
          </div>
        </div>

        <!-- Filters Section -->
        <div class="bg-white rounded-xl shadow-sm">
          <div class="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h3 class="text-lg font-semibold text-gray-800">Filtres</h3>
          </div>
          
          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Search Input -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="pi pi-search text-gray-400"></i>
                  </div>
                  <input type="text" 
                         pInputText 
                         class="block w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                         placeholder="Nom, email, département..."
                         (input)="filterEmployees($event)">
                </div>
              </div>

              <!-- Department Filter -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Département</label>
                <p-dropdown [options]="departments"
                          placeholder="Tous les départements"
                          styleClass="w-full !border-gray-200 !rounded-lg !shadow-none"
                          [style]="{'height': '42px'}"
                          [panelStyle]="{'z-index': '9999'}"
                          appendTo="body"
                          (onChange)="filterByDepartment($event)">
                  <ng-template let-dept pTemplate="item">
                    <div class="flex items-center py-1">
                      <i class="pi pi-briefcase mr-2 text-gray-500"></i>
                      <span>{{dept.label}}</span>
                    </div>
                  </ng-template>
                </p-dropdown>
              </div>

              <!-- Status Filter -->
              <div class="relative">
                <label class="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <p-dropdown [options]="[
                             {label: 'Tous les statuts', value: ''},
                             {label: 'Actif', value: 'active'},
                             {label: 'Inactif', value: 'inactive'}
                           ]"
                          placeholder="Tous les statuts"
                          styleClass="w-full !border-gray-200 !rounded-lg !shadow-none"
                          [style]="{'height': '42px'}"
                          [panelStyle]="{'z-index': '9999'}"
                          appendTo="body"
                          (onChange)="filterByStatus($event)">
                  <ng-template let-status pTemplate="item">
                    <div class="flex items-center py-1">
                      <span class="w-2 h-2 rounded-full mr-2"
                            [ngClass]="{
                              'bg-green-500': status.value === 'active',
                              'bg-red-500': status.value === 'inactive',
                              'bg-gray-300': !status.value
                            }"></span>
                      <span>{{status.label}}</span>
                    </div>
                  </ng-template>
                </p-dropdown>
              </div>
            </div>
          </div>
        </div>

        <!-- Employee Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div *ngFor="let employee of filteredEmployees" 
               class="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
            <!-- Card Header -->
            <div class="p-4 border-b border-gray-100">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-lg">
                  {{employee?.firstName ? employee.firstName.charAt(0) : '?'}}
                </div>
                <div class="flex-1">
                  <h3 class="text-lg font-semibold text-gray-800">
                    {{(employee?.firstName || '') + ' ' + (employee?.lastName || '') || 'Sans nom'}}
                  </h3>
                  <p class="text-sm text-gray-600">{{employee?.position || 'Position non définie'}}</p>
                </div>
                <span [class]="employee?.status === 'active' ? 
                  'px-2 py-1 text-xs rounded-full bg-green-50 text-green-600' : 
                  'px-2 py-1 text-xs rounded-full bg-red-50 text-red-600'">
                  {{employee?.status === 'active' ? 'Actif' : 'Inactif'}}
                </span>
              </div>
            </div>

            <!-- Card Body -->
            <div class="p-4 space-y-4">
              <!-- Department -->
              <div class="flex items-center gap-2">
                <i class="pi pi-briefcase text-gray-400"></i>
                <span class="text-sm text-gray-600">{{employee?.department || 'Département non défini'}}</span>
              </div>

              <!-- Email -->
              <div class="flex items-center gap-2">
                <i class="pi pi-envelope text-gray-400"></i>
                <span class="text-sm text-gray-600">{{employee?.email || 'Email non défini'}}</span>
              </div>

              <!-- Hire Date -->
              <div class="flex items-center gap-2">
                <i class="pi pi-calendar text-gray-400"></i>
                <span class="text-sm text-gray-600">Embauché le {{employee?.hireDate | date:'dd/MM/yyyy'}}</span>
              </div>

              <!-- Leave Balance -->
              <div class="grid grid-cols-2 gap-2 mt-4">
                <div class="text-center p-2 bg-green-50 rounded-lg">
                  <p class="text-xs text-gray-600">Congés annuels</p>
                  <p class="text-lg font-semibold text-green-600">{{employee?.leaveBalance?.annual || 0}}</p>
                </div>
                <div class="text-center p-2 bg-orange-50 rounded-lg">
                  <p class="text-xs text-gray-600">Congés maladie</p>
                  <p class="text-lg font-semibold text-orange-600">{{employee?.leaveBalance?.sick || 0}}</p>
                </div>
              </div>
            </div>

            <!-- Card Footer -->
            <div class="p-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
              <div class="flex justify-between gap-2">
                <button pButton 
                        class="p-button-text p-button-info flex-1"
                        icon="pi pi-user" 
                        label="Profil"
                        [routerLink]="['/employees', employee?.id]">
                </button>
                <button pButton 
                        class="p-button-text p-button-success flex-1"
                        icon="pi pi-chart-line" 
                        label="Performance"
                        [routerLink]="['/employees', employee?.id, 'reviews']">
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="filteredEmployees.length === 0" 
             class="text-center py-12 bg-white rounded-xl shadow-sm">
          <i class="pi pi-search text-4xl text-gray-400 mb-4"></i>
          <h3 class="text-xl font-semibold text-gray-800 mb-2">Aucun employé trouvé</h3>
          <p class="text-gray-600">Modifiez vos filtres ou ajoutez de nouveaux employés</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .p-button {
        border-radius: 0.5rem;
      }

      .p-button.p-button-text:enabled:hover {
        background: rgba(59, 130, 246, 0.1);
      }

      .p-dropdown {
        border-radius: 0.5rem;
        .p-dropdown-label {
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
    }
  `]
})
export class EmployeesListComponent implements OnInit {
  employees: Omit<User, 'password'>[] = [];
  filteredEmployees: Omit<User, 'password'>[] = [];
  isManager = false;
  departments: any[] = [];

  constructor(
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    await this.loadEmployees();
  }

  async loadEmployees() {
    try {
      this.isManager = this.authService.isManager();
      if (this.isManager) {
        // Force a fresh fetch of managed employees
        this.employees = await this.authService.getManagedEmployees(true);
        this.filteredEmployees = [...this.employees];
        this.departments = [...new Set(this.employees.map(emp => emp.department))]
          .map(dept => ({ label: dept, value: dept }));
      } else {
        const currentUser = this.authService.getCurrentUser();
        if (currentUser) {
          this.employees = [currentUser];
          this.filteredEmployees = [currentUser];
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger la liste des employés'
      });
    }
  }

  async refreshList() {
    await this.loadEmployees();
    this.messageService.add({
      severity: 'success',
      summary: 'Succès',
      detail: 'Liste des employés mise à jour'
    });
  }

  filterEmployees(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.filteredEmployees = this.employees.filter(emp => 
      (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(searchTerm) ||
      emp.email.toLowerCase().includes(searchTerm) ||
      emp.department.toLowerCase().includes(searchTerm)
    );
  }

  filterByDepartment(event: any) {
    if (!event.value) {
      this.filteredEmployees = [...this.employees];
    } else {
      this.filteredEmployees = this.employees.filter(emp => 
        emp.department === event.value
      );
    }
  }

  filterByStatus(event: any) {
    if (!event.value) {
      this.filteredEmployees = [...this.employees];
    } else {
      this.filteredEmployees = this.employees.filter(emp => 
        emp.status === event.value
      );
    }
  }
}
