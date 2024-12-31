import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, get, off } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AudioService } from '../../../core/services/audio.service';

export interface CallStatus {
  status: 'idle' | 'calling' | 'incoming' | 'connected';
  remoteUserId?: string;
  callerName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private callStatusSubject = new BehaviorSubject<CallStatus>({ status: 'idle' });
  callStatus$ = this.callStatusSubject.asObservable();
  private db: Database = inject(Database);
  private auth: Auth = inject(Auth);
  private answerHandler: any;
  private candidatesHandler: any;
  private rejectedHandler: any;
  private remoteStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private audioService: AudioService
  ) {
    if (this.authService.isLoggedIn()) {
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      const userCallsRef = ref(this.db, `calls/${currentUserId}`);
      
      // Listen for incoming calls
      onValue(userCallsRef, async (snapshot) => {
        const callData = snapshot.val();
        if (callData?.offer && !callData.answer && !callData.rejected) {
          console.log('Incoming call detected:', callData);
          
          // Get caller's information
          const callerInfo = await this.getUserInfo(callData.callerId);
          
          // Play call sound
          this.audioService.playCallSound();
          
          // Show notification
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

      // Listen for call actions from notifications
      window.addEventListener('acceptCall', (event: any) => {
        const callerInfo = event.detail;
        if (this.callStatusSubject.value.status === 'incoming') {
          this.audioService.stopCallSound();
          this.acceptCall(callerInfo.id);
        }
      });

      window.addEventListener('declineCall', (event: any) => {
        const callerInfo = event.detail;
        if (this.callStatusSubject.value.status === 'incoming') {
          this.audioService.stopCallSound();
          this.rejectCall(callerInfo.id);
        }
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

  private cleanupCallHandlers() {
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
  }

  private async checkAuth(): Promise<boolean> {
    if (!this.authService.isLoggedIn()) {
      console.error('User must be authenticated to use voice calling features');
      return false;
    }
    return true;
  }

  private async setupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('Created new peer connection');
    
    // Add local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          console.log('Adding local track to peer connection:', track.kind);
          this.peerConnection?.addTrack(track, this.localStream);
        }
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const remoteUserId = this.callStatusSubject.value.remoteUserId;
        if (remoteUserId) {
          console.log('Sending ICE candidate to remote peer');
          const candidateRef = ref(this.db, `calls/${remoteUserId}/candidates/${Date.now()}`);
          set(candidateRef, {
            candidate: event.candidate.toJSON()
          });
        }
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', this.peerConnection?.connectionState);
      switch (this.peerConnection?.connectionState) {
        case 'connected':
          console.log('Peers connected!');
          this.callStatusSubject.next({
            status: 'connected',
            remoteUserId: this.callStatusSubject.value.remoteUserId
          });
          break;
        case 'disconnected':
        case 'failed':
          console.log('Peer connection failed or disconnected');
          this.endCall();
          break;
        case 'closed':
          console.log('Peer connection closed');
          break;
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'connected') {
        console.log('ICE connection established');
        this.callStatusSubject.next({
          status: 'connected',
          remoteUserId: this.callStatusSubject.value.remoteUserId
        });
      }
    };

    // Handle receiving remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      event.streams[0].getTracks().forEach(track => {
        if (this.remoteStream) {
          console.log('Adding remote track to stream:', track.kind);
          this.remoteStream.addTrack(track);
        }
      });
      this.handleRemoteStream(this.remoteStream);
    };

    return this.peerConnection;
  }

  private handleRemoteStream(stream: MediaStream) {
    console.log('Handling remote stream');
    
    // Remove existing audio element if it exists
    if (this.remoteAudio) {
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }

    // Create and configure new audio element
    this.remoteAudio = document.createElement('audio');
    this.remoteAudio.srcObject = stream;
    this.remoteAudio.autoplay = true;
    this.remoteAudio.classList.add('remote-audio');
    document.body.appendChild(this.remoteAudio);
    
    // Ensure audio is playing
    this.remoteAudio.play().catch(error => {
      console.error('Error playing remote audio:', error);
    });

    console.log('Remote audio element created and added to DOM');
  }

  async startCall(targetUserId: string, currentUserId: string) {
    try {
      if (!await this.checkAuth()) return;

      console.log('Starting call to:', targetUserId);
      
      // Clean up any existing call state
      this.cleanupCallHandlers();
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });
      console.log('Got local stream');

      // Setup WebRTC peer connection
      await this.setupPeerConnection();
      
      // Create and set local description
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      console.log('Created offer');
      
      await this.peerConnection!.setLocalDescription(offer);
      console.log('Set local description');

      // Store the offer in Firebase under the target user's node
      const callData = {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        callerId: currentUserId,
        timestamp: Date.now()
      };
      
      await set(ref(this.db, `calls/${targetUserId}`), callData);
      console.log('Stored offer in Firebase:', callData);

      this.callStatusSubject.next({ status: 'calling', remoteUserId: targetUserId });

      // Listen for answer in the caller's node
      this.answerHandler = `calls/${currentUserId}/answer`;
      onValue(ref(this.db, this.answerHandler), async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.peerConnection?.currentRemoteDescription === null) {
          console.log('Received answer:', answer);
          try {
            const remoteDesc = new RTCSessionDescription(answer);
            await this.peerConnection!.setRemoteDescription(remoteDesc);
            console.log('Set remote description from answer');
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      // Listen for ICE candidates
      this.candidatesHandler = `calls/${currentUserId}/candidates`;
      onValue(ref(this.db, this.candidatesHandler), async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.peerConnection) {
          Object.values(candidates).forEach(async (data: any) => {
            if (!data.candidate) return;
            
            try {
              if (!this.peerConnection!.remoteDescription) {
                console.log('Waiting for remote description before adding ICE candidate');
                return;
              }
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
              console.log('Added ICE candidate');
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });
        }
      });

    } catch (error) {
      console.error('Error starting call:', error);
      this.endCall();
    }
  }

  async handleIncomingCall(callerId: string, offer: RTCSessionDescriptionInit) {
    try {
      if (!await this.checkAuth()) return;

      console.log('Handling incoming call from:', callerId);
      
      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });
      console.log('Got local stream');

      // Setup WebRTC peer connection
      await this.setupPeerConnection();
      
      this.callStatusSubject.next({ status: 'incoming', remoteUserId: callerId });

      // Set remote description (offer)
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description (offer)');

      // Create and set local description (answer)
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('Created and set local description (answer)');

      // Store the answer in Firebase
      const callerRef = ref(this.db, `calls/${callerId}/answer`);
      await set(callerRef, {
        type: answer.type,
        sdp: answer.sdp
      });
      console.log('Stored answer in Firebase');

      // Listen for ICE candidates
      this.candidatesHandler = `calls/${callerId}/candidates`;
      onValue(ref(this.db, this.candidatesHandler), async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.peerConnection) {
          Object.values(candidates).forEach(async (data: any) => {
            if (!data.candidate) return;
            
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
              console.log('Added ICE candidate');
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });
        }
      });

      // Listen for call end
      this.rejectedHandler = `calls/${callerId}`;
      onValue(ref(this.db, this.rejectedHandler), (snapshot) => {
        if (!snapshot.exists()) {
          console.log('Call ended by caller');
          this.endCall();
        }
      });

    } catch (error) {
      console.error('Error handling incoming call:', error);
      this.endCall();
    }
  }

  async acceptCall(callerId: string): Promise<void> {
    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

      console.log('Accepting call from:', callerId);
      // Clean up any existing call state
      this.cleanupCallHandlers();
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Get the call data including the offer
      const callRef = ref(this.db, `calls/${this.authService.getCurrentUser()?.id}`);
      const snapshot = await get(callRef);
      const data = snapshot.val();
      
      console.log('Retrieved call data:', data);
      
      if (!data?.offer) {
        console.error('No offer found for incoming call');
        this.endCall();
        return;
      }

      // Get local media stream first
      this.localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });
      console.log('Got local stream');

      // Setup peer connection
      await this.setupPeerConnection();
      console.log('Peer connection set up');

      // Set remote description (offer)
      const remoteDesc = new RTCSessionDescription(data.offer);
      await this.peerConnection!.setRemoteDescription(remoteDesc);
      console.log('Set remote description (offer)');

      // Create and set local description (answer)
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('Created and set local description (answer)');

      // Store the answer in Firebase under the caller's node
      const answerData = {
        type: answer.type,
        sdp: answer.sdp
      };
      await set(ref(this.db, `calls/${callerId}/answer`), answerData);
      console.log('Stored answer in Firebase:', answerData);

      // Set up ICE candidate handling
      this.candidatesHandler = `calls/${callerId}/candidates`;
      onValue(ref(this.db, this.candidatesHandler), async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.peerConnection) {
          Object.values(candidates).forEach(async (data: any) => {
            if (!data.candidate) return;
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
              console.log('Added ICE candidate');
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });
        }
      });

    } catch (error) {
      console.error('Error accepting call:', error);
      this.audioService.stopCallSound();
      throw error;
    }
  }

  async rejectCall(callerId: string): Promise<void> {
    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

      console.log('Rejecting call from:', callerId);
      const callRef = ref(this.db, `calls/${callerId}/rejected`);
      await set(callRef, true);
      this.endCall();
    } catch (error) {
      console.error('Error rejecting call:', error);
      this.audioService.stopCallSound();
      throw error;
    }
  }

  endCall() {
    console.log('Ending call');
    
    // Stop all tracks in the local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close and cleanup the peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Remove the remote audio element
    if (this.remoteAudio) {
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }

    // Clean up Firebase handlers
    this.cleanupCallHandlers();

    // Clean up the call data in Firebase
    const currentUserId = this.authService.getCurrentUser()?.id;
    const remoteUserId = this.callStatusSubject.value.remoteUserId;
    
    if (currentUserId) {
      remove(ref(this.db, `calls/${currentUserId}`));
    }
    if (remoteUserId) {
      remove(ref(this.db, `calls/${remoteUserId}`));
    }

    // Reset call status
    this.callStatusSubject.next({ status: 'idle' });
    console.log('Call ended and cleaned up');
  }
}
