import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallDetails } from '../../../../core/interfaces/call-details.interface';
import { VoiceCallService } from '../../services/voice-call.service';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { interval, Subscription } from 'rxjs';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast';

@Component({
  selector: 'app-call-details',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, TooltipModule],
  template: `
    <div class="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg shadow-sm">
      <!-- Call Status -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi" [ngClass]="{
            'pi-phone text-green-500': callDetails.status === 'completed',
            'pi-phone-slash text-red-500': callDetails.status === 'declined',
            'pi-phone-missed text-yellow-500': callDetails.status === 'missed',
            'pi-sync text-blue-500 animate-spin': callDetails.status === 'ongoing'
          }"></i>
          <p-tag [severity]="getStatusSeverity()" [value]="getStatusLabel()"></p-tag>
        </div>
        <span class="text-sm text-gray-600">
          {{ getFormattedTime(callDetails.startTime) }}
        </span>
      </div>

      <!-- Call Duration -->
      <div class="flex items-center gap-2" *ngIf="callDetails.status === 'completed' || callDetails.status === 'ongoing'">
        <i class="pi pi-clock text-gray-500"></i>
        <span class="text-sm">
          {{ callDetails.status === 'ongoing' ? currentDuration : getFormattedDuration(callDetails.duration) }}
        </span>
      </div>

      <!-- Joinable Status -->
      <div class="flex items-center justify-between mt-1" *ngIf="callDetails.isJoinable">
        <span class="text-sm text-blue-600">
          <i class="pi pi-users mr-2"></i>
          Appel en cours
        </span>
        <button pButton 
                type="button" 
                label="Rejoindre" 
                icon="pi pi-phone" 
                class="p-button-sm p-button-success"
                (click)="joinCall()"
                pTooltip="Rejoindre l'appel en cours">
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin: 0.5rem 0;
    }
    .animate-spin {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class CallDetailsComponent implements OnInit, OnDestroy {
  @Input() callDetails!: CallDetails;
  currentDuration: string = '00:00';
  private durationSubscription?: Subscription;

  constructor(private voiceCallService: VoiceCallService) {}

  ngOnInit() {
    if (this.callDetails.status === 'ongoing') {
      this.startDurationTimer();
    }
  }

  ngOnDestroy() {
    this.durationSubscription?.unsubscribe();
  }

  private startDurationTimer() {
    const startTime = this.callDetails.startTime || new Date();
    this.durationSubscription = interval(1000).subscribe(() => {
      const duration = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      this.currentDuration = this.getFormattedDuration(duration);
    });
  }

  getStatusSeverity(): Severity {
    switch (this.callDetails.status) {
      case 'completed': return 'success';
      case 'declined': return 'danger';
      case 'missed': return 'warn';
      case 'ongoing': return 'info';
      default: return 'secondary';
    }
  }

  getStatusLabel(): string {
    switch (this.callDetails.status) {
      case 'completed': return 'Terminé';
      case 'declined': return 'Refusé';
      case 'missed': return 'Manqué';
      case 'ongoing': return 'En cours';
      default: return '';
    }
  }

  getFormattedTime(date?: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getFormattedDuration(seconds?: number): string {
    if (!seconds) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  joinCall() {
    if (this.callDetails.isJoinable) {
      this.voiceCallService.joinCall(this.callDetails.id);
    }
  }
}
