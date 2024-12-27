import { Component, OnInit } from '@angular/core';
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
import { User } from '../../../../core/interfaces/user.interface';

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
  template: `
    <div class="min-h-screen bg-gray-50/50 p-6">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-800">Gestion du Temps</h1>
        <p class="text-gray-600 mt-1">Suivez vos heures de travail et votre présence</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Today's Status -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <div class="flex flex-col gap-6">
            <!-- Time Display -->
            <div class="text-center">
              <div class="bg-blue-50 rounded-xl p-4 mb-4">
                <h2 class="text-3xl font-bold text-blue-600 mb-1">{{currentTime | date:'HH:mm:ss'}}</h2>
                <p class="text-blue-600/75">{{today | date:'EEEE d MMMM yyyy'}}</p>
              </div>
            </div>

            <!-- Time Records -->
            <div class="space-y-4">
              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2">
                  <i class="pi pi-sign-in text-green-500"></i>
                  <span class="text-gray-700">Arrivée</span>
                </div>
                <span class="font-medium text-gray-900">{{checkInTime || '--:--'}}</span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2">
                  <i class="pi pi-clock text-orange-500"></i>
                  <span class="text-gray-700">Pause déjeuner</span>
                </div>
                <span class="font-medium text-gray-900">
                  {{lunchStartTime || '--:--'}} - {{lunchEndTime || '--:--'}}
                </span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2">
                  <i class="pi pi-sign-out text-red-500"></i>
                  <span class="text-gray-700">Départ</span>
                </div>
                <span class="font-medium text-gray-900">{{checkOutTime || '--:--'}}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <button 
                pButton 
                [label]="checkInTime ? 'Départ' : 'Arrivée'"
                [class]="'flex-1 p-3 ' + (checkInTime ? 'p-button-danger' : 'p-button-success')"
                (click)="toggleCheckInOut()"
                [disabled]="isActionDisabled()">
                <i [class]="'mr-2 ' + (checkInTime ? 'pi pi-sign-out' : 'pi pi-sign-in')"></i>
              </button>

              <button 
                pButton 
                [label]="lunchStartTime && !lunchEndTime ? 'Fin pause' : 'Début pause'"
                class="flex-1 p-3 p-button-outlined"
                (click)="toggleLunchBreak()"
                [disabled]="!checkInTime || checkOutTime">
                <i class="pi pi-clock mr-2"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Monthly Calendar -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Calendrier mensuel</h3>
          <p-calendar
            [(ngModel)]="selectedDate"
            [inline]="true"
            [showWeek]="true"
            [readonlyInput]="true"
            styleClass="w-full"
            (onSelect)="onDateSelect($event)">
          </p-calendar>
        </div>

        <!-- Daily Details -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Détails du jour sélectionné</h3>
          
          <div class="space-y-4" *ngIf="selectedDateDetails">
            <div class="p-4 bg-blue-50 rounded-lg">
              <p class="text-blue-600 font-medium">{{selectedDateDetails.date | date:'fullDate'}}</p>
            </div>

            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">Arrivée</span>
                <span [class.text-red-500]="selectedDateDetails.isLate" class="font-medium">
                  {{selectedDateDetails.checkIn || '--:--'}}
                </span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">Pause déjeuner</span>
                <span class="font-medium">
                  {{selectedDateDetails.lunchStart || '--:--'}} - {{selectedDateDetails.lunchEnd || '--:--'}}
                </span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">Départ</span>
                <span class="font-medium">{{selectedDateDetails.checkOut || '--:--'}}</span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">Total heures</span>
                <span class="font-medium text-blue-600">
                  {{selectedDateDetails.totalHours || '0'}} heures
                </span>
              </div>

              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">Status</span>
                <span [class]="getStatusBadgeClass(selectedDateDetails.status)">
                  {{getStatusLabel(selectedDateDetails.status)}}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-center h-48 bg-gray-50 rounded-lg" *ngIf="!selectedDateDetails">
            <div class="text-center">
              <i class="pi pi-calendar text-4xl text-gray-400 mb-2"></i>
              <p class="text-gray-500">Sélectionnez une date pour voir les détails</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Monthly History -->
      <div class="mt-6">
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Historique mensuel</h3>
          
          <p-table 
            [value]="monthlyHistory"
            [paginator]="true"
            [rows]="10"
            [showCurrentPageReport]="true"
            responsiveLayout="scroll"
            [rowsPerPageOptions]="[10,25,50]"
            styleClass="p-datatable-sm"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries">

            <ng-template pTemplate="header">
              <tr class="bg-gray-50">
                <th class="text-gray-700">Date</th>
                <th class="text-gray-700">Arrivée</th>
                <th class="text-gray-700">Pause déjeuner</th>
                <th class="text-gray-700">Départ</th>
                <th class="text-gray-700">Total heures</th>
                <th class="text-gray-700">Status</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-record>
              <tr class="hover:bg-gray-50">
                <td>{{record.date | date:'fullDate'}}</td>
                <td [class.text-red-500]="record.isLate">{{record.checkIn || '--:--'}}</td>
                <td>{{record.lunchStart || '--:--'}} - {{record.lunchEnd || '--:--'}}</td>
                <td>{{record.checkOut || '--:--'}}</td>
                <td class="font-medium">{{record.totalHours || '0'}} heures</td>
                <td>
                  <span [class]="getStatusBadgeClass(record.status)">
                    {{getStatusLabel(record.status)}}
                  </span>
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </div>
    </div>

    <p-toast></p-toast>
  `,
  styles: [`
    :host ::ng-deep {
      .p-button {
        border-radius: 0.5rem;
      }

      .p-calendar {
        width: 100%;
        .p-datepicker {
          border: none;
          box-shadow: none;
          width: 100%;
          
          table {
            font-size: 0.875rem;
            
            th {
              padding: 0.5rem;
            }
            
            td {
              padding: 0.25rem;
              
              &.p-datepicker-today > span {
                background: #EFF6FF;
                color: #3B82F6;
                border-color: #3B82F6;
              }
              
              &.p-highlight > span {
                background: #3B82F6;
                color: #ffffff;
              }
            }
          }
        }
      }

      .p-datatable {
        border-radius: 0.5rem;
        overflow: hidden;

        .p-datatable-header {
          background: #ffffff;
          border: none;
          padding: 1rem;
        }

        .p-datatable-thead > tr > th {
          background: #F9FAFB;
          border: none;
          padding: 0.75rem 1rem;
          font-weight: 600;
        }

        .p-datatable-tbody > tr {
          transition: all 0.2s ease;
          
          > td {
            border: none;
            border-bottom: 1px solid #F3F4F6;
            padding: 0.75rem 1rem;
          }

          &:last-child > td {
            border-bottom: none;
          }
        }

        .p-paginator {
          background: #ffffff;
          border: none;
          padding: 1rem;
        }
      }
    }
  `]
})
export class PointageComponent implements OnInit {
  currentUser: User | null = null;
  today = new Date();
  currentTime = new Date();
  selectedDate = new Date();
  checkInTime: string | null = null;
  checkOutTime: string | null = null;
  lunchStartTime: string | null = null;
  lunchEndTime: string | null = null;
  selectedDateDetails: any = null;
  monthlyHistory: any[] = [];
  timeInterval: any;

