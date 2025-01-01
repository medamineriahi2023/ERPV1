import { Injectable, inject, NgZone } from '@angular/core';
import { Database, ref, set, onValue, remove, get, off } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AudioService } from '../../../core/services/audio.service';

export interface VideoCallStatus {
  status: 'idle' | 'calling' | 'incoming' | 'connected';
  remoteUserId?: string;
  callerName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callStatusSubject = new BehaviorSubject<VideoCallStatus>({ status: 'idle' });
  callStatus$ = this.callStatusSubject.asObservable();
  private db: Database = inject(Database);
  private auth: Auth = inject(Auth);
  private answerHandler: any;
  private candidatesHandler: any;
  private rejectedHandler: any;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private audioService: AudioService,
    private ngZone: NgZone
  ) {
    if (this.authService.isLoggedIn()) {
      this.ngZone.run(() => {
        const currentUserId = String(this.authService.getCurrentUser()?.id);
        const userVideoCallsRef = ref(this.db, `videoCalls/${currentUserId}`);
        
        onValue(userVideoCallsRef, async (snapshot) => {
          const callData = snapshot.val();
          if (callData?.offer && !callData.answer && !callData.rejected) {
            console.log('Incoming video call detected:', callData);
            
            const callerInfo = await this.getUserInfo(callData.callerId);
            this.audioService.playCallSound();
            
            await this.notificationService.showCallNotification({
              id: callData.callerId,
              name: callerInfo?.name || callData.callerId
            });
            
            this.callStatusSubject.next({
              status: 'incoming',
              remoteUserId: callData.callerId,
              callerName: callerInfo?.name
            });
          }
        });
      });
    }
  }

  private async getUserInfo(userId: string): Promise<{ name: string } | null> {
    try {
      const userRef = ref(this.db, `users/${userId}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();
      return userData ? { name: userData.name || userData.username || userId } : null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  async initiateCall(remoteUserId: string) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      
      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.callStatusSubject.next({
          ...this.callStatusSubject.value,
          status: 'connected'
        });
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const callData = {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        callerId: this.authService.getCurrentUser()?.id,
        timestamp: new Date().toISOString()
      };

      await set(ref(this.db, `videoCalls/${remoteUserId}`), callData);
      
      this.callStatusSubject.next({
        status: 'calling',
        remoteUserId
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          set(ref(this.db, `videoCalls/${remoteUserId}/candidates/${Date.now()}`), event.candidate.toJSON());
        }
      };

      // Listen for answer
      this.answerHandler = ref(this.db, `videoCalls/${remoteUserId}/answer`);
      onValue(this.answerHandler, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.peerConnection?.currentRemoteDescription === null) {
          const remoteDesc = new RTCSessionDescription(answer);
          await this.peerConnection?.setRemoteDescription(remoteDesc);
        }
      });

      // Listen for rejection
      this.rejectedHandler = ref(this.db, `videoCalls/${remoteUserId}/rejected`);
      onValue(this.rejectedHandler, (snapshot) => {
        if (snapshot.val()) {
          this.endCall();
          this.audioService.stopCallSound();
        }
      });

    } catch (error) {
      console.error('Error initiating video call:', error);
      this.endCall();
    }
  }

  async acceptCall(callerId: string) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      }).catch(error => {
        if (error.name === 'NotReadableError' || error.name === 'NotFoundError') {
          // Try fallback to lower resolution
          return navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: true
          });
        }
        throw error;
      });

      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      this.peerConnection = new RTCPeerConnection(configuration);
      
      this.localStream.getTracks().forEach(track => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        this.callStatusSubject.next({
          ...this.callStatusSubject.value,
          status: 'connected'
        });
      };

      const callRef = ref(this.db, `videoCalls/${this.authService.getCurrentUser()?.id}`);
      const snapshot = await get(callRef);
      const callData = snapshot.val();

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      await set(ref(this.db, `videoCalls/${this.authService.getCurrentUser()?.id}/answer`), {
        type: answer.type,
        sdp: answer.sdp
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          set(ref(this.db, `videoCalls/${callerId}/candidates/${Date.now()}`), event.candidate.toJSON());
        }
      };

      // Listen for remote ICE candidates
      const candidatesRef = ref(this.db, `videoCalls/${this.authService.getCurrentUser()?.id}/candidates`);
      onValue(candidatesRef, async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates) {
          for (const [, candidate] of Object.entries(candidates)) {
            if (candidate && !this.peerConnection?.remoteDescription) {
              continue;
            }
            try {
              await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error('Error adding received ICE candidate:', error);
            }
          }
        }
      });

    } catch (error) {
      console.error('Error accepting video call:', error);
      this.endCall();
    }
  }

  async rejectCall(callerId: string) {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (currentUserId) {
      await set(ref(this.db, `videoCalls/${currentUserId}/rejected`), true);
      this.cleanupCall();
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  async endCall() {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (currentUserId) {
      this.ngZone.run(async () => {
        await remove(ref(this.db, `videoCalls/${currentUserId}`));
        this.cleanupCall();
      });
    }
  }

  private cleanupCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.answerHandler) {
      off(ref(this.db, this.answerHandler));
      this.answerHandler = null;
    }
    if (this.candidatesHandler) {
      off(ref(this.db, this.candidatesHandler));
      this.candidatesHandler = null;
    }
    if (this.rejectedHandler) {
      off(ref(this.db, this.rejectedHandler));
      this.rejectedHandler = null;
    }
    this.callStatusSubject.next({ status: 'idle' });
  }
}
