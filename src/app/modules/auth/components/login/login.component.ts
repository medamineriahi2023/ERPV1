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
  template: `
    <div class="surface-ground flex align-items-center justify-content-center min-h-screen min-w-screen overflow-hidden">
      <p-toast position="top-center"></p-toast>
      <div class="flex flex-column align-items-center justify-content-center">
        <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%);">
          <div class="w-full surface-card py-8 px-5 sm:px-8" style="border-radius: 53px;">
            <div class="text-center mb-5">
              <div class="text-900 text-3xl font-medium mb-3">Bienvenue!</div>
              <span class="text-600 font-medium">Connectez-vous pour continuer</span>
            </div>

            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
              <div class="flex flex-column gap-4">
                <div class="flex flex-column gap-2">
                  <label for="username" class="text-900 font-medium">Nom d'utilisateur</label>
                  <span class="p-input-icon-left w-full">
                    <i class="pi pi-user"></i>
                    <input 
                      id="username" 
                      type="text" 
                      pInputText 
                      class="w-full"
                      formControlName="username"
                      [ngClass]="{'ng-invalid ng-dirty': submitted && loginForm.get('username')?.errors}"
                      placeholder="Entrez votre nom d'utilisateur">
                  </span>
                  <small 
                    class="p-error" 
                    *ngIf="submitted && loginForm.get('username')?.errors?.['required']">
                    Le nom d'utilisateur est requis
                  </small>
                </div>

                <div class="flex flex-column gap-2">
                  <label for="password" class="text-900 font-medium">Mot de passe</label>
                  <span class="p-input-icon-left w-full">
                    <i class="pi pi-lock"></i>
                    <p-password 
                      id="password" 
                      formControlName="password"
                      [feedback]="false"
                      [toggleMask]="true"
                      styleClass="w-full"
                      inputStyleClass="w-full"
                      [ngClass]="{'ng-invalid ng-dirty': submitted && loginForm.get('password')?.errors}"
                      placeholder="Entrez votre mot de passe">
                    </p-password>
                  </span>
                  <small 
                    class="p-error" 
                    *ngIf="submitted && loginForm.get('password')?.errors?.['required']">
                    Le mot de passe est requis
                  </small>
                </div>

                <button 
                  pButton 
                  type="submit"
                  [loading]="loading"
                  label="Se connecter"
                  class="w-full p-3 text-xl">
                </button>
              </div>
            </form>
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
        }
      }
      
      .p-input-icon-left {
        width: 100%;
        
        > i {
          left: 0.75rem;
          color: var(--text-color-secondary);
        }
        
        > input {
          padding-left: 2.5rem;
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