  constructor(
    private pointageService: PointageService,
    private authService: AuthService,
    private messageService: MessageService
  ) {}

  ngOnInit() {
    this.loadData();
    this.startClock();
  }

  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  private startClock() {
    this.timeInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  private loadData() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.currentUser = user as User;

    const todayEntry = this.pointageService.getTimeEntry(
      this.currentUser.id,
      this.today
    );

    if (todayEntry) {
      this.checkInTime = todayEntry.checkIn;
      this.checkOutTime = todayEntry.checkOut || null;
      this.lunchStartTime = todayEntry.lunchStart || null;
      this.lunchEndTime = todayEntry.lunchEnd || null;
    }

    this.loadSelectedDateDetails(this.selectedDate);
    this.loadMonthlyHistory();
  }

  private loadSelectedDateDetails(date: Date) {
    if (!this.currentUser) return;

    this.selectedDateDetails = this.pointageService.getTimeEntry(
      this.currentUser.id,
      date
    );
  }

  private loadMonthlyHistory() {
    if (!this.currentUser) return;

    const currentMonth = this.selectedDate.getMonth();
    const currentYear = this.selectedDate.getFullYear();
    
    this.monthlyHistory = this.pointageService.getMonthlyEntries(
      this.currentUser.id,
      currentMonth,
      currentYear
    );
  }

  toggleCheckInOut() {
    if (!this.currentUser) return;

    if (!this.checkInTime) {
      // Check in
      this.checkInTime = this.formatTime(new Date());
      this.pointageService.checkIn(this.currentUser.id);
      this.showMessage('success', 'Arrivée enregistrée');
    } else {
      // Check out
      this.checkOutTime = this.formatTime(new Date());
      this.pointageService.checkOut(this.currentUser.id);
      this.showMessage('success', 'Départ enregistré');
    }

    this.loadData();
  }

  toggleLunchBreak() {
    if (!this.currentUser) return;

    if (!this.lunchStartTime) {
      // Start lunch
      this.lunchStartTime = this.formatTime(new Date());
      this.pointageService.startLunch(this.currentUser.id);
      this.showMessage('success', 'Début de pause déjeuner enregistré');
    } else {
      // End lunch
      this.lunchEndTime = this.formatTime(new Date());
      this.pointageService.endLunch(this.currentUser.id);
      this.showMessage('success', 'Fin de pause déjeuner enregistrée');
    }

    this.loadData();
  }

  onDateSelect(date: Date) {
    this.selectedDate = date;
    this.loadSelectedDateDetails(date);
  }

  isActionDisabled(): boolean {
    return (
      (!!this.checkInTime && !!this.checkOutTime) || // Already checked out
      (!this.checkInTime && this.isPastWorkday()) // Past day without check-in
    );
  }

  isPastWorkday(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(this.selectedDate);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private showMessage(severity: string, detail: string) {
    this.messageService.add({
      severity,
      summary: severity === 'success' ? 'Succès' : 'Erreur',
      detail
    });
  }

  getStatusLabel(status: string): string {
    const labels = {
      present: 'Présent',
      absent: 'Absent',
      leave: 'Congé',
      holiday: 'Férié'
    };
    return labels[status as keyof typeof labels] || status;
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
      default:
        return `${baseClasses} bg-gray-50 text-gray-700`;
    }
  }
}
