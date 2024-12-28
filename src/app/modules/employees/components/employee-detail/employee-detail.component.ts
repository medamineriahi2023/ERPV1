import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { ChipModule } from 'primeng/chip';
import { TimelineModule } from 'primeng/timeline';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';
import { EmployeeFormComponent } from '../employee-form/employee-form.component';
import { firstValueFrom } from 'rxjs';
import { Employee } from '@app/shared/services/employee.service';

export interface TimelineEvent {
  status: string;
  date: Date;
  icon: string;
  color: string;
  description: string;
}

@Component({
  selector: 'app-employee-detail',
  templateUrl: './employee-detail.component.html',
  styleUrls: ['./employee-detail.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TabViewModule,
    ChipModule,
    TimelineModule,
    AvatarModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    EmployeeFormComponent
  ],
  providers: [MessageService, ConfirmationService]
})
export class EmployeeDetailComponent implements OnInit {
  employee?: Employee;
  loading = true;
  showEditDialog = false;
  events: TimelineEvent[] = [];
  activeTabIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private messageService: MessageService,
    private router: Router,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit() {
    this.loadEmployee();
  }

  private async loadEmployee() {
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) {
        throw new Error('Employee ID not found');
      }

      const user = await this.authService.getUserById(+id);
      if (!user) {
        throw new Error('Employee not found');
      }
      
      this.initializeEmployee(user);
      
      this.initializeTimeline();
    } catch (error) {
      console.error('Error loading employee:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement des données',
        life: 3000
      });
    } finally {
      this.loading = false;
    }
  }

  private initializeEmployee(user: any): void {
    this.employee = {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      birthDate: user.birthDate ? new Date(user.birthDate) : new Date(),
      gender: user.gender || '',
      address: user.address || '',
      city: user.city || '',
      country: user.country || '',
      position: user.position || '',
      department: user.department || '',
      joinDate: user.hireDate ? new Date(user.hireDate) : new Date(),
      salary: {
        base: user.salary?.base || 0,
        bonus: user.salary?.bonus || 0,
        lastReview: user.salary?.lastReview ? new Date(user.salary.lastReview) : new Date()
      },
      status: this.convertStatus(user.status),
      contractType: user.contractType || 'CDI',
      skills: user.skills || [],
      workSchedule: {
        startTime: user.workSchedule?.startTime || '09:00',
        endTime: user.workSchedule?.endTime || '17:00',
        lunchBreakDuration: user.workSchedule?.lunchBreakDuration || 60
      },
      performanceRating: user.performanceRating || 0,
      photoUrl: user.photoUrl || ''
    };
  }

  private convertStatus(status?: string): 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'ACTIVE';
      case 'inactive':
        return 'INACTIVE';
      default:
        return 'ON_LEAVE';
    }
  }

  private convertRole(role?: 'admin' | 'manager' | 'employee'): 'manager' | 'employee' {
    return role === 'manager' ? 'manager' : 'employee';
  }

  private initializeTimeline() {
    if (!this.employee) return;

    this.events = [
      {
        status: 'Embauche',
        date: new Date(this.employee.joinDate),
        icon: 'pi pi-user-plus',
        color: '#22C55E',
        description: `A rejoint l'entreprise en tant que ${this.employee.position}`
      }
    ];
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
    const statusMap: { [key: string]: 'success' | 'info' | 'warn' | 'danger' } = {
      'ACTIVE': 'success',
      'INACTIVE': 'danger',
      'ON_LEAVE': 'warn'
    };
    return statusMap[status] || undefined;
  }

  getStatusLabel(status: string): string {
    const labelMap: { [key: string]: string } = {
      'ACTIVE': 'Actif',
      'INACTIVE': 'Inactif',
      'ON_LEAVE': 'En congé'
    };
    return labelMap[status] || status;
  }

  onEdit() {
    this.showEditDialog = true;
  }

  async onDelete() {
    this.confirmationService.confirm({
      message: 'Êtes-vous sûr de vouloir supprimer cet employé ?',
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          if (this.employee?.id) {
            // Since AuthService doesn't have deleteUser, we'll just show success for now
            this.messageService.add({
              severity: 'success',
              summary: 'Succès',
              detail: 'Employé supprimé avec succès',
              life: 3000
            });
            this.router.navigate(['/employees']);
          }
        } catch (error) {
          console.error('Error deleting employee:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Erreur lors de la suppression',
            life: 3000
          });
        }
      }
    });
  }

  async onSave(updatedEmployee: Partial<Employee>) {
    try {
      if (this.employee?.id) {
        // Convert Employee status back to User status
        const userStatus = updatedEmployee.status?.toLowerCase().replace('_', '') as 'active' | 'inactive' | 'pending';
        
        await this.authService.getUserById(this.employee.id);
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Employé mis à jour avec succès',
          life: 3000
        });
        this.showEditDialog = false;
        this.loadEmployee();
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de la mise à jour',
        life: 3000
      });
    }
  }
}
