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
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

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
  remainingDays = 0;
  uploadedFiles: any[] = [];

  // Statistics
  leaveStats = {
    totalDays: 30,
    usedDays: 0,
    remainingDays: 0,
    pendingDays: 0,
    sickDays: 0
  };

  monthlyStats = {
    labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  };

  recentLeaves: any[] = [];
  upcomingLeaves: any[] = [];
  currentUser: any = null;

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
  calculatedDays: number = 0;
  weekendDays: number = 0;
  publicHolidays: Date[] = [
    new Date('2024-01-01'), // Nouvel an
    new Date('2024-05-01'), // Fête du travail
    new Date('2024-07-14'), // Fête nationale
    // Ajoutez d'autres jours fériés ici
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
      reason: ['', [Validators.required, Validators.minLength(10)]],
      replacementEmployee: [''],
      impactOnTraining: [false],
      attachments: [[]]
    });

    // Listen to date changes
    this.leaveForm.get('startDate')?.valueChanges.subscribe(() => {
      this.calculateDuration();
      this.adjustEndDateIfWeekend();
    });
    this.leaveForm.get('endDate')?.valueChanges.subscribe(() => {
      this.calculateDuration();
      this.adjustEndDateIfWeekend();
    });
  }

  // Function to check if a date is a weekend
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }

  // Function to check if a date is valid for selection
  isDateDisabled = (date: Date): boolean => {
    return this.isWeekend(date) || this.publicHolidays.some(holiday =>
      holiday.getDate() === date.getDate() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getFullYear() === date.getFullYear()
    );
  }

  // Function to get the next valid date
  getNextValidDate(date: Date): Date {
    const nextDate = new Date(date);
    while (this.isDateDisabled(nextDate)) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate;
  }

  // Function to adjust end date if it falls on a weekend
  private adjustEndDateIfWeekend() {
    const endDate = this.leaveForm.get('endDate')?.value;
    if (endDate && this.isDateDisabled(new Date(endDate))) {
      const nextValidDate = this.getNextValidDate(new Date(endDate));
      this.leaveForm.patchValue({ endDate: nextValidDate }, { emitEvent: false });
    }
  }

  private calculateDuration() {
    const startDate = this.leaveForm.get('startDate')?.value;
    const endDate = this.leaveForm.get('endDate')?.value;

    if (!startDate || !endDate) {
      this.calculatedDays = 0;
      this.weekendDays = 0;
      return;
    }

    let duration = 0;
    let weekends = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      if (this.isDateDisabled(current)) {
        weekends++;
      } else {
        duration++;
      }
      current.setDate(current.getDate() + 1);
    }

    this.calculatedDays = duration;
    this.weekendDays = weekends;
  }

  async ngOnInit() {
    await this.loadUserData();
    await this.loadLeaveStatistics();
    await this.loadLeaveHistory();
    await this.loadRemainingDays();
  }

  private async loadUserData() {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) return;
      this.currentUser = user;
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  private async loadLeaveStatistics() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      const balance = await firstValueFrom(this.congeService.getCongeBalance(currentUser.id));
      this.leaveStats = {
        totalDays: balance.totalDays,
        usedDays: balance.usedDays,
        remainingDays: balance.remainingDays,
        pendingDays: 0, // À implémenter avec le backend
        sickDays: balance.sickDays
      };

      // Simuler des données mensuelles pour l'exemple
      this.monthlyStats.values = [2, 0, 3, 1, 0, 5, 0, 0, 0, 0, 0, 0];
    } catch (error) {
      console.error('Error loading leave statistics:', error);
    }
  }

  async loadLeaveHistory() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not found');
      }

      const allLeaves = await firstValueFrom(this.congeService.getCongeRequests());
      const userLeaves = allLeaves.filter(leave => leave.employeeId === currentUser.id);
      const now = new Date();

      this.recentLeaves = userLeaves
        .filter((leave: CongeRequest) => new Date(leave.endDate) < now)
        .sort((a: CongeRequest, b: CongeRequest) => 
          new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
        )
        .slice(0, 5);

      this.upcomingLeaves = userLeaves
        .filter((leave: CongeRequest) => new Date(leave.startDate) > now)
        .sort((a: CongeRequest, b: CongeRequest) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        )
        .slice(0, 5);

    } catch (error) {
      console.error('Error loading leave history:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement de l\'historique',
        life: 3000
      });
    }
  }

  private async loadRemainingDays() {
    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      const balance = await firstValueFrom(this.congeService.getCongeBalance(currentUser.id));
      this.remainingDays = balance.remainingDays;
    } catch (error) {
      console.error('Error loading remaining days:', error);
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

  onFileRemove(file: any) {
    const index = this.uploadedFiles.indexOf(file);
    if (index !== -1) {
      this.uploadedFiles.splice(index, 1);
    }
  }

  onSubmit() {
    if (this.leaveForm.valid) {
      const formValue = this.leaveForm.value;
      const currentUser = this.authService.getCurrentUser();
      
      if (!currentUser) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Utilisateur non connecté',
          life: 3000
        });
        return;
      }

      const request: Partial<CongeRequest> = {
        employeeId: currentUser.id,
        type: formValue.type,
        startDate: formValue.startDate.toISOString(),
        endDate: formValue.endDate.toISOString(),
        duration: this.calculatedDays,
        reason: formValue.reason,
        status: 'EN_ATTENTE',
        urgencyLevel: formValue.urgencyLevel,
        impactOnTraining: formValue.impactOnTraining,
        attachments: this.uploadedFiles.map(file => file.name),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.congeService.createCongeRequest(request).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Demande de congé envoyée avec succès',
            life: 3000
          });
          this.router.navigate(['/conges']);
        },
        error: (error) => {
          console.error('Error submitting leave request:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Erreur lors de l\'envoi de la demande',
            life: 3000
          });
        }
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Veuillez remplir tous les champs obligatoires',
        life: 3000
      });
    }
  }

  getTypeIcon(type: string): string {
    const option = this.typeOptions.find(opt => opt.value === type);
    return option?.icon || 'pi pi-calendar';
  }

  getTypeColor(type: string): string {
    const option = this.typeOptions.find(opt => opt.value === type);
    return option?.color || '#6B7280';
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

  getTypeLabel(type: string): string {
    const option = this.typeOptions.find(opt => opt.value === type);
    return option?.label || type;
  }
}
