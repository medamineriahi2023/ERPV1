import { Component, OnInit, OnDestroy } from '@angular/core';
import { TimeEntry, User } from '@app/core/interfaces/user.interface';
import { AuthService } from '@app/core/services/auth.service';
import { PointageService } from '@app/core/services/pointage.service';
import { ApiService } from '@app/core/services/api.service';
import { MessageService } from 'primeng/api';
import { interval, Subscription, forkJoin } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TimeEntryWithUser extends TimeEntry {
  userDetails?: Omit<User, 'password'>;
}

@Component({
  selector: 'app-team-pointage',
  templateUrl: './team-pointage.component.html',
  styleUrls: ['./team-pointage.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CalendarModule,
    InputTextModule,
    DropdownModule,
    ToastModule
  ],
  providers: [MessageService]
})
export class TeamPointageComponent implements OnInit, OnDestroy {
  today: Date = new Date();
  currentTime: Date = new Date();
  selectedDate: Date = new Date();
  teamEntries: TimeEntryWithUser[] = [];
  filteredEntries: TimeEntryWithUser[] = [];
  selectedDateDetails: TimeEntry | null = null;
  monthlyHistory: TimeEntryWithUser[] = [];
  currentUser: User | null = null;
  searchTerm: string = '';
  selectedStatus: string = '';
  private refreshInterval: Subscription | null = null;

  statusOptions = [
    { label: 'Tous les statuts', value: '' },
    { label: 'Présent', value: 'present' },
    { label: 'Absent', value: 'absent' },
    { label: 'En congé', value: 'leave' },
    { label: 'En congé férié', value: 'holiday' },
    { label: 'En retard', value: 'late' }
  ];

  constructor(
    private pointageService: PointageService,
    private authService: AuthService,
    private apiService: ApiService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.setupTimeUpdate();
    this.setupDataRefresh();
    this.loadMonthlyHistory();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      this.refreshInterval.unsubscribe();
    }
  }

  // Méthodes de calcul pour le template
  getPresentCount(): number {
    return this.teamEntries.filter(e => e.status === 'present').length;
  }

  getAbsentCount(): number {
    return this.teamEntries.filter(e => e.status === 'absent').length;
  }

  getLateCount(): number {
    return this.teamEntries.filter(e => e.status === 'late').length;
  }

  getLeaveCount(): number {
    return this.teamEntries.filter(e => e.status === 'leave' || e.status === 'holiday').length;
  }

  private setupTimeUpdate() {
    interval(1000).subscribe(() => {
      this.currentTime = new Date();
    });
  }

  private setupDataRefresh() {
    if (!this.currentUser?.managedEmployees?.length) return;

    this.refreshInterval = interval(60000)
      .pipe(startWith(0))
      .subscribe(() => {
        this.loadTeamEntries();
      });
  }

  private loadTeamEntries() {
    if (!this.currentUser?.managedEmployees?.length) {
      this.showMessage('error', 'Aucun employé à gérer');
      return;
    }

    this.pointageService.getTeamActiveEntries(this.currentUser.managedEmployees)
      .subscribe({
        next: (entries) => {
          // Créer un tableau de requêtes pour obtenir les détails de chaque utilisateur
          const userRequests = entries.map(entry => 
            this.apiService.getUserById(entry.userId).pipe(
              map(user => {
                const { password, ...userWithoutPassword } = user;
                return {
                  ...entry,
                  userDetails: userWithoutPassword
                };
              })
            )
          );

          // Exécuter toutes les requêtes en parallèle
          forkJoin(userRequests).subscribe({
            next: (entriesWithUsers) => {
              this.teamEntries = entriesWithUsers;
              this.filteredEntries = entriesWithUsers;
              this.filterEntries();
            },
            error: (error) => {
              console.error('Erreur lors du chargement des détails des utilisateurs:', error);
              this.showMessage('error', 'Erreur lors du chargement des détails des utilisateurs');
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors du chargement des données de l\'équipe:', error);
          this.showMessage('error', 'Erreur lors du chargement des données de l\'équipe');
        }
      });
  }

  private loadMonthlyHistory() {
    if (!this.currentUser?.managedEmployees?.length) {
      this.showMessage('error', 'Aucun employé à gérer');
      return;
    }

    this.pointageService.getTeamEntries(this.currentUser.managedEmployees)
      .subscribe({
        next: (entries) => {
          // Créer un tableau de requêtes pour obtenir les détails de chaque utilisateur
          const userRequests = entries.map(entry => 
            this.apiService.getUserById(entry.userId).pipe(
              map(user => {
                const { password, ...userWithoutPassword } = user;
                return {
                  ...entry,
                  userDetails: userWithoutPassword
                };
              })
            )
          );

          // Exécuter toutes les requêtes en parallèle
          forkJoin(userRequests).subscribe({
            next: (entriesWithUsers) => {
              this.monthlyHistory = entriesWithUsers;
            },
            error: (error) => {
              console.error('Erreur lors du chargement des détails des utilisateurs:', error);
              this.showMessage('error', 'Erreur lors du chargement des détails des utilisateurs');
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors du chargement de l\'historique:', error);
          this.showMessage('error', 'Erreur lors du chargement de l\'historique');
        }
      });
  }

  onDateSelect(date: Date) {
    this.selectedDate = date;
    this.loadSelectedDateDetails();
  }

  private loadSelectedDateDetails() {
    const selectedEntry = this.monthlyHistory.find(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getDate() === this.selectedDate.getDate() &&
             entryDate.getMonth() === this.selectedDate.getMonth() &&
             entryDate.getFullYear() === this.selectedDate.getFullYear();
    });

    this.selectedDateDetails = selectedEntry || null;
  }

  filterEntries() {
    this.filteredEntries = this.teamEntries.filter(entry => {
      const matchesSearch = this.searchTerm ? 
        (entry.userDetails ? 
          `${entry.userDetails.firstName} ${entry.userDetails.lastName}`.toLowerCase().includes(this.searchTerm.toLowerCase()) :
          entry.userId.toString().includes(this.searchTerm.toLowerCase())
        ) :
        true;
      
      const matchesStatus = this.selectedStatus ? 
        entry.status === this.selectedStatus :
        true;

      return matchesSearch && matchesStatus;
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'present':
        return 'Présent';
      case 'absent':
        return 'Absent';
      case 'late':
        return 'En retard';
      case 'leave':
        return 'En congé';
      case 'holiday':
        return 'Congé férié';
      default:
        return status;
    }
  }

  getStatusBadgeClass(status: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-sm font-medium';
    switch (status) {
      case 'present':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'absent':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'late':
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case 'leave':
      case 'holiday':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getEmployeeFullName(entry: TimeEntryWithUser): string {
    if (!entry.userDetails) return `Employé #${entry.userId}`;
    return `${entry.userDetails.firstName} ${entry.userDetails.lastName}`;
  }

  private showMessage(severity: string, detail: string) {
    this.messageService.add({
      severity,
      summary: severity === 'error' ? 'Erreur' : 'Succès',
      detail,
      life: 3000
    });
  }
}
