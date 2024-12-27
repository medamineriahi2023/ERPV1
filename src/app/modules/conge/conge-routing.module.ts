import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardCongeComponent } from './components/dashboard-conge/dashboard-conge.component';
import { DemandeCongeComponent } from './components/demande-conge/demande-conge.component';
import { CalendrierCongeComponent } from './components/calendrier-conge/calendrier-conge.component';
import { ValidationCongeComponent } from './components/validation-conge/validation-conge.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'dashboard',
        component: DashboardCongeComponent
      },
      {
        path: 'demande',
        component: DemandeCongeComponent
      },
      {
        path: 'request',
        component: DemandeCongeComponent
      },
      {
        path: 'calendrier',
        component: CalendrierCongeComponent
      },
      {
        path: 'validation',
        component: ValidationCongeComponent
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CongeRoutingModule { }
