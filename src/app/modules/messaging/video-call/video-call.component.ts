import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { WebRTCService } from '../../../core/services/webrtc.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <!-- Incoming Call Dialog -->
    <div class="incoming-call" *ngIf="incomingCall">
      <div class="call-info">
        <h3>Incoming {{incomingCall.type}} call</h3>
        <p>{{incomingCall.caller.name}} is calling...</p>
        <div class="call-actions">
          <button pButton icon="pi pi-phone" class="p-button-success p-button-rounded"
                  (click)="acceptCall()"></button>
          <button pButton icon="pi pi-times" class="p-button-danger p-button-rounded"
                  (click)="rejectCall()"></button>
        </div>
      </div>
    </div>

    <!-- Video Call Interface -->
    <div class="video-call-container" *ngIf="isCallActive">
      <div class="video-grid">
        <div class="remote-video">
          <video #remoteVideo autoplay playsinline></video>
          <div class="call-status" *ngIf="!hasRemoteStream">
            Connecting...
          </div>
        </div>
        <div class="local-video">
          <video #localVideo autoplay playsinline muted></video>
        </div>
      </div>
      <div class="call-controls">
        <button pButton icon="pi pi-video" class="p-button-rounded" 
                [class.p-button-danger]="!isVideoEnabled"
                (click)="toggleVideo()"></button>
        <button pButton icon="pi pi-microphone" class="p-button-rounded"
                [class.p-button-danger]="!isAudioEnabled"
                (click)="toggleAudio()"></button>
        <button pButton icon="pi pi-phone" class="p-button-rounded p-button-danger"
                (click)="endCall()"></button>
      </div>
    </div>
  `,
  styles: [`
    .incoming-call {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--surface-card);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 1100;
      animation: slideIn 0.3s ease-out;
    }

    .call-info {
      text-align: center;

      h3 {
        margin: 0 0 0.5rem;
        color: var(--text-color);
      }

      p {
        margin: 0 0 1rem;
        color: var(--text-color-secondary);
      }

      .call-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;

        button {
          width: 50px;
          height: 50px;
        }
      }
    }

    .video-call-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .video-grid {
      flex: 1;
      display: flex;
      position: relative;
    }

    .remote-video {
      width: 100%;
      height: 100%;
      position: relative;
      background: #1a1a1a;

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .call-status {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 1.2rem;
      }
    }

    .local-video {
      position: absolute;
      right: 20px;
      bottom: 20px;
      width: 200px;
      height: 150px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);

      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .call-controls {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 50px;
      backdrop-filter: blur(10px);

      button {
        width: 50px;
        height: 50px;
        font-size: 1.2rem;
      }
    }

    @keyframes slideIn {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @media (max-width: 390px) {
      .incoming-call {
        top: 10px;
        right: 10px;
        left: 10px;
        padding: 1rem;
      }

      .local-video {
        width: 120px;
        height: 90px;
        right: 10px;
        bottom: 100px;
      }

      .call-controls {
        bottom: 20px;
        padding: 0.75rem;

        button {
          width: 40px;
          height: 40px;
          font-size: 1rem;
        }
      }
    }
  `]
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  isCallActive = false;
  hasRemoteStream = false;
  isVideoEnabled = true;
  isAudioEnabled = true;
  incomingCall: any = null;

  private subscriptions: Subscription[] = [];

  constructor(private webRTCService: WebRTCService) {}

  ngOnInit() {
    this.subscriptions.push(
      this.webRTCService.localVideoStream.subscribe(stream => {
        if (stream) {
          this.isCallActive = true;
          this.localVideo.nativeElement.srcObject = stream;
        } else {
          this.isCallActive = false;
        }
      }),

      this.webRTCService.remoteVideoStream.subscribe(stream => {
        if (stream) {
          this.hasRemoteStream = true;
          this.remoteVideo.nativeElement.srcObject = stream;
        } else {
          this.hasRemoteStream = false;
        }
      }),

      this.webRTCService.incomingCallRequest.subscribe(call => {
        this.incomingCall = call;
      })
    );
  }

  acceptCall() {
    this.webRTCService.acceptCall();
  }

  rejectCall() {
    this.webRTCService.rejectCall();
  }

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.webRTCService.toggleVideo();
  }

  toggleAudio() {
    this.isAudioEnabled = !this.isAudioEnabled;
    this.webRTCService.toggleAudio();
  }

  endCall() {
    this.webRTCService.endCall();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webRTCService.endCall();
  }
}