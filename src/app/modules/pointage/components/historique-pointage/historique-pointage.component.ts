import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PointageService, PointageRecord } from '../../../../shared/services/pointage.service';

@Component({
  selector: 'app-historique-pointage',
  templateUrl: './historique-pointage.component.html',
  styleUrls: ['./historique-pointage.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    ToastModule
  ],
  providers: [MessageService]
})
export class HistoriquePointageComponent implements OnInit {
  pointages: PointageRecord[] = [];
  selectedPointage: PointageRecord | null = null;
  loading = false;
  dateRange: Date[] = [];
  totalHeures = 0;
  showDetailsDialog = false;

  constructor(
    private pointageService: PointageService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    // Initialize date range to current month
    const today = new Date();
    this.dateRange = [
      new Date(today.getFullYear(), today.getMonth(), 1),
      new Date(today.getFullYear(), today.getMonth() + 1, 0)
    ];
    this.loadPointages();
  }

  loadPointages() {
    if (!this.dateRange[0] || !this.dateRange[1]) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez sélectionner une période'
      });
      return;
    }

    this.loading = true;
    this.pointageService.getPointagesPeriode(1, this.dateRange[0], this.dateRange[1])
      .subscribe({
        next: (pointages: PointageRecord[]) => {
          this.pointages = pointages;
          this.calculerTotalHeures();
        },
        error: (error: Error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de charger l\'historique'
          });
        },
        complete: () => {
          this.loading = false;
        }
      });
  }

  private calculerTotalHeures() {
    let total = 0;
    let entreeTime: Date | null = null;

    for (const pointage of this.pointages) {
      const time = new Date(pointage.timestamp);

      switch (pointage.type) {
        case 'ENTREE':
          entreeTime = time;
          break;
        case 'SORTIE':
          if (entreeTime) {
            total += (time.getTime() - entreeTime.getTime()) / (1000 * 60 * 60);
            entreeTime = null;
          }
          break;
        case 'PAUSE_DEBUT':
          if (entreeTime) {
            total += (time.getTime() - entreeTime.getTime()) / (1000 * 60 * 60);
            entreeTime = null;
          }
          break;
        case 'PAUSE_FIN':
          entreeTime = time;
          break;
      }
    }

    this.totalHeures = Math.round(total * 100) / 100;
  }

  getPointageTypeLabel(type: string): string {
    switch (type) {
      case 'ENTREE': return 'Entrée';
      case 'SORTIE': return 'Sortie';
      case 'PAUSE_DEBUT': return 'Début de pause';
      case 'PAUSE_FIN': return 'Fin de pause';
      default: return type;
    }
  }

  getMoodEmoji(mood: string | undefined): string {
    switch (mood) {
      case 'HAPPY': return '😊';
      case 'NEUTRAL': return '😐';
      case 'TIRED': return '😫';
      default: return '';
    }
  }

  showDetails(pointage: PointageRecord) {
    this.selectedPointage = pointage;
    this.showDetailsDialog = true;
  }
}
