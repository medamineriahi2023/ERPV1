import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { CongeService, CongeRequest } from '../../../../shared/services/conge.service';
import { AuthService } from '../../../../core/services/auth.service';
import { firstValueFrom, map } from 'rxjs';
import { Router } from '@angular/router';

interface User {
  id: number;
  managerId?: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

@Component({
  selector: 'app-demande-conge',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    CalendarModule,
    InputTextModule,
    DropdownModule,
    ToastModule,
    FileUploadModule,
    ProgressBarModule,
    DividerModule,
    TagModule,
  ],
  providers: [MessageService],
  templateUrl: './demande-conge.component.html',
  styleUrls: ['./demande-conge.component.scss']
})
export class DemandeCongeComponent implements OnInit {
  leaveForm: FormGroup;
  loading = false;
  uploadedFiles: any[] = [];
  currentUser: User | null = null;
  weekendDays: number = 0;
  calculatedDays: number = 0;

  // Statistiques
  leaveStats = {
    totalDays: 30,
    usedDays: 0,
    remainingDays: 30,
    pendingDays: 0,
    sickDays: 15
  };

  recentLeaves: any[] = [];
  upcomingLeaves: any[] = [];

  typeOptions = [
    { label: 'Congé payé', value: 'CONGE_PAYE', icon: 'pi pi-calendar', color: '#22C55E' },
    { label: 'Maladie', value: 'MALADIE', icon: 'pi pi-heart', color: '#EF4444' },
    { label: 'Sans solde', value: 'SANS_SOLDE', icon: 'pi pi-wallet', color: '#F59E0B' },
    { label: 'Formation', value: 'FORMATION', icon: 'pi pi-book', color: '#3B82F6' },
    { label: 'Autre', value: 'AUTRE', icon: 'pi pi-ellipsis-h', color: '#6B7280' }
  ];

  urgencyOptions = [
    { label: 'Normal', value: 'NORMAL', icon: 'pi pi-clock' },
    { label: 'Urgent', value: 'URGENT', icon: 'pi pi-exclamation-triangle' }
  ];

  minDate: Date = new Date();
  publicHolidays: Date[] = [
    new Date('2024-01-01'), // Nouvel an
    new Date('2024-05-01'), // Fête du travail
    new Date('2024-07-14'), // Fête nationale
  ];

  constructor(
    private fb: FormBuilder,
    private congeService: CongeService,
    private authService: AuthService,
    private messageService: MessageService,
    private router: Router
  ) {
    this.leaveForm = this.fb.group({
      type: ['', Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      urgencyLevel: ['NORMAL', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(10)]]
    });

    // Écouter les changements de dates
    this.leaveForm.get('startDate')?.valueChanges.subscribe(() => {
      this.calculateDuration();
    });

    this.leaveForm.get('endDate')?.valueChanges.subscribe(() => {
      this.calculateDuration();
    });
  }

  async ngOnInit() {
    try {
      const currentUser = await firstValueFrom(this.authService.currentUser$);
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      this.currentUser = currentUser;
      await this.loadLeaveStats();
      await this.loadLeaveHistory();
    } catch (error) {
      console.error('Error getting current user:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de la récupération des informations utilisateur'
      });
    }
  }

  private async loadLeaveStats() {
    if (this.currentUser?.id) {
      const balance = await firstValueFrom(this.congeService.getCongeBalance(this.currentUser.id));
      this.leaveStats = {
        totalDays: balance.totalDays,
        usedDays: balance.usedDays,
        remainingDays: balance.remainingDays,
        pendingDays: 0,
        sickDays: balance.sickDays
      };
    }
  }

  private async loadLeaveHistory() {
    if (this.currentUser?.id) {
      const allLeaves = await firstValueFrom(this.congeService.getCongeRequests());
      const userLeaves = allLeaves.filter(leave => leave.employeeId === this.currentUser?.id);
      const now = new Date();

      this.recentLeaves = userLeaves
        .filter(leave => new Date(leave.endDate) < now)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
        .slice(0, 5);

      this.upcomingLeaves = userLeaves
        .filter(leave => new Date(leave.startDate) > now)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5);
    }
  }

  // Calcule la durée entre deux dates en excluant les weekends et jours fériés
  private calculateDuration() {
    const startDate = this.leaveForm.get('startDate')?.value;
    const endDate = this.leaveForm.get('endDate')?.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let duration = 0;
      const current = new Date(start);

      while (current <= end) {
        // Exclure les weekends (0 = Dimanche, 6 = Samedi)
        if (current.getDay() !== 0 && current.getDay() !== 6) {
          // Vérifier si ce n'est pas un jour férié
          const isHoliday = this.publicHolidays.some(holiday => 
            holiday.getDate() === current.getDate() &&
            holiday.getMonth() === current.getMonth() &&
            holiday.getFullYear() === current.getFullYear()
          );

          if (!isHoliday) {
            duration++;
          }
        }
        current.setDate(current.getDate() + 1);
      }
      this.calculatedDays = duration;
    } else {
      this.calculatedDays = 0;
    }
  }

  getTypeLabel(type: string): string {
    const option = this.typeOptions.find(t => t.value === type);
    return option ? option.label : type;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'bg-yellow-100 text-yellow-800';
      case 'APPROUVE':
        return 'bg-green-100 text-green-800';
      case 'REFUSE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'APPROUVE':
        return 'Approuvé';
      case 'REFUSE':
        return 'Refusé';
      default:
        return status;
    }
  }

  onFileUpload(event: any) {
    for (let file of event.files) {
      this.uploadedFiles.push(file);
    }
    this.messageService.add({
      severity: 'info',
      summary: 'Fichier ajouté',
      detail: 'Le fichier a été ajouté avec succès'
    });
  }

  async onSubmit() {
    if (this.leaveForm.valid && this.currentUser) {
      try {
        this.loading = true;

        if (!this.currentUser.managerId) {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Aucun manager assigné. Impossible de soumettre une demande de congé.'
          });
          return;
        }

        const formValue = this.leaveForm.value;
        const startDate = new Date(formValue.startDate);
        const endDate = new Date(formValue.endDate);

        const request: Partial<CongeRequest> = {
          employeeId: this.currentUser.id,
          managerId: this.currentUser.managerId,
          type: formValue.type,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration: this.calculatedDays,
          status: 'EN_ATTENTE',
          reason: formValue.reason,
          urgencyLevel: formValue.urgencyLevel,
          attachments: this.uploadedFiles.map(file => file.name)
        };

        await firstValueFrom(this.congeService.createCongeRequest(request));
        
        this.messageService.add({
          severity: 'success',
          summary: 'Succès',
          detail: 'Demande de congé soumise avec succès'
        });

        this.router.navigate(['/conges']);
      } catch (error) {
        console.error('Error submitting leave request:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors de la soumission de la demande'
        });
      } finally {
        this.loading = false;
      }
    } else {
      Object.keys(this.leaveForm.controls).forEach(key => {
        const control = this.leaveForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez remplir tous les champs obligatoires'
      });
    }
  }
}
