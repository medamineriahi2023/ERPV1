import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, get, off } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AudioService } from '../../../core/services/audio.service';
import { ApiService } from '../../../core/services/api.service';

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
  public showVideoCallDialogSubject = new BehaviorSubject<boolean>(false);
  public showVideoCallDialog$ = this.showVideoCallDialogSubject.asObservable();

  public callDurationSubject = new BehaviorSubject<string>('00:00');
  public callDuration$ = this.callDurationSubject.asObservable();

  constructor(
      private authService: AuthService,
      private notificationService: NotificationService,
      private audioService: AudioService,
      private apiService: ApiService
  ) {
    if (this.authService.isLoggedIn()) {
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      const userCallsRef = ref(this.db, `videoCalls/${currentUserId}`);

      // Listen for incoming calls
      onValue(userCallsRef, async (snapshot) => {
        const callData = snapshot.val();
        if (callData?.offer && !callData.answer && !callData.rejected) {
          try {
            // Get caller's information
            const callerInfo = await this.getUserInfo(callData.callerId);
            // console.log('Caller info retrieved:', callerInfo);

            // Get user from API as backup
            let callerName = callerInfo?.name;
            if (!callerName) {
              try {
                const user = await firstValueFrom(this.apiService.getUserById(parseInt(callData.callerId)));
                callerName = user ? `${user.firstName} ${user.lastName}` : null;
                // console.log('Retrieved caller name from API:', callerName);
              } catch (error) {
                console.warn('Failed to get user from API:', error);
              }
            }

            // Set final caller name
            callerName = callerName || 'Unknown Caller';
            // console.log('Final caller name:', callerName);

            // Play call sound
            this.audioService.playCallSound();

            // Show notification
            await this.notificationService.showCallNotification({
              id: callData.callerId,
              name: callerName,
              isVideo: true
            });

            // Update call status with caller information
            const callStatus: VideoCallStatus = {
              status: 'incoming',
              remoteUserId: callData.callerId,
              callerName: callerName
            };
            // console.log('Setting call status:', callStatus);
            this.callStatusSubject.next(callStatus);
          } catch (error) {
            console.error('Error handling incoming call:', error);
            // Still show the call even if we can't get the caller info
            const callStatus: VideoCallStatus = {
              status: 'incoming',
              remoteUserId: callData.callerId,
              callerName: 'Unknown Caller'
            };
            this.callStatusSubject.next(callStatus);
          }
        }
      });
    }
  }





  setShowVideoCallDialog(value: boolean) {
    this.showVideoCallDialogSubject.next(value);
  }

  setCallDuration(value: string) {
    this.callDurationSubject.next(value);
  }



  private async getUserInfo(userId: string): Promise<{ name: string } | null> {
    try {
      // First try to get user from API
      const user = await firstValueFrom(this.apiService.getUserById(parseInt(userId)));
      if (user) {
        const fullName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.name || user.username;

        // console.log('Retrieved user info from API:', { userId, fullName, user });
        return { name: fullName };
      }

      // If not found in API, try Firebase
      const userRef = ref(this.db, `users/${userId}`);
      const snapshot = await get(userRef);
      const userData = snapshot.val();

      if (userData) {
        const fullName = userData.firstName && userData.lastName
            ? `${userData.firstName} ${userData.lastName}`
            : userData.name || userData.username || userId;

        // console.log('Retrieved user info from Firebase:', { userId, fullName, userData });
        return { name: fullName };
      }

      // Finally, try auth service
      const currentUser = this.authService.getCurrentUser();
      if (currentUser && currentUser.id.toString() === userId) {
        const fullName = currentUser.firstName && currentUser.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : currentUser.name || currentUser.username;

        // console.log('Retrieved user info from auth service:', { userId, fullName, currentUser });
        return { name: fullName };
      }

      // console.log('No user data found for:', userId);
      return null;
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
      console.error('User must be authenticated to use video calling features');
      return false;
    }
    return true;
  }

  private async setupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const configuration = {
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:standard.relay.metered.ca:80",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turn:standard.relay.metered.ca:80?transport=tcp",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turn:standard.relay.metered.ca:443",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turns:standard.relay.metered.ca:443?transport=tcp",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
      ],
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    // console.log('Created new peer connection');

    // Add local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          // console.log('Adding local track to peer connection:', track.kind);
          this.peerConnection?.addTrack(track, this.localStream);
        }
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const remoteUserId = this.callStatusSubject.value.remoteUserId;
        if (remoteUserId) {
          // console.log('Sending ICE candidate to remote peer');
          const candidateRef = ref(this.db, `videoCalls/${remoteUserId}/candidates/${Date.now()}`);
          set(candidateRef, {
            candidate: event.candidate.toJSON()
          });
        }
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      // console.log('Connection state changed:', this.peerConnection?.connectionState);
      switch (this.peerConnection?.connectionState) {
        case 'connected':
          // console.log('Peers connected!');
          this.callStatusSubject.next({
            status: 'connected',
            remoteUserId: this.callStatusSubject.value.remoteUserId
          });
          break;
        case 'disconnected':
        case 'failed':
          // console.log('Peer connection failed or disconnected');
          this.endCall();
          break;
        case 'closed':
          // console.log('Peer connection closed');
          break;
      }
    };

    // Handle receiving remote tracks
    this.peerConnection.ontrack = (event) => {
      // console.log('Received remote track:', event.track.kind);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      event.streams[0].getTracks().forEach(track => {
        if (this.remoteStream) {
          // console.log('Adding remote track to stream:', track.kind);
          this.remoteStream.addTrack(track);
        }
      });
      // Notify that remote stream is available
      this.callStatusSubject.next({
        status: 'connected',
        remoteUserId: this.callStatusSubject.value.remoteUserId
      });
    };

    return this.peerConnection;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  async startCall(targetUserId: string) {
    try {
      if (!await this.checkAuth()) return;

      // console.log('Starting video call to:', targetUserId);

      // Clean up any existing call state
      this.cleanupCallHandlers();
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).catch(error => {
        if (error.name === 'NotReadableError' || error.name === 'NotFoundError') {
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

      // Setup WebRTC peer connection
      await this.setupPeerConnection();

      // Create and set local description
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      console.log('Created and set local description:', offer);

      const currentUserId = this.authService.getCurrentUser()?.id;

      // Store the offer in Firebase
      const callData = {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        callerId: currentUserId,
        timestamp: new Date().toISOString()
      };

      await set(ref(this.db, `videoCalls/${targetUserId}`), callData);
      console.log('saved database offer : ', callData)

      this.callStatusSubject.next({ status: 'calling', remoteUserId: targetUserId });

      // Listen for answer
      this.answerHandler = `videoCalls/${currentUserId}/answer`;
      onValue(ref(this.db, this.answerHandler), async (snapshot) => {
        const answer = snapshot.val();
        console.log('Received answer from database', answer);
        if (answer && this.peerConnection?.currentRemoteDescription === null) {
          try {
            const remoteDesc = new RTCSessionDescription(answer);
            await this.peerConnection!.setRemoteDescription(remoteDesc);
            console.log('Set remote description: sdp', remoteDesc);
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      // Listen for rejection
      this.rejectedHandler = `videoCalls/${targetUserId}/rejected`;
      onValue(ref(this.db, this.rejectedHandler), (snapshot) => {
        if (snapshot.val()) {
          this.audioService.stopCallSound();
          this.endCall();
        }
      });

      // Listen for ICE candidates
      this.candidatesHandler = `videoCalls/${currentUserId}/candidates`;
      onValue(ref(this.db, this.candidatesHandler), async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.peerConnection) {
          Object.values(candidates).forEach(async (data: any) => {
            if (!data.candidate) return;
            try {
              if (!this.peerConnection!.remoteDescription) {
                // console.log('Waiting for remote description before adding ICE candidate');
                return;
              }
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });
        }
      });

    } catch (error) {
      console.error('Error starting video call:', error);
      this.endCall();
    }
  }

  async acceptCall(callerId: string) {
    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

      // console.log('Accepting video call from:', callerId);

      // Clean up any existing call state
      this.cleanupCallHandlers();
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Get the call data including the offer
      const callRef = ref(this.db, `videoCalls/${this.authService.getCurrentUser()?.id}`);
      const snapshot = await get(callRef);
      const data = snapshot.val();

      if (!data?.offer) {
        console.error('No offer found for incoming call');
        this.endCall();
        return;
      }

      // Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      }).catch(error => {
        if (error.name === 'NotReadableError' || error.name === 'NotFoundError') {
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

      // Setup peer connection
      await this.setupPeerConnection();

      // Set remote description (offer)
      const remoteDesc = new RTCSessionDescription(data.offer);
      await this.peerConnection!.setRemoteDescription(remoteDesc);

      // Create and set local description (answer)
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      // Store the answer in Firebase
      await set(ref(this.db, `videoCalls/${callerId}/answer`), {
        type: answer.type,
        sdp: answer.sdp
      });

      // Listen for ICE candidates
      this.candidatesHandler = `videoCalls/${callerId}/candidates`;
      onValue(ref(this.db, this.candidatesHandler), async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.peerConnection) {
          Object.values(candidates).forEach(async (data: any) => {
            if (!data.candidate) return;
            try {
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          });
        }
      });

      // Listen for call end
      this.rejectedHandler = `videoCalls/${callerId}`;
      onValue(ref(this.db, this.rejectedHandler), (snapshot) => {
        if (!snapshot.exists()) {
          // console.log('Call ended by caller');
          this.endCall();
        }
      });

    } catch (error) {
      console.error('Error accepting video call:', error);
      this.audioService.stopCallSound();
      this.endCall();
    }
  }

  async rejectCall(callerId: string) {
    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

      // console.log('Rejecting video call from:', callerId);
      const currentUserId = this.authService.getCurrentUser()?.id;
      if (currentUserId) {
        await set(ref(this.db, `videoCalls/${currentUserId}/rejected`), true);
      }
      this.endCall();
    } catch (error) {
      console.error('Error rejecting video call:', error);
      this.audioService.stopCallSound();
      throw error;
    }
  }

  endCall() {
    // console.log('Ending video call');

    // Stop all tracks in the local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    // Stop all tracks in the remote stream
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      this.remoteStream = null;
    }

    // Close and cleanup the peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clean up Firebase handlers
    this.cleanupCallHandlers();

    // Clean up the call data in Firebase
    const currentUserId = this.authService.getCurrentUser()?.id;
    const remoteUserId = this.callStatusSubject.value.remoteUserId;

    if (currentUserId) {
      remove(ref(this.db, `videoCalls/${currentUserId}`));
    }
    if (remoteUserId) {
      remove(ref(this.db, `videoCalls/${remoteUserId}`));
    }

    // Reset call status to idle
    this.callStatusSubject.next({ status: 'idle' });
    // console.log('Video call ended and cleaned up');
  }
}
