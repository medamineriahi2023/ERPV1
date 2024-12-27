import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextarea } from 'primeng/inputtextarea';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PointageService, PointageRecord, GeolocationPosition } from '../../../../shared/services/pointage.service';

@Component({
  selector: 'app-enregistrement-pointage',
  templateUrl: './enregistrement-pointage.component.html',
  styleUrls: ['./enregistrement-pointage.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextarea,
    ProgressSpinnerModule,
    ToastModule
  ],
  providers: [MessageService]
})
export class EnregistrementPointageComponent implements OnInit {
  currentTime = new Date();
  lastPointage: PointageRecord | null = null;
  isLoading = false;
  showConfirmDialog = false;
  selectedPointageType: 'ENTREE' | 'SORTIE' | 'PAUSE_DEBUT' | 'PAUSE_FIN' | null = null;
  selectedMood: 'HAPPY' | 'NEUTRAL' | 'TIRED' | null = null;
  pointageNote = '';

  constructor(
    private pointageService: PointageService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.updateTime();
    this.loadLastPointage();
    setInterval(() => this.updateTime(), 1000);
  }

  private updateTime() {
    this.currentTime = new Date();
  }

  private loadLastPointage() {
    this.pointageService.getPointagesJour(1, new Date()).subscribe(pointages => {
      this.lastPointage = pointages[pointages.length - 1] || null;
    });
  }

  openConfirmDialog(type: 'ENTREE' | 'SORTIE' | 'PAUSE_DEBUT' | 'PAUSE_FIN') {
    this.selectedPointageType = type;
    this.selectedMood = null;
    this.pointageNote = '';
    this.showConfirmDialog = true;
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
    this.showConfirmDialog = false;
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
      this.messageService.add({
        severity: 'success',
        summary: 'Succès',
        detail: 'Pointage enregistré avec succès'
      });

      this.showConfirmDialog = false;
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
