import { Injectable, inject, NgZone } from '@angular/core';
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
  photoUrl?: string;
  receiverName?: string,
  receiverPhotoUrl?:string
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
  public showVoiceCallDialogSubject = new BehaviorSubject<boolean>(false);
  public showVioceCallDialog$ = this.showVoiceCallDialogSubject.asObservable();

  private callDurationSubject = new BehaviorSubject<string>('00:00');
  public callDuration$ = this.callDurationSubject.asObservable();
  private callStartTime: number | null = null;
  private timerInterval: any;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private audioService: AudioService,
    private ngZone: NgZone
  ) {
    if (this.authService.isLoggedIn()) {
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      const userCallsRef = ref(this.db, `calls/${currentUserId}`);

      // Listen for incoming calls
      onValue(userCallsRef, async (snapshot) => {
        const callData = snapshot.val();
        if (callData?.offer && !callData.answer && !callData.rejected) {

          // Get caller's information
          const callerInfo = await this.getUserInfo(callData.callerId);

          // Play call sound
          this.audioService.playCallSound();

          // Show notification
          await this.notificationService.showCallNotification({
            id: callData.callerId,
            name: callerInfo?.name || callData.callerName || 'Unknown'
          });

          this.callStatusSubject.next({
            status: 'incoming',
            remoteUserId: callData.callerId,
            callerName: callerInfo?.name || callData.callerName || 'Unknown',
            photoUrl: callData.photoUrl
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

  setShowVoiceCallDialog(value: boolean) {
    this.showVoiceCallDialogSubject.next(value);
  }

  setCallDuration(value: string) {
    this.callDurationSubject.next(value);
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
      iceServers: [{
        urls: [ "stun:fr-turn1.xirsys.com" ]
      }, {
        username: "Wv-mSGEE-ILOUk_kyhlfn2w39Zq9jMmTCH3ife2YMljfX_ZK6Eb10QEiMB7N1sLhAAAAAGd3B6dtZWRhbWluZXI=",
        credential: "18b4c574-c952-11ef-b6d6-0242ac120004",
        urls: [
          "turn:fr-turn1.xirsys.com:80?transport=udp",
          "turn:fr-turn1.xirsys.com:3478?transport=udp",
          "turn:fr-turn1.xirsys.com:80?transport=tcp",
          "turn:fr-turn1.xirsys.com:3478?transport=tcp",
          "turns:fr-turn1.xirsys.com:443?transport=tcp",
          "turns:fr-turn1.xirsys.com:5349?transport=tcp"
        ]
      }]
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    console.log('Peer connection created for voice:', this.peerConnection);
    // Add local tracks to the connection
    this.localStream.getTracks().forEach(track => {
      if (this.localStream) {
        this.peerConnection?.addTrack(track, this.localStream);
      }
    });


    // Add ICE gathering state logging
    this.peerConnection.onicegatheringstatechange = () => {

      // Log all ICE candidates when gathering is complete
      if (this.peerConnection?.iceGatheringState === 'complete') {
        const receivers = this.peerConnection?.getReceivers() || [];
        receivers.forEach(receiver => {
          const stats = receiver.getStats();
          stats.then(statsReport => {
            statsReport.forEach(report => {
              if (report.type === 'candidate-pair' && report.selected) {
              }
            });
          });
        });
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const remoteUserId = this.callStatusSubject.value.remoteUserId;
        if (remoteUserId) {
          const candidateRef = ref(this.db, `calls/${remoteUserId}/candidates/${Date.now()}`);
          set(candidateRef, {
            candidate: event.candidate.toJSON()
          });
        }
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      switch (this.peerConnection?.connectionState) {
        case 'connected':
          this.callStatusSubject.next({
            status: 'connected',
            remoteUserId: this.callStatusSubject.value.remoteUserId
          });
          console.log("connected to voice")
          break;
        case 'disconnected':
          console.log("disconnected from voice")
          break;
        case 'failed':
          this.endCall();
          this.setShowVoiceCallDialog(false);
          break;
        case 'closed':
          this.setShowVoiceCallDialog(false);
          break;
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection?.iceConnectionState === 'connected') {
        this.callStatusSubject.next({
          status: 'connected',
          remoteUserId: this.callStatusSubject.value.remoteUserId
        });
      }
    };

    // Handle receiving remote tracks
    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      event.streams[0].getTracks().forEach(track => {
        if (this.remoteStream) {
          this.remoteStream.addTrack(track);
        }
      });
      this.handleRemoteStream(this.remoteStream);
    };

    return this.peerConnection;
  }

  private handleRemoteStream(stream: MediaStream) {

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

  }

  async startCall(targetUserId: string, currentUserId: string, callerName: string, photoUrl?: string ,
                  receiverName?: string, receiverPhotoUrl?:string) {
    try {
      if (!await this.checkAuth()) return;


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

      // Setup WebRTC peer connection
      this.peerConnection = await this.setupPeerConnection();

      // Create offer with specific constraints
      const offerOptions = {
        offerToReceiveAudio: true,
        voiceActivityDetection: true
      };

      console.log('Creating offer with options:', offerOptions);
      const offer = await this.peerConnection.createOffer(offerOptions);
      console.log('Created initial offer:', JSON.stringify(offer));

      // Set local description
      console.log('Setting local description');
      await this.peerConnection.setLocalDescription(offer);

      // Get the exact offer that was set
      const currentOffer = this.peerConnection.localDescription;
      console.log('Current local description:', JSON.stringify(currentOffer));

      // Send the exact same offer to Firebase
      const currentUserId = this.authService.getCurrentUser()?.id;
      console.log('Sending offer to database');
      const offerForDb = {
        type: currentOffer?.type,
        sdp: currentOffer?.sdp
      };

      console.log('Offer being saved to database:', JSON.stringify(offerForDb));
      await this.ngZone.run(async () => {
        await set(ref(this.db, `calls/${targetUserId}`), {
          offer: offerForDb,
          callerId: currentUserId,
          callerName: callerName,
          photoUrl: photoUrl,
          receiverName: receiverName,
          receiverPhotoUrl: receiverPhotoUrl,
          timestamp: Date.now()
        });
      });

      // Verify the saved offer
      const savedOffer = (await get(ref(this.db, `calls/${targetUserId}/offer`))).val();
      console.log('Offer saved in database:', JSON.stringify(savedOffer));

      if (JSON.stringify(offerForDb) !== JSON.stringify(savedOffer)) {
        console.error('Offer mismatch between local and database!');
        console.log('Difference:', {
          local: offerForDb,
          database: savedOffer
        });
      }

      this.callStatusSubject.next({ status: 'calling', remoteUserId: targetUserId, callerName: callerName,photoUrl: photoUrl,receiverName: receiverName, receiverPhotoUrl: receiverPhotoUrl });

      // Listen for answer in the caller's node
      this.answerHandler = `calls/${currentUserId}/answer`;
      onValue(ref(this.db, this.answerHandler), async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.peerConnection?.currentRemoteDescription === null) {
          try {
            const remoteDesc = new RTCSessionDescription(answer);
            await this.peerConnection!.setRemoteDescription(remoteDesc);

            // Start timer when answer is received and connection is established
            await this.handleCallConnected(targetUserId, callerName,photoUrl);
          } catch (error) {
            console.error('Error setting remote description:', error);
            this.setShowVoiceCallDialog(false);
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
                return;
              }
              const candidate = new RTCIceCandidate(data.candidate);
              await this.peerConnection!.addIceCandidate(candidate);
            } catch (error) {
            }
          });
        }
      });

    } catch (error) {
      console.error('Error starting call:', error);
      this.endCall();
      this.setShowVoiceCallDialog(false);
    }
  }

  async acceptCall(remoteUserId: string | undefined) {
    if (!remoteUserId) return;

    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

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

      // Setup peer connection
      this.peerConnection = await this.setupPeerConnection();

      // Set remote description (offer)
      const remoteDesc = new RTCSessionDescription(data.offer);
      await this.peerConnection!.setRemoteDescription(remoteDesc);

      // Create and set local description (answer)
      const answer = await this.peerConnection!.createAnswer({
        offerToReceiveAudio: true
      });
      console.log('Created initial answer:', JSON.stringify(answer));

      await this.peerConnection!.setLocalDescription(answer);

      // Get the exact answer that was set
      const currentAnswer = this.peerConnection!.localDescription;
      console.log('Current local description:', JSON.stringify(currentAnswer));

      // Store the exact answer in Firebase
      const answerForDb = {
        type: currentAnswer?.type,
        sdp: currentAnswer?.sdp
      };
      console.log('Answer being saved to database:', JSON.stringify(answerForDb));

      await this.ngZone.run(async () => {
        await set(ref(this.db, `calls/${remoteUserId}/answer`), answerForDb);
      });

      // Verify the saved answer
      const savedAnswer = (await get(ref(this.db, `calls/${remoteUserId}/answer`))).val();
      console.log('Answer saved in database:', JSON.stringify(savedAnswer));

      if (JSON.stringify(answerForDb) !== JSON.stringify(savedAnswer)) {
        console.error('Answer mismatch between local and database!');
        console.log('Difference:', {
          local: answerForDb,
          database: savedAnswer
        });
      }

      // Set up ICE candidate handling
      this.candidatesHandler = `calls/${remoteUserId}/candidates`;
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

      // Handle call connected state
      await this.handleCallConnected(remoteUserId, this.callStatusSubject.value.callerName || 'Unknown', this.callStatusSubject.value.photoUrl);

    } catch (error) {
      console.error('Error accepting call:', error);
      this.audioService.stopCallSound();
      this.endCall();
    }
  }

  async rejectCall(remoteUserId: string) {
    try {
      this.audioService.stopCallSound();
      if (!await this.checkAuth()) return;

      const callRef = ref(this.db, `calls/${remoteUserId}/rejected`);
      await set(callRef, true);
      this.endCall();
    } catch (error) {
      console.error('Error rejecting call:', error);
      this.audioService.stopCallSound();
      this.endCall();
      this.setShowVoiceCallDialog(false);

    }
  }

  endCall() {
    // Stop the timer

    this.setShowVoiceCallDialog(false);

    this.stopCallTimer();


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


  }

  private startCallTimer() {
    // Clear any existing timer
    this.stopCallTimer();

    this.callStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.callStartTime) {
        const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const formattedDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.callDurationSubject.next(formattedDuration);
      }
    }, 1000);
  }

  private stopCallTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.callStartTime = null;
    this.callDurationSubject.next('00:00');
  }

  private async handleCallConnected(userId: string, userName: string, photoUrl?: string) {
    this.callStatusSubject.next({
      status: 'connected',
      remoteUserId: userId,
      callerName: userName,
      photoUrl: photoUrl
    });
    this.startCallTimer();
  }
}
