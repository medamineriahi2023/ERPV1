import { Component, OnInit } from '@angular/core';
import { CongeService, CongeRequest } from '../../../../shared/services/conge.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { DatePipe, CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { EmployeeService, Employee } from '../../../../shared/services/employee.service';
import { firstValueFrom } from 'rxjs';
import { Ripple } from "primeng/ripple";
import { InputTextarea } from "primeng/inputtextarea";

interface User {
  id: number;
  managerId?: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface CongeWithEmployee extends CongeRequest {
  employee?: Employee;
}

@Component({
  selector: 'app-validation-conge',
  templateUrl: './validation-conge.component.html',
  styleUrls: ['./validation-conge.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    TagModule,
    TableModule,
    DatePipe,
    ToastModule,
    ConfirmDialogModule,
    InputTextModule,
    Ripple,
    InputTextarea
  ],
  providers: [MessageService]
})
export class ValidationCongeComponent implements OnInit {
  conges: CongeWithEmployee[] = [];
  loading = false;
  searchTerm = '';
  selectedConge?: CongeWithEmployee;
  showApprovalDialog = false;
  approverComment = '';
  currentUser: User | null = null;

  typeOptions = [
    { label: 'Congé payé', value: 'CONGE_PAYE' },
    { label: 'Maladie', value: 'MALADIE' },
    { label: 'Sans solde', value: 'SANS_SOLDE' },
    { label: 'Formation', value: 'FORMATION' },
    { label: 'Autre', value: 'AUTRE' }
  ];

  statusOptions = [
    { label: 'En attente', value: 'EN_ATTENTE' },
    { label: 'Approuvé', value: 'APPROUVE' },
    { label: 'Refusé', value: 'REFUSE' }
  ];

  constructor(
    private congeService: CongeService,
    private employeeService: EmployeeService,
    private messageService: MessageService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      const user = await firstValueFrom(this.authService.currentUser$);
      if (!user) {
        throw new Error('No user logged in');
      }
      
      const requests = await firstValueFrom(this.congeService.getCongeRequests());
      this.conges = requests.filter(request => request.managerId === user.id);

      for (const request of this.conges) {
        const employee = await firstValueFrom(this.employeeService.getEmployee(request.employeeId));
        if (employee) {
          request.employee = employee;
        }
      }
    } catch (error) {
      console.error('Error loading conge requests:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load leave requests'
      });
    }
  }

  approveConge(conge: CongeWithEmployee) {
    this.selectedConge = conge;
    this.showApprovalDialog = true;
  }

  async confirmApproval() {
    if (!this.selectedConge) return;

    try {
      if (!this.currentUser?.id) {
        throw new Error('Utilisateur non connecté');
      }

      if (this.selectedConge.managerId !== this.currentUser.id) {
        throw new Error('Non autorisé à approuver cette demande');
      }

      await firstValueFrom(this.congeService.updateCongeRequest(this.selectedConge.id, {
        status: 'APPROUVE',
        approverComment: this.approverComment,
        updatedAt: new Date().toISOString()
      }));

      this.messageService.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Demande de congé approuvée'
      });

      await this.ngOnInit();
      this.hideDialog();
    } catch (error) {
      console.error('Error approving leave:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de l\'approbation de la demande'
      });
    }
  }

  async confirmRejection() {
    if (!this.selectedConge) return;

    try {
      if (!this.currentUser?.id) {
        throw new Error('Utilisateur non connecté');
      }

      if (this.selectedConge.managerId !== this.currentUser.id) {
        throw new Error('Non autorisé à rejeter cette demande');
      }

      await firstValueFrom(this.congeService.updateCongeRequest(this.selectedConge.id, {
        status: 'REFUSE',
        approverComment: this.approverComment,
        updatedAt: new Date().toISOString()
      }));

      this.messageService.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Demande de congé refusée'
      });

      await this.ngOnInit();
      this.hideDialog();
    } catch (error) {
      console.error('Error rejecting leave:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du rejet de la demande'
      });
    }
  }

  hideDialog() {
    this.showApprovalDialog = false;
    this.selectedConge = undefined;
    this.approverComment = '';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'APPROUVE':
        return 'Approuvé';
      case 'REFUSE':
        return 'Refusé';
      default:
        return status;
    }
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    switch (status) {
      case 'EN_ATTENTE':
        return 'warn';
      case 'APPROUVE':
        return 'success';
      case 'REFUSE':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  calculateDaysUntilStart(startDate: string): number {
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = start.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
