import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { Employee } from '../../../../shared/services/employee.service';
import { EmployeeFormComponent } from '../employee-form/employee-form.component';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ApiService } from '../../../../core/services/api.service';
import { User } from '../../../../core/interfaces/user.interface';

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
      <div class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p-breadcrumb [model]="breadcrumbItems" [home]="homeItem" styleClass="border-none p-0 text-sm"></p-breadcrumb>
        </div>
      </div>
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p-toast></p-toast>
        <p-card>
          <app-employee-form (cancel)="onCancel()"></app-employee-form>
        </p-card>
      </div>
    </div>
  `
})
export class AddEmployeeComponent implements OnInit {
  breadcrumbItems: MenuItem[] = [];
  homeItem: MenuItem;

  constructor(
    private router: Router,
  ) {
    this.homeItem = { icon: 'pi pi-home', routerLink: '/' };
  }

  ngOnInit() {
    this.breadcrumbItems = [
      { label: 'Employés', routerLink: '/employees' },
      { label: 'Ajouter un employé' }
    ];
  }


  onCancel(): void {
    this.router.navigate(['/employees']);
  }
}
