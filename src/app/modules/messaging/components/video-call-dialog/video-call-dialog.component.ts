import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { VideoCallService, VideoCallStatus } from '../../services/video-call.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-video-call-dialog',
  templateUrl: './video-call-dialog.component.html',
  styleUrls: ['./video-call-dialog.component.scss'],
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule]
})
export class VideoCallDialogComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  
  videoCallStatus: VideoCallStatus = { status: 'idle' };
  showDialog = false;
  callDuration = '00:00';
  private callDurationInterval: any;
  private startTime: number = 0;
  private subscriptions: Subscription[] = [];

  constructor(private videoCallService: VideoCallService) {}

  ngOnInit() {
    // Subscribe to call status changes
    this.subscriptions.push(
      this.videoCallService.callStatus$.subscribe(status => {
        this.videoCallStatus = status;
        this.handleCallStatusChange(status);
      })
    );

    // Subscribe to show dialog changes
    this.subscriptions.push(
      this.videoCallService.showVideoCallDialog$.subscribe(show => {
        this.showDialog = show;
      })
    );

    // Subscribe to call duration updates
    this.subscriptions.push(
      this.videoCallService.callDuration$.subscribe(duration => {
        this.callDuration = duration;
      })
    );
  }

  private handleCallStatusChange(status: VideoCallStatus) {
    switch (status.status) {
      case 'connected':
        this.setupVideoStreams();
        this.startCallDurationTimer();
        break;
      case 'idle':
        this.stopCallDurationTimer();
        break;
    }
  }

  private setupVideoStreams() {
    const localStream = this.videoCallService.getLocalStream();
    const remoteStream = this.videoCallService.getRemoteStream();

    if (localStream && this.localVideo) {
      this.localVideo.nativeElement.srcObject = localStream;
    }

    if (remoteStream && this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = remoteStream;
    }
  }

  private startCallDurationTimer() {
    this.startTime = Date.now();
    this.callDurationInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
      const seconds = (duration % 60).toString().padStart(2, '0');
      this.videoCallService.setCallDuration(`${minutes}:${seconds}`);
    }, 1000);
  }

  private stopCallDurationTimer() {
    if (this.callDurationInterval) {
      clearInterval(this.callDurationInterval);
      this.callDurationInterval = null;
    }
    this.videoCallService.setCallDuration('00:00');
  }

  acceptVideoCall() {
    if (this.videoCallStatus.remoteUserId) {
      this.videoCallService.acceptCall(this.videoCallStatus.remoteUserId);
    }
  }

  rejectVideoCall() {
    if (this.videoCallStatus.remoteUserId) {
      this.videoCallService.rejectCall(this.videoCallStatus.remoteUserId);
    }
  }

  endCall() {
    this.videoCallService.endCall();
  }

  ngOnDestroy() {
    this.stopCallDurationTimer();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
