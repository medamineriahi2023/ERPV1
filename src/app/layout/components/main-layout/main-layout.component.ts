import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent
  ],
  template: `
    <div class="min-h-screen flex relative lg:static surface-ground">
      <app-sidebar></app-sidebar>
      <div class="min-h-screen flex flex-column relative flex-auto">
        <div class="flex flex-column flex-auto">
          <div class="flex-auto p-4">
            <router-outlet></router-outlet>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MainLayoutComponent {}
