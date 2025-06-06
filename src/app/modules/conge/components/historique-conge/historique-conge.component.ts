import { Component, OnInit } from '@angular/core';
import { CongeService, CongeRequest } from '../../../../shared/services/conge.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { DatePipe, CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { firstValueFrom } from 'rxjs';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | undefined;

@Component({
  selector: 'app-historique-conge',
  templateUrl: './historique-conge.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    InputTextModule,
    DatePipe,
    ToastModule
  ],
  providers: [MessageService]
})
export class HistoriqueCongeComponent implements OnInit {
  conges: CongeRequest[] = [];
  loading = false;
  searchTerm = '';

  typeOptions = [
    { label: 'Congé payé', value: 'CONGE_PAYE' },
    { label: 'Maladie', value: 'MALADIE' },
    { label: 'Sans solde', value: 'SANS_SOLDE' },
    { label: 'Formation', value: 'FORMATION' },
    { label: 'Autre', value: 'AUTRE' }
  ];

  statusOptions = [
    { label: 'En attente', value: 'EN_ATTENTE' },
    { label: 'Approuvé', value: 'APPROUVE' },
    { label: 'Refusé', value: 'REFUSE' }
  ];

  // Liste des jours fériés
  publicHolidays: Date[] = [
    new Date('2024-01-01'), // Nouvel an
    new Date('2024-05-01'), // Fête du travail
    new Date('2024-07-14'), // Fête nationale
  ];

  constructor(
    private congeService: CongeService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    await this.loadConges();
  }

  async loadConges() {
    try {
      this.loading = true;
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not found');
      }

      const allConges = await firstValueFrom(this.congeService.getCongeRequests());
      this.conges = allConges
        .filter(conge => conge.employeeId === currentUser.id)
        .map(conge => ({
          ...conge,
          duration: this.calculateDuration(new Date(conge.startDate), new Date(conge.endDate))
        }));

    } catch (error) {
      console.error('Error loading conges:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors du chargement de l\'historique',
        life: 3000
      });
    } finally {
      this.loading = false;
    }
  }

  // Calcule la durée entre deux dates en excluant les weekends et jours fériés
  private calculateDuration(startDate: Date, endDate: Date): number {
    let duration = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
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
    return duration;
  }

  getStatusSeverity(status: string): TagSeverity {
    switch (status) {
      case 'APPROUVE':
        return 'success';
      case 'REFUSE':
        return 'danger';
      case 'EN_ATTENTE':
        return 'warn';
      default:
        return 'info';
    }
  }

  getTypeSeverity(type: any): TagSeverity {
    return type.value === 'CONGE_PAYE' ? 'success' : 'info';
  }

  getUrgencySeverity(urgencyLevel: string | undefined): TagSeverity {
    return urgencyLevel === 'URGENT' ? 'danger' : 'info';
  }

  getTypeLabel(type: string): string {
    const option = this.typeOptions.find(t => t.value === type);
    return option ? option.label : type;
  }

  getStatusLabel(status: string): string {
    const option = this.statusOptions.find(s => s.value === status);
    return option ? option.label : status;
  }
}
