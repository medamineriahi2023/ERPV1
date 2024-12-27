import { Routes } from '@angular/router';
import { EmployeeDashboardComponent } from './components/employee-dashboard/employee-dashboard.component';
import { EmployeeDetailComponent } from './components/employee-detail/employee-detail.component';
import { PerformanceReviewComponent } from './components/performance-review/performance-review.component';
import { TrainingComponent } from './components/training/training.component';
import { EmployeesListComponent } from './components/employees-list/employees-list.component';
import { AddEmployeeComponent } from './components/add-employee/add-employee.component';
import { HrDashboardComponent } from './components/hr-dashboard/hr-dashboard.component';
import { ManagerGuard } from '../../core/guards/manager.guard';

export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        component: EmployeesListComponent
      },
      {
        path: 'dashboard',
        component: HrDashboardComponent,
        canActivate: [ManagerGuard]
      },
      {
        path: 'add',
        component: AddEmployeeComponent,
        canActivate: [ManagerGuard]
      },
      {
        path: 'reviews',
        component: PerformanceReviewComponent
      },
      {
        path: 'trainings',
        component: TrainingComponent
      },
      {
        path: ':id',
        component: EmployeeDetailComponent
      },
      {
        path: ':id/reviews',
        component: PerformanceReviewComponent
      },
      {
        path: ':id/trainings',
        component: TrainingComponent
      }
    ]
  }
];
