import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { VoiceCallService, CallStatus } from '../../services/voice-call.service';
import { ScreenShareService, ScreenShareState } from '../../services/screen-share.service';
import { Subscription } from 'rxjs';
import { ButtonModule } from "primeng/button";
import { DialogModule } from "primeng/dialog";
import { TooltipModule } from 'primeng/tooltip';
import {AsyncPipe, NgClass, NgIf, NgSwitch} from "@angular/common";

@Component({
  selector: 'app-voice-call',
  templateUrl: './voice-call.component.html',
  styleUrls: ['./voice-call.component.scss'],
  standalone: true,
  imports: [
    AsyncPipe,
    DialogModule,
    ButtonModule,
    TooltipModule,
  ]
})
export class VoiceCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localScreenVideo') localScreenVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteScreenVideo') remoteScreenVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('localAudio') localAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;

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
  isFullscreen = false;
  isSpeakerOff = false;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;

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

    // Initialize Web Audio API
    this.initializeAudioContext();
  }

  ngAfterViewInit() {
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
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
  }

  async toggleMute() {
    this.isMuted = !this.isMuted;
  }

  async toggleVolume() {
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
    await this.toggleFullscreen(this.localScreenVideo.nativeElement);
  }

  async toggleRemoteScreenFullscreen() {
    await this.toggleFullscreen(this.remoteScreenVideo.nativeElement);
  }

  async toggleFullscreen(videoElement: HTMLVideoElement) {
    try {
      const container = videoElement.parentElement as HTMLElement;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      // Store current time and playing state
      const currentTime = videoElement.currentTime;
      const wasPlaying = !videoElement.paused;
      
      if (!document.fullscreenElement &&
          !(document as any).webkitFullscreenElement &&
          !(document as any).mozFullScreenElement &&
          !(document as any).msFullscreenElement) {
        
        // For iOS Safari
        if (isMobile && (videoElement as any).webkitEnterFullscreen) {
          await (videoElement as any).webkitEnterFullscreen();
          this.isFullscreen = true;
          return;
        }
        
        // Try standard fullscreen API
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }
        this.isFullscreen = true;

        // Restore video state after a short delay
        setTimeout(() => {
          if (wasPlaying) {
            videoElement.play().catch(console.error);
          }
          if (currentTime > 0) {
            videoElement.currentTime = currentTime;
          }
        }, 100);

      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        this.isFullscreen = false;

        // Restore video state after a short delay
        setTimeout(() => {
          if (wasPlaying) {
            videoElement.play().catch(console.error);
          }
          if (currentTime > 0) {
            videoElement.currentTime = currentTime;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      
      // Fallback for iOS
      try {
        if ((videoElement as any).webkitEnterFullscreen) {
          await (videoElement as any).webkitEnterFullscreen();
          this.isFullscreen = true;
        }
      } catch (iosError) {
        console.error('iOS fullscreen fallback failed:', iosError);
      }
    }
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  @HostListener('document:mozfullscreenchange')
  @HostListener('document:MSFullscreenChange')
  onFullscreenChange() {
    this.isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
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

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 1.0; // Default volume
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  toggleSpeaker() {
    if (!this.remoteAudio?.nativeElement) return;

    this.isSpeakerOff = !this.isSpeakerOff;
    
    if (this.gainNode) {
      // When speaker is off, reduce volume to minimum but not zero
      // When speaker is on, restore to full volume
      const targetGain = this.isSpeakerOff ? 0.01 : 1.0;
      
      // Smooth transition
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioContext!.currentTime);
      this.gainNode.gain.exponentialRampToValueAtTime(
        targetGain,
        this.audioContext!.currentTime + 0.1
      );
    }

    // Try to switch audio output if available (modern browsers)
    if ('setSinkId' in HTMLMediaElement.prototype) {
      const audioElement = this.remoteAudio.nativeElement;
      (audioElement as any).setSinkId(this.isSpeakerOff ? 'default' : 'speaker')
        .catch((error: any) => {
          console.warn('Failed to change audio output:', error);
        });
    }
  }
}
