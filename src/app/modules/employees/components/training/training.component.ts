import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { Employee } from '../../../../shared/services/employee.service';

interface Training {
  id: number;
  title: string;
  description: string;
  type: 'TECHNICAL' | 'SOFT_SKILLS' | 'MANAGEMENT' | 'COMPLIANCE';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  progress: number;
  startDate: Date;
  endDate: Date;
  duration: number;
  provider: string;
  certification?: string;
  skills: string[];
}

interface Certification {
  id: number;
  name: string;
  issuer: string;
  dateObtained: Date;
  expiryDate?: Date;
  status: 'ACTIVE' | 'EXPIRED';
  skills: string[];
}

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    ChipModule,
    DialogModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    TimelineModule
  ],
  templateUrl: './training.component.html'
})
export class TrainingComponent implements OnInit {
  @Input() employee?: Employee;
  trainings: Training[] = [];
  certifications: Certification[] = [];
  selectedTraining?: Training;
  showTrainingDialog = false;

  ngOnInit() {
    // Mock data for testing
    this.trainings = [
      {
        id: 1,
        title: 'Angular Advanced Concepts',
        description: 'Deep dive into Angular advanced features',
        type: 'TECHNICAL',
        status: 'IN_PROGRESS',
        progress: 60,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        duration: 40,
        provider: 'Udemy',
        skills: ['Angular', 'TypeScript', 'RxJS']
      },
      // Add more mock trainings as needed
    ];

    this.certifications = [
      {
        id: 1,
        name: 'Angular Certification',
        issuer: 'Google',
        dateObtained: new Date('2023-12-01'),
        expiryDate: new Date('2025-12-01'),
        status: 'ACTIVE',
        skills: ['Angular', 'TypeScript']
      },
      // Add more mock certifications as needed
    ];
  }

  get inProgressTrainings(): number {
    return this.trainings.filter(t => t.status === 'IN_PROGRESS').length;
  }

  get notStartedTrainings(): number {
    return this.trainings.filter(t => t.status === 'NOT_STARTED').length;
  }

  get completedTrainings(): number {
    return this.trainings.filter(t => t.status === 'COMPLETED').length;
  }

  calculateCompletionRate(): number {
    if (this.trainings.length === 0) return 0;
    return (this.completedTrainings / this.trainings.length) * 100;
  }

  getStatusSeverity(status: Training['status']): 'success' | 'secondary' | 'info' | 'warn' | 'danger' {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'IN_PROGRESS': return 'info';
      case 'NOT_STARTED': return 'warn';
      case 'EXPIRED': return 'danger';
      default: return 'info';
    }
  }

  getStatusLabel(status: Training['status']): string {
    switch (status) {
      case 'COMPLETED': return 'Terminé';
      case 'IN_PROGRESS': return 'En cours';
      case 'NOT_STARTED': return 'À venir';
      case 'EXPIRED': return 'Expiré';
      default: return status;
    }
  }

  getCertificationStatus(cert: Certification): 'ACTIVE' | 'EXPIRED' {
    if (!cert.expiryDate) return 'ACTIVE';
    return new Date() > cert.expiryDate ? 'EXPIRED' : 'ACTIVE';
  }

  getDaysRemaining(endDate: Date): number {
    const today = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  viewTrainingDetails(training: Training): void {
    this.selectedTraining = training;
    this.showTrainingDialog = true;
  }
}
