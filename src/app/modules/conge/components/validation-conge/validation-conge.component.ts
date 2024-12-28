// noinspection JSUnusedGlobalSymbols

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
import {Ripple} from "primeng/ripple";
import {InputTextarea} from "primeng/inputtextarea";

export interface CongeWithEmployee extends CongeRequest {
  employee?: Employee;
}

// noinspection JSUnusedGlobalSymbols
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
  currentUser: any;
  managedEmployees: number[] = [];

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

  ngOnInit() {
    this.getCurrentUserAndEmployees();
  }

  private async getCurrentUserAndEmployees() {
    try {
      // Get current user and their managed employees
      this.currentUser = await this.authService.getCurrentUser();
      const managedEmployees = await this.authService.getManagedEmployees();
      this.managedEmployees = managedEmployees.map(emp => emp.id);
      
      // Load leave requests only after we have the managed employees list
      await this.loadConges();
    } catch (error) {
      console.error('Error getting current user or managed employees:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement des informations utilisateur',
        life: 3000
      });
    }
  }

  async loadConges() {
    this.loading = true;
    try {
      // Get all leave requests
      const allConges = await firstValueFrom(this.congeService.getCongeRequests());
      
      // Filter requests to only include those from managed employees
      const filteredConges = allConges.filter(conge => 
        this.managedEmployees.includes(conge.employeeId)
      );

      // Get unique employee IDs from the filtered requests
      const employeeIds = [...new Set(filteredConges.map(c => c.employeeId))];
      
      // Fetch employee details
      const employees = await Promise.all(
        employeeIds.map(id => firstValueFrom(this.employeeService.getEmployee(id)))
      );

      // Combine leave requests with employee details
      this.conges = filteredConges.map(conge => ({
        ...conge,
        employee: employees.find(e => e?.id === conge.employeeId)
      }));

      // Sort by date, with most recent first
      this.conges.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Error loading conges:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement des demandes',
        life: 3000
      });
    } finally {
      this.loading = false;
    }
  }

  approveConge(conge: CongeWithEmployee) {
    this.selectedConge = conge;
    this.showApprovalDialog = true;
  }

  confirmApproval() {
    if (!this.selectedConge) return;

    const updates: Partial<CongeRequest> = {
      status: 'APPROUVE',
      approverComment: this.approverComment,
      updatedAt: new Date().toISOString()
    };

    this.congeService.updateCongeRequest(this.selectedConge.id, updates).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Demande approuvée avec succès',
          life: 3000
        });
        this.loadConges();
        this.hideDialog();
      },
      error: (error) => {
        console.error('Error approving conge:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors de l\'approbation',
          life: 3000
        });
      }
    });
  }


  confirmRejection() {
    if (!this.selectedConge) return;

    const updates: Partial<CongeRequest> = {
      status: 'REFUSE',
      approverComment: this.approverComment,
      updatedAt: new Date().toISOString()
    };

    this.congeService.updateCongeRequest(this.selectedConge.id, updates).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Demande rejetée avec succès',
          life: 3000
        });
        this.loadConges();
        this.hideDialog();
      },
      error: (error) => {
        console.error('Error rejecting conge:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors du rejet',
          life: 3000
        });
      }
    });
  }

  hideDialog() {
    this.showApprovalDialog = false;
    this.selectedConge = undefined;
    this.approverComment = '';
  }


  getStatusLabel(status: string): string {
    switch (status) {
      case 'APPROUVE':
        return 'Approuvé';
      case 'REFUSE':
        return 'Refusé';
      case 'EN_ATTENTE':
        return 'En attente';
      default:
        return status;
    }
  }

  isUrgent(conge: CongeRequest): boolean {
    const startDate = new Date(conge.startDate);
    const today = new Date();
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3 || conge.urgencyLevel === 'URGENT';
  }

  getTypeLabel(type: string): string {
    const option = this.typeOptions.find(t => t.value === type);
    return option ? option.label : type;
  }

  getTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
    switch (type) {
      case 'CONGE_PAYE':
        return 'success';
      case 'MALADIE':
        return 'danger';
      case 'SANS_SOLDE':
        return 'warn';
      case 'FORMATION':
        return 'info';
      default:
        return undefined;
    }
  }



  calculateDaysUntilStart(startDate: string): number {
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = start.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | undefined {
    switch (status) {
      case 'APPROUVE':
        return 'success';
      case 'REFUSE':
        return 'danger';
      case 'EN_ATTENTE':
        return 'warn';
      default:
        return undefined;
    }
  }
}
