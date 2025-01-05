import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, get, off, update } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

interface ScreenShareState {
  isScreenSharing: boolean;
  sharerId: string | null;
  canShare: boolean;
  isLocal: boolean;
}

interface IceCandidate {
  candidate: RTCIceCandidateInit;
  timestamp: number;
}

interface SignalingData {
  sdp: string;
  type: RTCSdpType;
  timestamp: number;
}

interface ScreenShareData {
  active: boolean;
  sharerId: string;
  offer?: RTCSessionDescriptionInit;
  answers?: { [userId: string]: RTCSessionDescriptionInit };
  participants: { [key: string]: boolean };
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class RoomScreenShareService {
  screenShareStateSubject = new BehaviorSubject<ScreenShareState>({
    isScreenSharing: false,
    sharerId: null,
    canShare: true,
    isLocal: false
  });

  private _localStream: MediaStream | null = null;
  private _remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;

  constructor(
    private db: Database,
    private authService: AuthService
  ) { }

  get screenShareState$() {
    return this.screenShareStateSubject.asObservable();
  }

  get screenShareState() {
    return this.screenShareStateSubject.value;
  }

  get localStream() {
    return this._localStream;
  }

  get remoteStream() {
    return this._remoteStream;
  }

  async startScreenShare(roomId: string) {
    try {
      console.log('Starting screen share');
      
      // Get screen share stream
      this._localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: "turn:eu-west.relay.metered.ca:80",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8",
          },
          {
            urls: "turn:eu-west.relay.metered.ca:443",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8",
          }
        ]
      });

      // Set up peer connection event handlers
      this.setupPeerConnectionHandlers(this.peerConnection, roomId);

      // Add local stream tracks to peer connection
      this._localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        this.peerConnection?.addTrack(track, this._localStream!);
      });

      // Create and set local description
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('Created and set local offer');

      // Save offer to Firebase
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      const screenShareData: ScreenShareData = {
        active: true,
        sharerId: currentUserId,
        offer: {
          type: offer.type,
          sdp: offer.sdp
        },
        timestamp: Date.now(),
        participants: { [currentUserId]: true }
      };

      await set(ref(this.db, `roomScreenCalls/${roomId}`), screenShareData);
      console.log('Saved offer to Firebase');

      // Update screen share state
      this.screenShareStateSubject.next({
        isScreenSharing: true,
        sharerId: currentUserId,
        canShare: false,
        isLocal: true
      });

      // Handle track end
      this._localStream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('Track ended:', track.kind);
          this.stopScreenShare(roomId);
        };
      });

    } catch (error) {
      console.error('Error starting screen share:', error);
      this.cleanup();
    }
  }

  async stopScreenShare(roomId: string) {
    try {
      console.log('Stopping screen share');
      
      // Remove screen share data from Firebase
      await set(ref(this.db, `roomScreenCalls/${roomId}`), null);
      
      // Clean up local resources
      this.cleanup();
      
      // Log success
      console.log('Screen share stopped successfully');
    } catch (error) {
      console.error('Error stopping screen share:', error);
      // Still try to cleanup local resources
      this.cleanup();
    }
  }

  private setupPeerConnectionHandlers(peerConnection: RTCPeerConnection, roomId: string) {
    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.streams);
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        
        // Log detailed track information
        console.log('Remote stream tracks:', stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          id: track.id
        })));

        // Ensure track is enabled and unmuted
        stream.getTracks().forEach(track => {
          track.enabled = true;
          if (track instanceof MediaStreamTrack) {
            track.enabled = true;
          }
        });

        // Store remote stream
        this._remoteStream = new MediaStream(stream.getTracks());
        
        // Force state update
        this.screenShareStateSubject.next({
          ...this.screenShareState,
          isScreenSharing: true,
          isLocal: false
        });

        console.log('Remote stream updated:', {
          streamId: this._remoteStream.id,
          active: this._remoteStream.active,
          tracks: this._remoteStream.getTracks().length
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        console.log('Peer connection established successfully');
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
        console.log('Connection failed or closed, cleaning up');
        this.cleanup();
      }
    };

    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed:', peerConnection.iceConnectionState);
      if (peerConnection.iceConnectionState === 'failed') {
        console.log('ICE connection failed, restarting ICE');
        peerConnection.restartIce();
      }
    };

    // Handle ICE candidate events
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const currentUserId = String(this.authService.getCurrentUser()?.id);
        const candidatePath = `roomScreenCalls/${roomId}/candidates/${currentUserId}/${Date.now()}`;
        console.log('New ICE candidate:', event.candidate.type);
        set(ref(this.db, candidatePath), event.candidate.toJSON())
          .catch(error => console.error('Error saving ICE candidate:', error));
      }
    };

    // Handle negotiation needed
    peerConnection.onnegotiationneeded = async () => {
      console.log('Negotiation needed');
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        const currentUserId = String(this.authService.getCurrentUser()?.id);
        const updates = {
          [`roomScreenCalls/${roomId}/offer`]: {
            type: offer.type,
            sdp: offer.sdp
          }
        };
        
        await update(ref(this.db), updates);
        console.log('Updated offer during negotiation');
      } catch (error) {
        console.error('Error during negotiation:', error);
      }
    };
  }

  async listenToScreenShare(roomId: string) {
    console.log('Starting to listen for screen share in room:', roomId);
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    
    // Listen for screen share changes
    onValue(ref(this.db, `roomScreenCalls/${roomId}`), async (snapshot) => {
      try {
        const screenShareData = snapshot.val() as ScreenShareData;
        
        if (!screenShareData) {
          console.log('No screen share data');
          this.cleanup();
          return;
        }

        const isLocal = currentUserId === String(screenShareData.sharerId);
        console.log('Screen share data:', {
          data: screenShareData,
          currentUserId,
          isLocal
        });

        // Update state
        this.screenShareStateSubject.next({
          isScreenSharing: screenShareData.active,
          sharerId: screenShareData.sharerId,
          canShare: !screenShareData.active,
          isLocal: isLocal
        });

        // If screen share is not active, clean up and return
        if (!screenShareData.active) {
          this.cleanup();
          return;
        }

        // Handle remote screen share (we're receiving)
        if (!isLocal && screenShareData.offer && !this.peerConnection) {
          console.log('Detected screen share offer as remote user');

          // Create new peer connection
          this.peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              {
                urls: "turn:eu-west.relay.metered.ca:80",
                username: "f62b917dabb7524388421224",
                credential: "ut/b3FhDJE9dFzX8",
              },
              {
                urls: "turn:eu-west.relay.metered.ca:443",
                username: "f62b917dabb7524388421224",
                credential: "ut/b3FhDJE9dFzX8",
              }
            ]
          });

          // Set up peer connection handlers
          this.setupPeerConnectionHandlers(this.peerConnection, roomId);

          try {
            // Set remote description (offer)
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
              type: screenShareData.offer.type,
              sdp: screenShareData.offer.sdp
            }));
            console.log('Set remote description from offer');

            // Create and set local description (answer)
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('Created and set local answer');

            // Save answer to Firebase
            const answerData: RTCSessionDescriptionInit = {
              type: answer.type,
              sdp: answer.sdp
            };
            
            // Update participants and save answer
            const updates = {
              [`roomScreenCalls/${roomId}/answers/${currentUserId}`]: answerData,
              [`roomScreenCalls/${roomId}/participants/${currentUserId}`]: true
            };
            
            await update(ref(this.db), updates);
            console.log('Saved answer and updated participants');

          } catch (error) {
            console.error('Error in WebRTC process:', error);
          }
        }

        // Handle answers for local user
        if (isLocal && screenShareData.answers && this.peerConnection) {
          Object.entries(screenShareData.answers).forEach(async ([userId, answer]: [string, RTCSessionDescriptionInit]) => {
            if (!this.peerConnection?.currentRemoteDescription) {
              try {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log(`Set answer from user ${userId}`);
              } catch (error) {
                console.error(`Error setting answer from ${userId}:`, error);
              }
            }
          });
        }

      } catch (error) {
        console.error('Error in screen share listener:', error);
      }
    });

    // Listen for ICE candidates
    onValue(ref(this.db, `roomScreenCalls/${roomId}/candidates`), (snapshot) => {
      const candidates = snapshot.val();
      if (!candidates || !this.peerConnection) return;

      Object.entries(candidates).forEach(([userId, userCandidates]: [string, any]) => {
        if (userId !== currentUserId) {
          Object.values(userCandidates).forEach((candidate: RTCIceCandidateInit) => {
            if (this.peerConnection?.remoteDescription) {
              this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(err => console.error('Error adding ICE candidate:', err));
            }
          });
        }
      });
    });
  }

  cleanup() {
    console.log('Cleaning up WebRTC resources');
    
    // Stop all tracks in local stream
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => {
        track.stop();
      });
      this._localStream = null;
    }

    // Stop all tracks in remote stream
    if (this._remoteStream) {
      this._remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      this._remoteStream = null;
    }

    // Close and cleanup peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset screen share state
    this.screenShareStateSubject.next({
      isScreenSharing: false,
      sharerId: null,
      canShare: true,
      isLocal: false
    });
  }
}
