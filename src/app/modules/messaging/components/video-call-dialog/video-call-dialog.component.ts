import { Component, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectorRef, Input } from '@angular/core';
import { VideoCallService, VideoCallStatus } from '../../services/video-call.service';
import { Subscription } from 'rxjs';
import {NgClass, NgIf, NgSwitch, NgSwitchCase} from '@angular/common';

@Component({
  selector: 'app-video-call-dialog',
  templateUrl: './video-call-dialog.component.html',
  styleUrls: ['./video-call-dialog.component.scss'],
  standalone: true,
  imports: [NgIf, NgClass, NgSwitch, NgSwitchCase]
})
export class VideoCallDialogComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  @Input() visible: boolean = false;
  @Input() duration: string = '00:00';
  
  callStatus: VideoCallStatus = { status: 'idle' };
  private callStatusSubscription?: Subscription;
  isMuted: boolean = false;
  isVideoEnabled: boolean = true;
  isFullscreen: boolean = false;

  constructor(
    public videoCallService: VideoCallService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.callStatusSubscription = this.videoCallService.callStatus$.subscribe(
      status => {
        console.log('Call status changed:', status);
        this.callStatus = status;
        this.visible = status.status !== 'idle';
        
        if (status.status === 'connected') {
          this.setupVideoStreams();
        } else if (status.status === 'idle') {
          this.cleanupVideoStreams();
        }
        
        this.cdr.detectChanges();
      }
    );
  }

  private async setupVideoStreams() {
    console.log('Setting up video streams');
    const localStream = this.videoCallService.getLocalStream();
    const remoteStream = this.videoCallService.getRemoteStream();

    if (localStream && this.localVideo?.nativeElement) {
      console.log('Setting up local video stream');
      this.localVideo.nativeElement.srcObject = localStream;
      await this.localVideo.nativeElement.play().catch(err => console.error('Error playing local video:', err));
    }

    if (remoteStream && this.remoteVideo?.nativeElement) {
      console.log('Setting up remote video stream');
      this.remoteVideo.nativeElement.srcObject = remoteStream;
      await this.remoteVideo.nativeElement.play().catch(err => console.error('Error playing remote video:', err));
    }
  }

  private cleanupVideoStreams() {
    console.log('Cleaning up video streams');
    if (this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = null;
    }
    if (this.remoteVideo?.nativeElement) {
      this.remoteVideo.nativeElement.srcObject = null;
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

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    this.cdr.detectChanges();
  }

  endCall() {
    this.videoCallService.endCall();
  }

  ngOnDestroy() {
    this.callStatusSubscription?.unsubscribe();
    this.cleanupVideoStreams();
  }
}
