import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { VoiceCallService, CallStatus } from '../../services/voice-call.service';
import { ScreenShareService, ScreenShareState } from '../../services/screen-share.service';
import { Subscription } from 'rxjs';
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
export class VoiceCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localScreenVideo') localScreenVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteScreenVideo') remoteScreenVideo!: ElementRef<HTMLVideoElement>;
  
  callStatus: CallStatus = { status: 'idle' };
  screenShareState: ScreenShareState = { 
    isSharing: false, 
    remoteScreenStream: null,
    localScreenStream: null,
    remoteUserId: null
  };
  private statusSubscription: Subscription | undefined;
  private screenShareSubscription: Subscription | undefined;
  private dialogSubscription: Subscription | undefined;
  showCallDialog = false;
  callDuration$ = this.voiceCallService.callDuration$;
  isMuted = false;
  isVolumeOff = false;
  isLocalScreenFullscreen = false;
  isRemoteScreenFullscreen = false;

  constructor(
    private voiceCallService: VoiceCallService,
    private screenShareService: ScreenShareService
  ) {
    this.dialogSubscription = this.voiceCallService.showVioceCallDialog$.subscribe(
      show => {
        this.showCallDialog = show;
      }
    );
  }

  ngOnInit() {
    this.statusSubscription = this.voiceCallService.callStatus$.subscribe(
      status => {
        this.callStatus = status;
      }
    );
  }

  ngAfterViewInit() {
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    
    // Set up observers for video elements
    this.screenShareSubscription = this.screenShareService.screenShareState$.subscribe(
      state => {
        this.screenShareState = state;
        
        // Handle local screen video
        if (this.localScreenVideo?.nativeElement && state.localScreenStream) {
          this.localScreenVideo.nativeElement.srcObject = state.localScreenStream;
          this.localScreenVideo.nativeElement.onloadedmetadata = () => {
            this.localScreenVideo.nativeElement.play().catch(e => console.error('Error playing local video:', e));
          };
        }
        
        // Handle remote screen video
        if (this.remoteScreenVideo?.nativeElement && state.remoteScreenStream) {

          // Force video track to be enabled
          const videoTrack = state.remoteScreenStream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.enabled = true;

            // Create a new stream with just the video track
            const newStream = new MediaStream([videoTrack]);
            this.remoteScreenVideo.nativeElement.srcObject = newStream;
            
            // Set up video element
            this.remoteScreenVideo.nativeElement.onloadedmetadata = () => {
              this.remoteScreenVideo.nativeElement.play()
                .then(() => {
                  // Force a repaint
                  this.remoteScreenVideo.nativeElement.style.display = 'none';
                  setTimeout(() => {
                    if (this.remoteScreenVideo?.nativeElement) {
                      this.remoteScreenVideo.nativeElement.style.display = 'block';
                    }
                  }, 0);
                })
                .catch(e => console.error('Error playing remote video:', e));
            };
          } else {
            console.error('No video track in remote stream');
          }
        } else if (!state.remoteScreenStream && this.remoteScreenVideo?.nativeElement) {
          this.remoteScreenVideo.nativeElement.srcObject = null;
        }
      }
    );
  }

  ngOnDestroy() {
    this.statusSubscription?.unsubscribe();
    this.dialogSubscription?.unsubscribe();
    this.screenShareSubscription?.unsubscribe();
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      this.isLocalScreenFullscreen = false;
      this.isRemoteScreenFullscreen = false;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
  }

  toggleVolume() {
    this.isVolumeOff = !this.isVolumeOff;
  }

  async endCall() {
    this.voiceCallService.setShowVoiceCallDialog(false);
    this.voiceCallService.endCall();
    await this.screenShareService.stopScreenShare(this.callStatus.remoteUserId);

  }

  async acceptCall() {
    await this.voiceCallService.acceptCall(this.callStatus.remoteUserId);
  }

  rejectCall() {
    if (this.callStatus.remoteUserId) {
      this.voiceCallService.setShowVoiceCallDialog(false);
      this.voiceCallService.rejectCall(this.callStatus.remoteUserId);
    }
  }

  async toggleScreenShare() {
    if (this.callStatus.remoteUserId) {
      if (!this.screenShareState.isSharing) {
        await this.screenShareService.startScreenShare(this.callStatus.remoteUserId);
      } else {
        await this.screenShareService.stopScreenShare(this.callStatus.remoteUserId);
      }
    }
  }

  async toggleLocalScreenFullscreen() {
    if (!this.isLocalScreenFullscreen) {
      await this.localScreenVideo.nativeElement.requestFullscreen();
      this.isLocalScreenFullscreen = true;
    } else {
      await document.exitFullscreen();
      this.isLocalScreenFullscreen = false;
    }
  }

  async toggleRemoteScreenFullscreen() {
    if (!this.isRemoteScreenFullscreen) {
      await this.remoteScreenVideo.nativeElement.requestFullscreen();
      this.isRemoteScreenFullscreen = true;
    } else {
      await document.exitFullscreen();
      this.isRemoteScreenFullscreen = false;
    }
  }

  onRemoteVideoLoaded(event: Event) {
    const video = event.target as HTMLVideoElement;

    // Force play the video
    video.play().then(() => {
    }).catch(error => {
      console.error('Error playing remote video:', error);
    });
  }

  onRemoteVideoError(event: Event) {
    console.error('Remote video error:', event);
    const video = event.target as HTMLVideoElement;
    console.error('Video error:', video.error);
  }
}
