import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { Employee, EmployeeService, CreateEmployeeDto } from '../../../../shared/services/employee.service';
import { EmployeeFormComponent } from '../employee-form/employee-form.component';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-add-employee',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    CardModule,
    ButtonModule,
    EmployeeFormComponent,
    BreadcrumbModule
  ],
  providers: [MessageService],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <!-- Navigation Breadcrumb -->
      <div class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p-breadcrumb [model]="breadcrumbItems" [home]="homeItem" styleClass="border-none p-0 text-sm"></p-breadcrumb>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="max-w-4xl mx-auto">
          <!-- Header Section -->
          <div class="mb-8 text-center sm:text-left">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="mb-4 sm:mb-0">
                <h1 class="text-3xl font-bold text-gray-900 mb-2">Ajouter un Employé</h1>
                <p class="text-sm text-gray-600 max-w-2xl">
                  Créez un nouveau profil d'employé en remplissant les informations ci-dessous. Tous les champs marqués d'un astérisque (*) sont obligatoires.
                </p>
              </div>
              <button pButton
                      icon="pi pi-arrow-left"
                      label="Retour"
                      class="p-button-outlined p-button-secondary"
                      (click)="onCancel()">
              </button>
            </div>
          </div>

          <!-- Form Section -->
          <p-card styleClass="shadow-sm border-0 rounded-xl">
            <div class="p-fluid">
              <app-employee-form
                (save)="onSave($event)"
                (cancel)="onCancel()">
              </app-employee-form>
            </div>
          </p-card>

          <!-- Help Section -->
          <div class="mt-8 bg-blue-50 rounded-lg p-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <i class="pi pi-info-circle text-blue-500 text-xl"></i>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-blue-800">Besoin d'aide ?</h3>
                <div class="mt-2 text-sm text-blue-700">
                  <p>
                    Si vous avez des questions sur l'ajout d'un employé ou si vous rencontrez des difficultés,
                    n'hésitez pas à contacter le support RH.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <p-toast position="top-right"></p-toast>
  `,
  styles: [`
    :host ::ng-deep {
      .p-card {
        border-radius: 1rem;
        background: white;
        transition: all 0.3s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      }

      .p-card .p-card-content {
        padding: 1.5rem;
      }

      .p-button {
        border-radius: 0.5rem;
        transition: all 0.2s ease;

        &:hover {
          transform: translateY(-1px);
        }
      }

      .p-breadcrumb {
        background: transparent;
        border: none;
        padding: 0;

        .p-menuitem-link {
          &:hover {
            background: transparent;
            .p-menuitem-text {
              color: var(--primary-color);
            }
          }
        }
      }

      .p-toast {
        .p-toast-message {
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
      }
    }
  `]
})
export class AddEmployeeComponent {
  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem = { icon: 'pi pi-home', routerLink: '/' };

  constructor(
    private employeeService: EmployeeService,
    private messageService: MessageService,
    private router: Router
  ) {
    this.initializeBreadcrumb();
  }

  private initializeBreadcrumb() {
    this.breadcrumbItems = [
      { label: 'Employés', routerLink: '/employees' },
      { label: 'Ajouter un employé' }
    ];
  }

  async onSave(employeeData: Partial<Employee>) {
    const createEmployeeDto: CreateEmployeeDto = {
      firstName: employeeData.firstName || '',
      lastName: employeeData.lastName || '',
      email: employeeData.email || '',
      phone: employeeData.phone || '',
      birthDate: employeeData.birthDate || '',
      address: employeeData.address || '',
      position: employeeData.position || '',
      department: employeeData.department || '',
      joinDate: employeeData.joinDate || new Date().toISOString(),
      status: employeeData.status || 'ACTIVE',
      contractType: employeeData.contractType || 'CDI',
      avatar: employeeData.avatar || '',
      skills: employeeData.skills || [],
      salary: {
        base: employeeData.salary?.base || 0,
        bonus: employeeData.salary?.bonus || 0,
        lastReview: employeeData.salary?.lastReview || new Date().toISOString()
      },
      performanceRating: employeeData.performanceRating || 0,
      role: employeeData.role || 'employee',
      username: employeeData.email?.split('@')[0] || '',
      password: 'defaultPassword123',
      managerId: employeeData.managerId || null,
      managedEmployees: employeeData.managedEmployees || []
    };

    try {
      // Souscription à l'Observable
      this.employeeService.createEmployee(createEmployeeDto).subscribe({
        next: (newEmployee) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Employé ajouté avec succès',
            life: 3000
          });
          
          // Rafraîchir la liste des employés
          this.employeeService.refreshEmployeeList();
          
          // Rediriger vers la page de détails
          this.router.navigate(['/employees', newEmployee.id]);
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Erreur lors de l\'ajout de l\'employé',
            life: 3000
          });
          console.error('Error creating employee:', error);
        }
      });
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de l\'ajout de l\'employé',
        life: 3000
      });
      console.error('Error creating employee:', error);
    }
  }

  onCancel() {
    this.router.navigate(['/employees']);
  }
}
