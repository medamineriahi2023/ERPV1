import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { PointageService } from '../../../../core/services/pointage.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FaceRecognitionService } from '../../../../core/services/face-recognition.service';
import { User, TimeEntry } from '../../../../core/interfaces/user.interface';
import { Subscription, interval } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {ProgressSpinner} from "primeng/progressspinner";

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    CalendarModule,
    TableModule,
    ToastModule,
    ChartModule,
    ProgressSpinner
  ],
  providers: [MessageService],
  templateUrl: './pointage.component.html',
  styleUrls: ['./pointage.component.scss']
})
export class PointageComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  today = new Date();
  currentTime = new Date();
  selectedDate = new Date();
  checkInTime: string | null = null;
  checkOutTime: string | null = null;
  lunchStartTime: string | null = null;
  lunchEndTime: string | null = null;
  selectedDateDetails: TimeEntry | null = null;
  monthlyHistory: TimeEntry[] = [];
  currentEntry: TimeEntry | null = null;
  private clockSubscription?: Subscription;
  private refreshInterval?: Subscription;

  attendanceChartData: any;
  attendanceChartOptions: any;
  punctualityChartData: any;
  punctualityChartOptions: any;
  weeklyHoursChartData: any;
  weeklyHoursChartOptions: any;
  monthlyTrendsChartData: any;
  monthlyTrendsChartOptions: any;

  totalWorkDays: number = 0;
  averageWorkHours: number = 0;
  lateArrivalCount: number = 0;
  onTimeArrivalCount: number = 0;
  averageBreakTime: number = 0;

  private videoStream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private referenceImage: HTMLImageElement | null = null;
  showCamera = false;
  verificationInProgress = false;
  showCalendar: boolean = window.innerWidth >= 1024; // Show by default on desktop

  constructor(
    private pointageService: PointageService,
    private authService: AuthService,
    private messageService: MessageService,
    private faceRecognitionService: FaceRecognitionService
  ) {
    this.authService.currentUser$.subscribe(e => this.loadReferenceImage(e.photoUrl));
    this.initializeCharts();
  }

  private initializeCharts() {
    this.attendanceChartData = {
      labels: ['Présent', 'Retard', 'Absent', 'Congé'],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#4CAF50', '#FFC107', '#F44336', '#2196F3']
      }]
    };
    this.attendanceChartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Distribution des Présences'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    this.punctualityChartData = {
      labels: Array.from({length: 30}, (_, i) => i + 1),
      datasets: [{
        label: 'Heure d\'arrivée',
        data: [],
        borderColor: '#2196F3',
        tension: 0.4
      }]
    };
    this.punctualityChartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Tendance de Ponctualité'
        }
      },
      scales: {
        y: {
          min: 7,
          max: 10,
          title: {
            display: true,
            text: 'Heure d\'arrivée'
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    this.weeklyHoursChartData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'],
      datasets: [{
        label: 'Heures Travaillées',
        data: [0, 0, 0, 0, 0],
        backgroundColor: '#4CAF50'
      }]
    };
    this.weeklyHoursChartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Heures Travaillées par Jour'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Heures'
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };

    this.monthlyTrendsChartData = {
      labels: ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4'],
      datasets: [{
        label: 'Heures Totales',
        data: [0, 0, 0, 0],
        borderColor: '#9C27B0',
        tension: 0.4,
        fill: false
      }]
    };
    this.monthlyTrendsChartOptions = {
      plugins: {
        legend: {
          position: 'bottom'
        },
        title: {
          display: true,
          text: 'Tendances Mensuelles'
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  private async loadReferenceImage(correntUserImageUrl: string) {
    this.referenceImage = new Image();
    this.referenceImage.src = correntUserImageUrl ?? '/assets/images/default-profile.jpg';
    await new Promise((resolve, reject) => {
      this.referenceImage.onload = resolve;
      this.referenceImage.onerror = reject;
    }).catch(error => {
      console.error('Error loading reference image:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger l\'image de référence'
      });
    });
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.setupClock();
    this.loadTodayEntry();
    this.loadMonthlyHistory();
    
    this.refreshInterval = interval(60000).subscribe(() => {
      this.loadTodayEntry();
      this.loadMonthlyHistory();
    });
  }

  ngOnDestroy() {
    if (this.clockSubscription) {
      this.clockSubscription.unsubscribe();
    }
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
  }

  private setupClock() {
    this.clockSubscription = interval(1000)
      .pipe(startWith(0))
      .subscribe(() => {
        this.currentTime = new Date();
      });
  }

  private loadTodayEntry() {
    const userId = this.currentUser?.id;
    if (!userId) return;

    this.pointageService.getActiveSession(userId).subscribe({
      next: (activeSession) => {
        if (activeSession) {
          this.currentEntry = activeSession;
          this.checkInTime = activeSession.checkIn;
          this.checkOutTime = activeSession.checkOut || null;
          this.lunchStartTime = activeSession.lunchStart || null;
          this.lunchEndTime = activeSession.lunchEnd || null;
        } else {
          const today = new Date();
          this.pointageService.getTimeEntry(userId, today).subscribe({
            next: (entry) => {
              if (entry) {
                this.currentEntry = entry;
                this.checkInTime = entry.checkIn;
                this.checkOutTime = entry.checkOut || null;
                this.lunchStartTime = entry.lunchStart || null;
                this.lunchEndTime = entry.lunchEnd || null;
                this.selectedDateDetails = entry;
              } else {
                this.resetSession();
              }
            },
            error: (error) => {
              console.error('Erreur lors du chargement des données:', error);
              this.showMessage('error', 'Erreur lors du chargement des données');
            }
          });
        }
      },
      error: (error) => {
        console.error('Erreur lors de la vérification de la session active:', error);
        this.showMessage('error', 'Erreur lors de la vérification de la session');
      }
    });
  }

  private resetSession() {
    this.currentEntry = null;
    this.checkInTime = null;
    this.checkOutTime = null;
    this.lunchStartTime = null;
    this.lunchEndTime = null;
  }

  async toggleCheckInOut() {
    if (!this.currentUser?.id) {
      this.showMessage('error', 'Utilisateur non connecté');
      return;
    }

    if (!this.checkInTime) {
      // For check-in, first verify if there's no active session
      this.pointageService.getActiveSession(this.currentUser.id).subscribe({
        next: async (activeSession) => {
          if (activeSession) {
            this.showMessage('error', 'Une session est déjà active pour aujourd\'hui');
            this.loadTodayEntry();
            return;
          }
          // Start camera for face verification
          await this.startCamera();
        },
        error: (error: Error) => {
          console.error('Erreur lors de la vérification de la session:', error);
          this.showMessage('error', 'Erreur lors de la vérification de la session');
        }
      });
    } else if (this.currentEntry?.id && !this.checkOutTime) {
      this.pointageService.checkOut(this.currentEntry.id).subscribe({
        next: (entry: TimeEntry) => {
          this.currentEntry = entry;
          this.checkOutTime = entry.checkOut || null;

          const message = entry.totalHours > 0
              ? `Départ enregistré. Temps travaillé: ${entry.totalHours.toFixed(2)} heures`
              : 'Départ enregistré';

          this.showMessage('success', message);
          this.loadMonthlyHistory();
        },
        error: (error: Error) => {
          console.error('Erreur lors de l\'enregistrement du départ:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement du départ');
        }
      });
    }
  }



  toggleLunchBreak() {
    if (!this.currentEntry?.id || this.checkOutTime) return;

    if (!this.lunchStartTime) {
      this.pointageService.startLunch(this.currentEntry.id).subscribe({
        next: (entry) => {
          this.currentEntry = entry;
          this.lunchStartTime = entry.lunchStart || null;
          this.showMessage('success', 'Début de pause déjeuner enregistré');
        },
        error: (error: Error) => {
          console.error('Erreur lors de l\'enregistrement du début de pause:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement du début de pause');
        }
      });
    } else if (!this.lunchEndTime) {
      this.pointageService.endLunch(this.currentEntry.id).subscribe({
        next: (entry) => {
          this.currentEntry = entry;
          this.lunchEndTime = entry.lunchEnd || null;
          this.showMessage('success', 'Fin de pause déjeuner enregistrée');
        },
        error: (error: Error) => {
          console.error('Erreur lors de l\'enregistrement de la fin de pause:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement de la fin de pause');
        }
      });
    }
  }

  isActionDisabled(): boolean {
    if (!this.checkInTime) return false; 
    if (this.checkOutTime) return true; 
    return false; 
  }

  onDateSelect(date: Date) {
    if (!this.currentUser) return;

    this.pointageService.getTimeEntry(this.currentUser.id, date).subscribe({
      next: (entry) => {
        this.selectedDateDetails = entry || null;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des détails:', error);
        this.showMessage('error', 'Erreur lors du chargement des détails');
      }
    });
  }

  loadMonthlyHistory() {
    if (!this.currentUser) return;

    const now = new Date();
    this.pointageService.getMonthlyEntries(
      this.currentUser.id,
      now.getMonth(),
      now.getFullYear()
    ).subscribe({
      next: (entries) => {
        this.monthlyHistory = entries;
        this.updateStatistics();
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'historique:', error);
        this.showMessage('error', 'Erreur lors du chargement de l\'historique');
      }
    });
  }

  private updateStatistics() {
    if (!this.monthlyHistory.length) return;

    const now = new Date();
    this.pointageService.getMonthlyStats(
      this.currentUser!.id,
      now.getMonth(),
      now.getFullYear()
    ).subscribe(stats => {
      this.totalWorkDays = stats.totalDays;
      this.lateArrivalCount = stats.lateDays;
      this.onTimeArrivalCount = stats.presentDays;
      this.averageWorkHours = stats.averageHours;
      this.averageBreakTime = stats.averageBreakTime;
      this.updateCharts();
    });
  }

  private updateCharts() {
    if (!this.currentUser) return;

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    // Update attendance chart
    this.pointageService.getMonthlyStats(this.currentUser.id, month, year)
      .subscribe(stats => {
        this.attendanceChartData.datasets[0].data = [
          stats.presentDays,
          stats.lateDays,
          stats.absentDays,
          this.monthlyHistory.filter(e => ['leave', 'holiday'].includes(e.status || '')).length
        ];
      });

    // Update punctuality chart
    const punctualityData = this.monthlyHistory.map(entry => {
      if (!entry.checkIn) return null;
      const [hours, minutes] = entry.checkIn.split(':').map(Number);
      return hours + minutes / 60;
    }).filter(time => time !== null);
    
    this.punctualityChartData.datasets[0].data = punctualityData;

    // Update weekly hours chart
    this.pointageService.getWeeklyStats(this.currentUser.id)
      .subscribe(stats => {
        const weeklyData = Array(5).fill(0);
        this.monthlyHistory.forEach(entry => {
          const entryDate = new Date(entry.date);
          if (entryDate >= new Date(now.setDate(now.getDate() - now.getDay()))) {
            const dayIndex = entryDate.getDay() - 1;
            if (dayIndex >= 0 && dayIndex < 5) {
              weeklyData[dayIndex] = entry.totalHours || 0;
            }
          }
        });
        this.weeklyHoursChartData.datasets[0].data = weeklyData;
      });

    // Update monthly trends
    const weeklyHours = [0, 0, 0, 0];
    this.monthlyHistory.forEach(entry => {
      const entryDate = new Date(entry.date);
      const weekNumber = Math.floor((entryDate.getDate() - 1) / 7);
      if (weekNumber < 4) {
        weeklyHours[weekNumber] += entry.totalHours || 0;
      }
    });
    
    this.monthlyTrendsChartData.datasets[0].data = weeklyHours;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      present: 'Présent',
      absent: 'Absent',
      leave: 'Congé',
      holiday: 'Férié',
      late: 'En retard'
    };
    return labels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
    switch (status) {
      case 'present':
        return `${baseClasses} bg-green-50 text-green-700`;
      case 'absent':
        return `${baseClasses} bg-red-50 text-red-700`;
      case 'leave':
        return `${baseClasses} bg-yellow-50 text-yellow-700`;
      case 'late':
        return `${baseClasses} bg-orange-50 text-orange-700`;
      case 'holiday':
        return `${baseClasses} bg-blue-50 text-blue-700`;
      default:
        return `${baseClasses} bg-gray-50 text-gray-700`;
    }
  }

  private showMessage(severity: 'success' | 'error', detail: string) {
    this.messageService.add({
      severity,
      summary: severity === 'success' ? 'Succès' : 'Erreur',
      detail,
      life: 3000
    });
  }

  async startCamera() {

    if (!this.referenceImage) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Image de référence non chargée'
      });
      return;
    }

    try {
      this.showCamera = true;
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      this.videoStream = stream;
      
      // Wait for DOM to update
      setTimeout(() => {
        this.videoElement = document.querySelector('#cameraFeed');
        if (this.videoElement) {
          this.videoElement.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible d\'accéder à la caméra'
      });
    }
  }

  stopCamera() {
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
    this.showCamera = false;
  }

  async verifyFaceAndCheckIn() {
    if (!this.videoElement || !this.referenceImage) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Caméra ou image de référence non disponible'
      });
      return;
    }

    this.verificationInProgress = true;

    try {
      const isMatch = await this.faceRecognitionService.verifyFace(
          this.videoElement,
          this.referenceImage
      );

      if (isMatch) {

        this.pointageService.checkIn(this.currentUser.id).subscribe({
          next: (entry) => {
            this.currentEntry = entry;
            this.checkInTime = entry.checkIn;
            this.showMessage('success', 'Arrivée enregistrée');
            this.loadMonthlyHistory();
            this.stopCamera();
          },
          error: (error) => {
            console.error('Error during check-in:', error);
            this.showMessage('error', 'Erreur lors du pointage');
          }
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'La vérification du visage a échoué. Veuillez réessayer.'
        });
      }
    } catch (error) {
      console.error('Error during face verification:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de la vérification du visage'
      });
    } finally {
      this.verificationInProgress = false;
      if (!this.checkInTime) {
        // Only stop camera if check-in wasn't successful
        this.stopCamera();
      }
    }
  }

}
