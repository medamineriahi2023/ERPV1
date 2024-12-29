import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { ProgressBarModule } from 'primeng/progressbar';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/interfaces/user.interface';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenuModule,
    SidebarModule,
    ButtonModule,
    CardModule,
    AvatarModule,
    ProgressBarModule
  ],
  template: `
    <div class="h-screen bg-white dark:bg-gray-800 shadow-lg flex flex-col transition-all duration-300 ease-in-out">
      <!-- Logo Section -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <img src="../../../../assets/logo/logo.png" alt="Logo" class="h-10 w-auto mx-auto" />
      </div>

      <!-- User Profile Section -->
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center space-x-4">
          <p-avatar 
            [label]="getUserInitials()" 
            styleClass="shadow-lg"
            size="large"
            [style]="{'background-color': '#3B82F6', 'color': '#ffffff'}"
            shape="circle">
          </p-avatar>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
              {{currentUser?.firstName}} {{currentUser?.lastName}}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{currentUser?.role | titlecase}}
            </p>
          </div>
        </div>
      </div>

      <!-- Navigation Menu -->
      <div class="flex-1 overflow-y-auto">
        <p-menu [model]="menuItems" styleClass="w-full custom-menu"></p-menu>
      </div>

      <!-- Logout Button -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <button pButton 
          label="Déconnexion" 
          icon="pi pi-sign-out" 
          class="p-button-danger w-full hover:bg-red-600 transition-colors duration-200"
          (click)="logout()">
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .custom-menu {
        background: transparent;
        border: none;
        padding: 0.5rem;
        width: 100%;

        .p-menu {
          background: transparent;
          border: none;
          width: 100%;
        }

        .p-menuitem {
          margin-bottom: 0.5rem;
        }

        .p-menuitem-link {
          border-radius: 0.5rem;
          transition: all 0.2s ease;
          padding: 0.75rem 1rem;
          margin: 0.25rem 0;

          &:hover {
            background: rgb(59 130 246 / 0.1);
          }

          &:focus {
            box-shadow: none;
            background: rgb(59 130 246 / 0.1);
          }

          .p-menuitem-icon {
            color: #3B82F6;
            margin-right: 0.75rem;
            font-size: 1.1rem;
          }

          .p-menuitem-text {
            color: #374151;
            font-size: 0.875rem;
            font-weight: 500;
          }
        }

        .p-submenu-list {
          margin-left: 1rem;
          border-left: 2px solid #E5E7EB;
          padding-left: 1rem;
        }

        /* Dark mode styles */
        @media (prefers-color-scheme: dark) {
          .p-menuitem-link {
            &:hover {
              background: rgb(59 130 246 / 0.2);
            }

            .p-menuitem-text {
              color: #F3F4F6;
            }
          }

          .p-submenu-list {
            border-left-color: #374151;
          }
        }
      }
    }
  `]
})
export class SidebarComponent implements OnInit {
  menuItems: MenuItem[] = [];
  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser = user as User;
      this.loadMenuItems();
    }
  }

  private loadMenuItems() {
    const isManager = this.authService.isManager();
    
    if (isManager) {
      this.menuItems = this.getManagerMenuItems();
    } else {
      this.menuItems = this.getEmployeeMenuItems();
    }

    if (this.currentUser?.role === 'manager') {
      this.menuItems.push(
        {
          label: 'Gestion d\'équipe',
          icon: 'pi pi-users',
          items: [
            {
              label: 'Pointage Équipe',
              icon: 'pi pi-clock',
              routerLink: '/pointage/team'
            },
            {
              label: 'Historique Pointage',
              icon: 'pi pi-calendar',
              routerLink: '/pointage/manager-historique'
            }
          ]
        }
      );
    }
  }

  private getManagerMenuItems(): MenuItem[] {
    return [
      {
        label: 'Gestion RH',
        icon: 'pi pi-users',
        items: [
          {
            label: 'Tableau de bord RH',
            icon: 'pi pi-chart-pie',
            routerLink: '/employees/dashboard'
          },
          {
            label: 'Mes employés',
            icon: 'pi pi-list',
            routerLink: '/employees'
          },
          {
            label: 'Validation congés',
            icon: 'pi pi-calendar',
            routerLink: '/conge/validation'
          }
        ]
      },
      {
        label: 'Pointage',
        icon: 'pi pi-clock',
        items: [
          {
            label: 'Mon pointage',
            icon: 'pi pi-user-edit',
            routerLink: '/pointage/dashboard'
          }
        ]
      }
      // {
      //   label: 'Projets',
      //   icon: 'pi pi-briefcase',
      //   routerLink: ['/projects']
      // },
      // {
      //   label: 'Évaluation',
      //   icon: 'pi pi-chart-bar',
      //   routerLink: ['/performance-review']
      // }
    ];
  }

  private getEmployeeMenuItems(): MenuItem[] {
    return [
      // {
      //   label: 'Mon espace',
      //   icon: 'pi pi-home',
      //   routerLink: ['/dashboard']
      // },
      {
        label: 'Mes congés',
        icon: 'pi pi-calendar',
        items: [
          {
            label: 'Nouvelle demande',
            icon: 'pi pi-plus',
            routerLink: ['/conge/request']
          },
          {
            label: 'Historique',
            icon: 'pi pi-list',
            routerLink: ['/conge/history']
          }
        ]
      },
      {
        label: 'Pointage',
        icon: 'pi pi-clock',
        items: [
          {
            label: 'Pointer',
            icon: 'pi pi-user-edit',
            routerLink: ['/pointage']
          },
          {
            label: 'Mon historique',
            icon: 'pi pi-calendar',
            routerLink: ['/pointage/history']
          },
          {
            label: 'Mes statistiques',
            icon: 'pi pi-chart-line',
            routerLink: ['/pointage/stats']
          }
        ]
      }
      // {
      //   label: 'Mes projets',
      //   icon: 'pi pi-briefcase',
      //   routerLink: ['/projects']
      // }
    ];
  }

  getUserInitials(): string {
    if (!this.currentUser) return '';
    return (this.currentUser.firstName.charAt(0) + this.currentUser.lastName.charAt(0)).toUpperCase();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
