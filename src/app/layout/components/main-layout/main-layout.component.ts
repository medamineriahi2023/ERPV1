import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { trigger, state, style, animate, transition } from '@angular/animations';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SidebarComponent
  ],
  template: `
    <div class="min-h-screen flex bg-gray-50">
      <!-- Toggle Button -->
      <button 
        [@buttonSlide]="isSidebarOpen ? 'open' : 'closed'"
        (click)="toggleSidebar()"
        class="fixed top-4 z-50 p-2.5 rounded-lg bg-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl hover:bg-white focus:outline-none transform transition-all duration-500 ease-in-out hover:scale-105 opacity-50 hover:opacity-100">
        <svg xmlns="http://www.w3.org/2000/svg" 
             class="h-6 w-6 text-gray-800 transition-transform duration-500 ease-in-out"
             [class.rotate-180]="!isSidebarOpen"
             fill="none" 
             viewBox="0 0 24 24" 
             stroke="currentColor">
          <path *ngIf="!isSidebarOpen" 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M4 6h16M4 12h16M4 18h16"/>
          <path *ngIf="isSidebarOpen" 
                stroke-linecap="round" 
                stroke-linejoin="round" 
                stroke-width="2" 
                d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Overlay when sidebar is open on mobile -->
      <div *ngIf="isSidebarOpen" 
           class="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-500 ease-in-out lg:hidden"
           (click)="toggleSidebar()">
      </div>

      <!-- Sidebar -->
      <div [@sidebarSlide]="isSidebarOpen ? 'open' : 'closed'"
           class="fixed left-0 top-0 h-full bg-white shadow-2xl z-40">
        <app-sidebar></app-sidebar>
      </div>

      <!-- Main Content -->
      <main [@mainContentSlide]="isSidebarOpen ? 'open' : 'closed'"
            class="flex-1 min-h-screen transition-all duration-500 ease-in-out">
        <div class="p-6 transition-all duration-500">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow-x: hidden;
    }

    :host ::ng-deep app-sidebar {
      width: 16rem;
      height: 100%;
    }
  `],
  animations: [
    trigger('buttonSlide', [
      state('open', style({
        left: '16rem'
      })),
      state('closed', style({
        left: '1rem'
      })),
      transition('open <=> closed', [
        animate('500ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ]),
    trigger('sidebarSlide', [
      state('open', style({
        transform: 'translateX(0)',
        opacity: 1
      })),
      state('closed', style({
        transform: 'translateX(-100%)',
        opacity: 0.5
      })),
      transition('open <=> closed', [
        animate('500ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ]),
    trigger('mainContentSlide', [
      state('open', style({
        marginLeft: '16rem'
      })),
      state('closed', style({
        marginLeft: '0'
      })),
      transition('open <=> closed', [
        animate('500ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ])
  ]
})
export class MainLayoutComponent {
  isSidebarOpen = true;

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }
}
