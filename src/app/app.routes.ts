import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { ManagerGuard } from './core/guards/manager.guard';
import { LoginComponent } from './modules/auth/components/login/login.component';
import { MainLayoutComponent } from './layout/components/main-layout/main-layout.component';
import { AddEmployeeComponent } from './modules/employees/components/add-employee/add-employee.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      // Manager-only routes
      {
        path: 'employees',
        canActivate: [ManagerGuard],
        loadChildren: () => import('./modules/employees/employees.routes').then(m => m.EMPLOYEES_ROUTES)
      },
      {
        path: 'employees/add',
        canActivate: [ManagerGuard],
        component: AddEmployeeComponent
      },
      {
        path: 'conge/validation',
        canActivate: [ManagerGuard],
        loadComponent: () => import('./modules/conge/components/validation-conge/validation-conge.component')
          .then(m => m.ValidationCongeComponent)
      },
      {
        path: 'conge/request',
        loadComponent: () => import('./modules/conge/components/demande-conge/demande-conge.component')
          .then(m => m.DemandeCongeComponent)
      },
      {
        path: 'conge/history',
        loadComponent: () => import('./modules/conge/components/historique-conge/historique-conge.component')
            .then(m => m.HistoriqueCongeComponent)
      },
      {
        path: 'conge/history',
        loadComponent: () => import('./modules/conge/components/historique-conge/historique-conge.component')
            .then(m => m.HistoriqueCongeComponent)
      },
      {
        path: 'pointage',
        loadComponent: () => import('./modules/pointage/components/pointage/pointage.component')
          .then(m => m.PointageComponent)
      },

      // Default route
      {
        path: '',
        redirectTo: 'pointage',
        pathMatch: 'full'
      }
    ]
  },
  // Catch-all route
  {
    path: '**',
    redirectTo: ''
  }
];
