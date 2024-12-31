import { Component, OnInit, OnDestroy } from '@angular/core';
import { VoiceCallService, CallStatus } from '../../services/voice-call.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-voice-call',
  templateUrl: './voice-call.component.html',
  styleUrls: ['./voice-call.component.scss']
})
export class VoiceCallComponent implements OnInit, OnDestroy {
  callStatus: CallStatus = { status: 'idle' };
  private statusSubscription: Subscription | undefined;

  constructor(private voiceCallService: VoiceCallService) {}

  ngOnInit() {
    this.statusSubscription = this.voiceCallService.callStatus$.subscribe(
      status => this.callStatus = status
    );
  }

  initiateCall(targetUserId: string, currentUserId: string) {
    this.voiceCallService.startCall(targetUserId, currentUserId);
  }

  acceptCall(callerId: string) {
    this.voiceCallService.acceptCall(callerId);
  }

  rejectCall(callerId: string) {
    this.voiceCallService.rejectCall(callerId);
  }

  endCall() {
    this.voiceCallService.endCall();
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
    this.voiceCallService.endCall();
  }
}
