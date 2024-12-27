import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EmployeeDashboardComponent } from './components/employee-dashboard/employee-dashboard.component';
import { EmployeeDetailComponent } from './components/employee-detail/employee-detail.component';
import { PerformanceReviewComponent } from './components/performance-review/performance-review.component';
import { TrainingComponent } from './components/training/training.component';

const routes: Routes = [
  {
    path: 'reviews',
    component: PerformanceReviewComponent
  },
  {
    path: 'trainings',
    component: TrainingComponent
  },
  {
    path: ':id/reviews',
    component: PerformanceReviewComponent
  },
  {
    path: ':id/trainings',
    component: TrainingComponent
  },
  {
    path: ':id',
    component: EmployeeDetailComponent
  },
  {
    path: '',
    component: EmployeeDashboardComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmployeesRoutingModule { }
