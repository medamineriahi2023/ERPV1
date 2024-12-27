import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PointageService } from '../../../../core/services/pointage.service';
import { AuthService } from '../../../../core/services/auth.service';
import { User, TimeEntry } from '../../../../core/interfaces/user.interface';
import { Subscription, interval } from 'rxjs';
import { startWith } from 'rxjs/operators';

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
    ToastModule
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

  constructor(
    private pointageService: PointageService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.setupClock();
    this.loadTodayEntry();
    this.loadMonthlyHistory();
    
    // Rafraîchir les données toutes les minutes
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

    // Vérifie d'abord s'il y a une session active
    this.pointageService.getActiveSession(userId).subscribe({
      next: (activeSession) => {
        if (activeSession) {
          // Si une session active est trouvée, utilise celle-ci
          this.currentEntry = activeSession;
          this.checkInTime = activeSession.checkIn;
          this.checkOutTime = activeSession.checkOut || null;
          this.lunchStartTime = activeSession.lunchStart || null;
          this.lunchEndTime = activeSession.lunchEnd || null;
        } else {
          // Sinon, vérifie s'il y a une session terminée pour aujourd'hui
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
                // Aucune session pour aujourd'hui
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

  toggleCheckInOut() {
    if (!this.currentUser?.id) {
      this.showMessage('error', 'Utilisateur non connecté');
      return;
    }

    const userId = this.currentUser.id;

    if (!this.checkInTime) {
      // Vérifier s'il existe déjà une session active
      this.pointageService.getActiveSession(userId).subscribe({
        next: (activeSession) => {
          if (activeSession) {
            this.showMessage('error', 'Une session est déjà active pour aujourd\'hui');
            this.loadTodayEntry(); // Recharger la session existante
            return;
          }

          // Si pas de session active, créer une nouvelle
          this.pointageService.checkIn(userId).subscribe({
            next: (entry) => {
              this.currentEntry = entry;
              this.checkInTime = entry.checkIn;
              this.showMessage('success', 'Arrivée enregistrée');
              this.loadMonthlyHistory();
            },
            error: (error) => {
              console.error('Erreur lors de l\'enregistrement de l\'arrivée:', error);
              this.showMessage('error', 'Erreur lors de l\'enregistrement de l\'arrivée');
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors de la vérification de la session:', error);
          this.showMessage('error', 'Erreur lors de la vérification de la session');
        }
      });
    } else if (this.currentEntry?.id && !this.checkOutTime) {
      // Check out
      this.pointageService.checkOut(this.currentEntry.id).subscribe({
        next: (entry) => {
          this.currentEntry = entry;
          this.checkOutTime = entry.checkOut || null;
          this.showMessage('success', 'Départ enregistré');
          this.loadMonthlyHistory();
        },
        error: (error) => {
          console.error('Erreur lors de l\'enregistrement du départ:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement du départ');
        }
      });
    }
  }

  toggleLunchBreak() {
    if (!this.currentEntry?.id || this.checkOutTime) return;

    if (!this.lunchStartTime) {
      // Start lunch
      this.pointageService.startLunch(this.currentEntry.id).subscribe({
        next: (entry) => {
          this.currentEntry = entry;
          this.lunchStartTime = entry.lunchStart || null;
          this.showMessage('success', 'Début de pause déjeuner enregistré');
          this.loadMonthlyHistory();
        },
        error: (error) => {
          console.error('Erreur lors de l\'enregistrement du début de pause:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement du début de pause');
        }
      });
    } else if (!this.lunchEndTime) {
      // End lunch
      this.pointageService.endLunch(this.currentEntry.id).subscribe({
        next: (entry) => {
          this.currentEntry = entry;
          this.lunchEndTime = entry.lunchEnd || null;
          this.showMessage('success', 'Fin de pause déjeuner enregistrée');
          this.loadMonthlyHistory();
        },
        error: (error) => {
          console.error('Erreur lors de l\'enregistrement de la fin de pause:', error);
          this.showMessage('error', 'Erreur lors de l\'enregistrement de la fin de pause');
        }
      });
    }
  }

  isActionDisabled(): boolean {
    if (!this.checkInTime) return false; // Permet l'arrivée
    if (this.checkOutTime) return true; // Empêche toute action après le départ
    return false; // Permet le départ
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
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'historique:', error);
        this.showMessage('error', 'Erreur lors du chargement de l\'historique');
      }
    });
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
}
