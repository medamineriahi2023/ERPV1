import { Component, OnInit, OnDestroy } from '@angular/core';
import { VoiceCallService, CallStatus } from '../../services/voice-call.service';
import { Subscription } from 'rxjs';
import { Avatar } from "primeng/avatar";
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TooltipModule } from 'primeng/tooltip';
import { AsyncPipe, NgIf } from "@angular/common";

@Component({
  selector: 'app-voice-call',
  templateUrl: './voice-call.component.html',
  styleUrls: ['./voice-call.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    AsyncPipe,
    DialogModule,
    ButtonModule,
    TooltipModule
  ]
})
export class VoiceCallComponent implements OnInit, OnDestroy {
  callStatus: CallStatus = { status: 'idle' };
  private statusSubscription: Subscription | undefined;
  private dialogSubscription: Subscription | undefined;
  showCallDialog = false;
  callDuration$ = this.voiceCallService.callDuration$;
  isMuted = false;
  isVolumeOff = false;

  constructor(private voiceCallService: VoiceCallService) {
    this.dialogSubscription = this.voiceCallService.showVioceCallDialog$.subscribe(
      show => {
        console.log('Dialog visibility changed:', show);
        this.showCallDialog = show;
      }
    );
  }

  ngOnInit() {
    this.statusSubscription = this.voiceCallService.callStatus$.subscribe(
      status => {
        console.log('Call status changed:', status);
        this.callStatus = status;
      }
    );
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
    this.dialogSubscription?.unsubscribe();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
  }

  toggleVolume() {
    this.isVolumeOff = !this.isVolumeOff;
  }

  endCall() {
    console.log('Ending call');
    this.voiceCallService.endCall();
    this.voiceCallService.setShowVoiceCallDialog(false);
  }

  async acceptCall() {
    await this.voiceCallService.acceptCall(this.callStatus.remoteUserId);
  }

  rejectCall() {
    if (this.callStatus.remoteUserId) {
      console.log('Rejecting call');
      this.voiceCallService.rejectCall(this.callStatus.remoteUserId);
      this.voiceCallService.setShowVoiceCallDialog(false);
    }
  }
}
