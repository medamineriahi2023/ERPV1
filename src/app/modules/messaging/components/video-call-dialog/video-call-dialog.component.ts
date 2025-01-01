import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { VideoCallService, VideoCallStatus } from '../../services/video-call.service';
import { Subscription } from 'rxjs';
import { NgIf } from "@angular/common";

@Component({
    selector: 'app-video-call-dialog',
    templateUrl: './video-call-dialog.component.html',
    styleUrls: ['./video-call-dialog.component.scss'],
    standalone: true,
    imports: [NgIf]
})
export class VideoCallDialogComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Input() duration: string = '00:00';
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  callStatus: VideoCallStatus = { status: 'idle' };
  private callStatusSubscription?: Subscription;
  isMuted: boolean = false;
  isVideoEnabled: boolean = true;

  constructor(private videoCallService: VideoCallService) {}

  ngOnInit() {
    this.callStatusSubscription = this.videoCallService.callStatus$.subscribe(
      status => {
        this.callStatus = status;
        if (status.status === 'connected') {
          this.setupVideoStreams();
        }
      }
    );
  }

  private async setupVideoStreams() {
    const localStream = this.videoCallService.getLocalStream();
    const remoteStream = this.videoCallService.getRemoteStream();

    if (localStream && this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = localStream;
    }

    if (remoteStream && this.remoteVideo?.nativeElement) {
      this.remoteVideo.nativeElement.srcObject = remoteStream;
    }
  }

  toggleMute() {
    const localStream = this.videoCallService.getLocalStream();
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isMuted = !this.isMuted;
    }
  }

  toggleVideo() {
    const localStream = this.videoCallService.getLocalStream();
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      this.isVideoEnabled = !this.isVideoEnabled;
    }
  }

  endCall() {
    this.videoCallService.endCall();
  }

  ngOnDestroy() {
    this.callStatusSubscription?.unsubscribe();
  }
}
