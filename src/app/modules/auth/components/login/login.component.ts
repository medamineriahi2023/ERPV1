import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../../core/services/auth.service';
import { LoginRequest } from '../../../../core/interfaces/user.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-50 py-6 flex flex-col justify-center sm:py-12 relative">
      <div class="absolute inset-0 bg-[url('/assets/img/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
      
      <p-toast position="top-center"></p-toast>
      
      <div class="relative py-3 sm:max-w-xl sm:mx-auto">
        <div class="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-600 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
        
        <div class="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <div class="max-w-md mx-auto">
            <div class="divide-y divide-gray-200">
              <div class="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <div class="text-center mb-8">
                  <img src="assets/logo/logo.png" alt="Logo" class="mx-auto h-16 mb-4">
                  <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 mb-2">Bienvenue!</h2>
                  <p class="text-gray-600">Connectez-vous pour continuer</p>
                </div>

                <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-8">
                  <!-- Username Field -->
                  <div class="space-y-2">
                    <label for="username" class="block text-sm font-medium text-gray-700">
                      Nom d'utilisateur
                    </label>
                    <div class="group relative rounded-lg shadow-sm">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i class="pi pi-user text-gray-400 group-hover:text-blue-500 transition-colors duration-200"></i>
                      </div>
                      <input 
                        id="username" 
                        type="text" 
                        formControlName="username"
                        class="block w-full pl-10 pr-3 py-2.5 sm:text-sm border-2 border-gray-200 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-transparent
                               hover:border-blue-300 transition-all duration-200
                               bg-gray-50 hover:bg-white"
                        [ngClass]="{'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500': submitted && loginForm.get('username')?.errors}"
                        placeholder="Entrez votre nom d'utilisateur">
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
                           *ngIf="submitted && loginForm.get('username')?.errors">
                        <i class="pi pi-exclamation-circle text-red-500"></i>
                      </div>
                    </div>
                    <p class="mt-1 text-sm text-red-600 flex items-center gap-1" 
                       *ngIf="submitted && loginForm.get('username')?.errors?.['required']">
                      <i class="pi pi-info-circle"></i>
                      Le nom d'utilisateur est requis
                    </p>
                  </div>

                  <!-- Password Field -->
                  <div class="space-y-2">
                    <label for="password" class="block text-sm font-medium text-gray-700">
                      Mot de passe
                    </label>
                    <div class="group relative rounded-lg shadow-sm">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i class="pi pi-lock text-gray-400 group-hover:text-blue-500 transition-colors duration-200"></i>
                      </div>
                      <p-password 
                        id="password" 
                        formControlName="password"
                        [feedback]="false"
                        [toggleMask]="true"
                        styleClass="w-full custom-password"
                        [inputStyle]="{'padding-left': '2.5rem', 'border-radius': '0.5rem', 'height': '2.75rem'}"
                        [ngClass]="{'ng-invalid ng-dirty': submitted && loginForm.get('password')?.errors}"
                        placeholder="Entrez votre mot de passe">
                      </p-password>
                      <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
                           *ngIf="submitted && loginForm.get('password')?.errors">
                        <i class="pi pi-exclamation-circle text-red-500"></i>
                      </div>
                    </div>
                    <p class="mt-1 text-sm text-red-600 flex items-center gap-1" 
                       *ngIf="submitted && loginForm.get('password')?.errors?.['required']">
                      <i class="pi pi-info-circle"></i>
                      Le mot de passe est requis
                    </p>
                  </div>

                  <!-- Submit Button -->
                  <div class="pt-4">
                    <button 
                      pButton 
                      type="submit"
                      [loading]="loading"
                      label="Se connecter"
                      class="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white
                             bg-gradient-to-r from-blue-500 to-blue-600 
                             hover:from-blue-600 hover:to-blue-700 
                             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 
                             transition-all duration-200 transform hover:scale-[1.02]">
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host ::ng-deep {
      .p-password {
        width: 100%;
        
        input {
          width: 100%;
          @apply pl-10 pr-3 py-2.5 sm:text-sm border-2 border-gray-200 rounded-lg 
                 focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 hover:border-blue-300 transition-all duration-200
                 bg-gray-50 hover:bg-white;
          
          &.ng-invalid.ng-dirty {
            @apply border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500;
          }
        }

        .p-password-panel {
          @apply rounded-lg shadow-lg border-0 mt-1;
        }

        .p-password-meter {
          @apply bg-gray-200;
        }

        .p-password-info {
          @apply text-sm text-gray-600;
        }
      }
      
      .p-button {
        &.p-button-loading {
          @apply opacity-75 cursor-wait;
          
          .p-button-label {
            @apply opacity-0;
          }
          
          .p-button-loading-icon {
            @apply opacity-100;
          }
        }
      }

      .custom-password {
        .p-password-input {
          @apply bg-gray-50 hover:bg-white transition-colors duration-200;
        }
      }
    }
  `]
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  submitted = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) {
    this.loginForm = new FormGroup({
      username: new FormControl('', [Validators.required]),
      password: new FormControl('', [Validators.required])
    });
  }

  ngOnInit() {
    // Clear any existing session
    localStorage.clear();
    this.authService.logout();
  }

  onSubmit() {
    this.submitted = true;

    if (this.loginForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Veuillez remplir tous les champs requis',
        life: 3000
      });
      return;
    }

    this.loading = true;

    try {
      const credentials: LoginRequest = {
        username: this.loginForm.get('username')?.value,
        password: this.loginForm.get('password')?.value
      };

      this.authService.login(credentials);
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: error instanceof Error ? error.message : 'Erreur de connexion',
        life: 3000
      });
    } finally {
      this.loading = false;
    }
  }
}
