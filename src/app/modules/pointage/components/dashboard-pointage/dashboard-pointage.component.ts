import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { KnobModule } from 'primeng/knob';
import { TimelineModule } from 'primeng/timeline';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { InputTextarea } from 'primeng/inputtextarea';
import { MessageService } from 'primeng/api';
import { PointageService, PointageRecord, GeolocationPosition, WorkingHoursSummary } from '../../../../shared/services/pointage.service';

@Component({
  selector: 'app-dashboard-pointage',
  templateUrl: './dashboard-pointage.component.html',
  styleUrls: ['./dashboard-pointage.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    KnobModule,
    TimelineModule,
    ToastModule,
    DialogModule,
    InputTextarea
  ],
  providers: [MessageService]
})
export class DashboardPointageComponent implements OnInit {
  currentTime = new Date();
  progressValue = 0;
  remainingTime = '';
  lastPointage: PointageRecord | null = null;
  chartData: any;
  chartOptions: any;
  timelineEvents: any[] = [];
  workingSummary: WorkingHoursSummary | null = null;
  streakDays = 0;

  // Dialog properties
  showPointageDialog = false;
  selectedPointageType: 'ENTREE' | 'SORTIE' | 'PAUSE_DEBUT' | 'PAUSE_FIN' | null = null;
  selectedMood: 'HAPPY' | 'NEUTRAL' | 'TIRED' | null = null;
  pointageNote = '';
  isLoading = false;

  constructor(
    private pointageService: PointageService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.updateTime();
    this.loadPointages();
    this.initializeChart();
    this.loadWorkingSummary();
    this.streakDays = this.pointageService.getStreakDays();
    setInterval(() => this.updateTime(), 1000);
  }

  private updateTime() {
    this.currentTime = new Date();
    // Calculate progress (8h workday)
    const startHour = 9;
    const endHour = 17;
    const currentHour = this.currentTime.getHours() + (this.currentTime.getMinutes() / 60);
    this.progressValue = Math.min(100, Math.max(0, 
      ((currentHour - startHour) / (endHour - startHour)) * 100
    ));

    // Update remaining time
    if (currentHour < startHour) {
      this.remainingTime = 'Journée non commencée';
    } else if (currentHour > endHour) {
      this.remainingTime = 'Journée terminée';
    } else {
      const remainingHours = endHour - currentHour;
      const hours = Math.floor(remainingHours);
      const minutes = Math.round((remainingHours - hours) * 60);
      this.remainingTime = `${hours}h ${minutes}min restantes`;
    }
  }

  private initializeChart() {
    this.chartData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
      datasets: [
        {
          label: 'Heures Travaillées',
          data: [7.5, 8, 8.5, 7.8, 8.2],
          fill: false,
          borderColor: '#4CAF50',
          tension: 0.4
        },
        {
          label: 'Heures Attendues',
          data: [8, 8, 8, 8, 8],
          fill: false,
          borderColor: '#90CAF9',
          tension: 0.4
        }
      ]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 10
        }
      }
    };
  }

  private loadPointages() {
    this.pointageService.getPointagesJour(1, new Date()).subscribe(pointages => {
      this.lastPointage = pointages[pointages.length - 1] || null;
      this.timelineEvents = pointages.map(p => ({
        status: p.type,
        date: p.timestamp,
        icon: this.getIconForType(p.type),
        color: this.getColorForType(p.type),
        mood: p.mood,
        note: p.note
      }));
    });
  }

  private loadWorkingSummary() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() - today.getDay() + 5);

    this.pointageService.getWorkingHoursSummary(1, startOfWeek, endOfWeek)
      .subscribe(summary => {
        this.workingSummary = summary;
      });
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'ENTREE': return 'pi pi-sign-in';
      case 'SORTIE': return 'pi pi-sign-out';
      case 'PAUSE_DEBUT': return 'pi pi-clock';
      case 'PAUSE_FIN': return 'pi pi-refresh';
      default: return 'pi pi-clock';
    }
  }

  private getColorForType(type: string): string {
    switch (type) {
      case 'ENTREE': return '#4CAF50';
      case 'SORTIE': return '#F44336';
      case 'PAUSE_DEBUT': return '#FFA726';
      case 'PAUSE_FIN': return '#42A5F5';
      default: return '#9E9E9E';
    }
  }

  getMoodEmoji(mood: string): string {
    switch (mood) {
      case 'HAPPY': return '😊';
      case 'NEUTRAL': return '😐';
      case 'TIRED': return '😫';
      default: return '';
    }
  }

  openPointageDialog(type: 'ENTREE' | 'SORTIE' | 'PAUSE_DEBUT' | 'PAUSE_FIN') {
    this.selectedPointageType = type;
    this.selectedMood = null;
    this.pointageNote = '';
    this.showPointageDialog = true;
  }

  getPointageDialogTitle(): string {
    return `${this.getPointageTypeLabel()} - ${new Date().toLocaleTimeString()}`;
  }

  getPointageTypeLabel(): string {
    switch (this.selectedPointageType) {
      case 'ENTREE': return 'Entrée';
      case 'SORTIE': return 'Sortie';
      case 'PAUSE_DEBUT': return 'Début de pause';
      case 'PAUSE_FIN': return 'Fin de pause';
      default: return '';
    }
  }

  cancelPointage() {
    this.showPointageDialog = false;
  }

  async confirmPointage() {
    if (!this.selectedPointageType) return;

    try {
      this.isLoading = true;
      const position = await this.getCurrentPosition();
      const isInZone = await this.pointageService.verifierZonePointage(position).toPromise();

      if (!isInZone) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Vous devez être dans la zone de pointage autorisée'
        });
        return;
      }

      const pointage = await this.pointageService.enregistrerPointage({
        type: this.selectedPointageType,
        device: 'WEB',
        location: position,
        mood: this.selectedMood || undefined,
        note: this.pointageNote || undefined
      });

      this.lastPointage = pointage;
      this.loadPointages();
      this.loadWorkingSummary();
      this.streakDays = this.pointageService.getStreakDays();

      this.messageService.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Pointage enregistré avec succès'
      });

      this.showPointageDialog = false;
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible d\'enregistrer le pointage'
      });
    } finally {
      this.isLoading = false;
    }
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}
