import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DemandeCongeComponent } from './components/demande-conge/demande-conge.component';
import { ValidationCongeComponent } from './components/validation-conge/validation-conge.component';

const routes: Routes = [
  {
    path: '',
    children: [

      {
        path: 'demande',
        component: DemandeCongeComponent
      },
      {
        path: 'request',
        component: DemandeCongeComponent
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
