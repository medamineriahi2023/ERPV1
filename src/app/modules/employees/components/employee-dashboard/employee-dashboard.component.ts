import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { AvatarModule } from 'primeng/avatar';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { EmployeeService, Employee, EmployeeStats, CreateEmployeeDto } from '../../../../shared/services/employee.service';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CardModule,
    ChartModule,
    AvatarModule,
    TagModule,
    ToastModule,
    DialogModule
  ],
  templateUrl: './employee-dashboard.component.html',
  providers: [MessageService]
})
export class EmployeeDashboardComponent implements OnInit {
  employees: Employee[] = [];
  stats: EmployeeStats | null = null;
  loading = true;

  // Charts data
  departmentChart: any;
  contractTypeChart: any;
  performanceChart: any;


  constructor(
    private employeeService: EmployeeService,
    private messageService: MessageService,
  ) {}

  ngOnInit() {
    this.loadEmployees();
    this.loadStats();
  }

  private loadEmployees() {
    this.loading = true;
    this.employeeService.getEmployees().subscribe({
      next: (employees) => {
        this.employees = employees;
        this.loading = false;
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger les employés'
        });
        this.loading = false;
      }
    });
  }

  private loadStats() {
    this.employeeService.getEmployeeStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.initializeCharts();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger les statistiques'
        });
      }
    });
  }

  private initializeCharts() {
    if (!this.stats) return;

    // Department distribution chart
    const departmentLabels = Object.keys(this.stats.departmentDistribution);
    const departmentData = Object.values(this.stats.departmentDistribution);

    this.departmentChart = {
      labels: departmentLabels,
      datasets: [
        {
          data: departmentData,
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF'
          ]
        }
      ]
    };

    // Contract type distribution chart
    const contractLabels = Object.keys(this.stats.contractTypeDistribution);
    const contractData = Object.values(this.stats.contractTypeDistribution);

    this.contractTypeChart = {
      labels: contractLabels,
      datasets: [
        {
          data: contractData,
          backgroundColor: [
            '#4BC0C0',
            '#FF6384',
            '#36A2EB',
            '#FFCE56'
          ]
        }
      ]
    };

    // Performance distribution chart
    this.performanceChart = {
      labels: ['1-2', '2-3', '3-4', '4-5'],
      datasets: [
        {
          label: 'Nombre d\'employés',
          data: [
            this.employees.filter(e => e.performanceRating && e.performanceRating < 2).length,
            this.employees.filter(e => e.performanceRating && e.performanceRating >= 2 && e.performanceRating < 3).length,
            this.employees.filter(e => e.performanceRating && e.performanceRating >= 3 && e.performanceRating < 4).length,
            this.employees.filter(e => e.performanceRating && e.performanceRating >= 4).length
          ],
          backgroundColor: '#36A2EB'
        }
      ]
    };
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'danger';
      case 'ON_LEAVE': return 'info';
      case 'PENDING': return 'warn';
      default: return 'info';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'Actif';
      case 'INACTIVE':
        return 'Inactif';
      case 'ON_LEAVE':
        return 'En congé';
      default:
        return status;
    }
  }
}
