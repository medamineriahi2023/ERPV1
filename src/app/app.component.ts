import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AngularFireModule } from "@angular/fire/compat";
import { VoiceCallService } from "@app/modules/messaging/services/voice-call.service";
import { VideoCallDialogComponent } from "@app/modules/messaging/components/video-call-dialog/video-call-dialog.component";
import { VideoCallService } from "@app/modules/messaging/services/video-call.service";
import { VoiceCallComponent } from "@app/modules/messaging/components/voice-call/voice-call.component";
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-root',
  template: `
    <main class="min-h-screen bg-gray-50">
      <router-outlet></router-outlet>
      <app-video-call-dialog></app-video-call-dialog>
      <app-voice-call></app-voice-call>
    </main>
  `,
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    AngularFireModule,
    VideoCallDialogComponent,
    VoiceCallComponent,
  ],
  providers: [
    MessageService, 
    ConfirmationService, 
    VoiceCallService,
    VideoCallService
  ]
})
export class AppComponent {
  constructor(
    private videoCallService: VideoCallService,
    private voiceCallService: VoiceCallService
  ) {
    // Listen for voice call status changes
    this.voiceCallService.callStatus$.subscribe(status => {
      if (status.status === 'incoming') {
        this.voiceCallService.setShowVoiceCallDialog(true);
      }
    });
  }
}
