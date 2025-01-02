import { Injectable, inject, OnDestroy } from '@angular/core';
import { Database, ref, set, onValue, remove, off } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

export interface ScreenShareState {
  isSharing: boolean;
  remoteScreenStream: MediaStream | null;
  localScreenStream: MediaStream | null;
}

@Injectable({
  providedIn: 'root'
})
export class ScreenShareService implements OnDestroy {
  private db: Database = inject(Database);
  private screenStream: MediaStream | null = null;
  private screenPeerConnection: RTCPeerConnection | null = null;
  private offerHandler: any;
  private candidatesHandler: any;

  private screenShareStateSubject = new BehaviorSubject<ScreenShareState>({
    isSharing: false,
    remoteScreenStream: null,
    localScreenStream: null
  });
  
  screenShareState$ = this.screenShareStateSubject.asObservable();

  constructor(private authService: AuthService) {
    this.setupScreenShareListeners();
  }

  private setupScreenShareListeners(): void {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (!currentUserId) return;

    // Listen for incoming screen share offers
    const screenShareRef = ref(this.db, `screenShare/${currentUserId}`);
    this.offerHandler = onValue(screenShareRef, async (snapshot) => {
      const data = snapshot.val();
      if (data?.offer && !data.answer && data.sharerId) {
        console.log('Incoming screen share detected:', data);
        await this.handleIncomingScreenShare(data.sharerId, data.offer);
      }
    });

    // Listen for ICE candidates
    const candidatesRef = ref(this.db, `screenShare/${currentUserId}/candidates`);
    this.candidatesHandler = onValue(candidatesRef, async (snapshot) => {
      const candidates = snapshot.val();
      if (candidates && this.screenPeerConnection) {
        for (const [, candidate] of Object.entries(candidates)) {
          try {
            await this.screenPeerConnection.addIceCandidate(
              new RTCIceCandidate(candidate as RTCIceCandidateInit)
            );
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      }
    });
  }

  ngOnDestroy() {
    // Clean up Firebase listeners
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (currentUserId) {
      const screenShareRef = ref(this.db, `screenShare/${currentUserId}`);
      const candidatesRef = ref(this.db, `screenShare/${currentUserId}/candidates`);
      off(screenShareRef, 'value', this.offerHandler);
      off(candidatesRef, 'value', this.candidatesHandler);
    }
  }

  async startScreenShare(remoteUserId: string): Promise<void> {
    try {
      console.log('Starting screen share for remote user:', remoteUserId);
      
      // Get screen stream with specific constraints
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          frameRate: { ideal: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      console.log('Got screen stream:', this.screenStream);
      console.log('Screen stream tracks:', this.screenStream.getTracks());

      const configuration = {
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80"
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          }
        ]
      };

      // Close existing connection
      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
        this.screenPeerConnection = null;
      }

      this.screenPeerConnection = new RTCPeerConnection(configuration);

      // Update state with local stream
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        isSharing: true,
        localScreenStream: this.screenStream
      });

      // Add tracks to peer connection
      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track in screen stream');
      }

      console.log('Adding video track to peer connection');
      this.screenPeerConnection.addTrack(videoTrack, this.screenStream);

      // Set up negotiation needed handler
      this.screenPeerConnection.onnegotiationneeded = async () => {
        try {
          console.log('Creating offer due to negotiation needed');
          const offer = await this.screenPeerConnection!.createOffer();
          await this.screenPeerConnection!.setLocalDescription(offer);

          console.log('Sending offer to remote user');
          const currentUserId = this.authService.getCurrentUser()?.id;
          await set(ref(this.db, `screenShare/${remoteUserId}`), {
            offer: {
              type: offer.type,
              sdp: offer.sdp
            },
            sharerId: currentUserId
          });
        } catch (error) {
          console.error('Error during negotiation:', error);
        }
      };

      // Handle ICE candidates
      this.screenPeerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
          await set(ref(this.db, `screenShare/${remoteUserId}/candidates/${Date.now()}`), 
            event.candidate.toJSON()
          );
        }
      };

      // Listen for ICE connection state changes
      this.screenPeerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.screenPeerConnection?.iceConnectionState);
      };

      // Listen for connection state changes
      this.screenPeerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', this.screenPeerConnection?.connectionState);
      };

      // Listen for answer
      const currentUserId = this.authService.getCurrentUser()?.id;
      const answerRef = ref(this.db, `screenShare/${currentUserId}/answer`);
      onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.screenPeerConnection?.signalingState !== 'stable') {
          try {
            console.log('Setting remote description from answer');
            await this.screenPeerConnection?.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      // Handle screen share stop
      videoTrack.onended = () => {
        console.log('Screen share stopped by user');
        this.stopScreenShare(remoteUserId);
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
      this.stopScreenShare(remoteUserId);
    }
  }

  async handleIncomingScreenShare(sharerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('Handling incoming screen share from:', sharerId);

      const configuration = {
        iceServers: [
          {
            urls: "stun:stun.relay.metered.ca:80"
          },
          {
            urls: "turn:global.relay.metered.ca:80",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username: "f62b917dabb7524388421224",
            credential: "ut/b3FhDJE9dFzX8"
          }
        ]
      };

      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
        this.screenPeerConnection = null;
      }

      this.screenPeerConnection = new RTCPeerConnection(configuration);
      console.log('Created new peer connection for receiving');

      // Set up track handler
      this.screenPeerConnection.ontrack = (event) => {
        console.log('Received track:', event.track.kind, event.track.id);
        console.log('Track settings:', event.track.getSettings());
        
        if (event.track.kind === 'video') {
          // Create a new stream with the received track
          const stream = new MediaStream([event.track]);
          
          // Update the state with the stream
          this.screenShareStateSubject.next({
            ...this.screenShareStateSubject.value,
            remoteScreenStream: stream
          });

          // Log track state changes
          event.track.onmute = () => {
            console.log('Track muted');
            this.screenShareStateSubject.next({
              ...this.screenShareStateSubject.value,
              remoteScreenStream: null
            });
          };
          
          event.track.onunmute = () => {
            console.log('Track unmuted');
            this.screenShareStateSubject.next({
              ...this.screenShareStateSubject.value,
              remoteScreenStream: stream
            });
          };
        }
      };

      // Set up ICE candidate handling
      this.screenPeerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Generated ICE candidate');
          await set(ref(this.db, `screenShare/${sharerId}/candidates/${Date.now()}`), 
            event.candidate.toJSON()
          );
        }
      };

      // Set up connection monitoring
      this.screenPeerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', this.screenPeerConnection?.iceConnectionState);
      };

      this.screenPeerConnection.onconnectionstatechange = () => {
        const state = this.screenPeerConnection?.connectionState;
        console.log('Connection state:', state);
        
        if (state === 'failed' || state === 'closed') {
          this.screenShareStateSubject.next({
            ...this.screenShareStateSubject.value,
            remoteScreenStream: null
          });
        }
      };

      // Set the remote description (offer)
      console.log('Setting remote description');
      await this.screenPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create and set the answer
      console.log('Creating answer');
      const answer = await this.screenPeerConnection.createAnswer();
      console.log('Setting local description');
      await this.screenPeerConnection.setLocalDescription(answer);

      // Send the answer
      await set(ref(this.db, `screenShare/${sharerId}/answer`), {
        type: answer.type,
        sdp: answer.sdp
      });

      // Handle incoming ICE candidates
      const candidatesRef = ref(this.db, `screenShare/${sharerId}/candidates`);
      onValue(candidatesRef, async (snapshot) => {
        const candidates = snapshot.val();
        if (candidates && this.screenPeerConnection) {
          for (const [, candidate] of Object.entries(candidates)) {
            try {
              await this.screenPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('Added ICE candidate');
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          }
        }
      });

    } catch (error) {
      console.error('Error in handleIncomingScreenShare:', error);
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        remoteScreenStream: null
      });
    }
  }

  async stopScreenShare(remoteUserId: string): Promise<void> {
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenPeerConnection?.close();
    
    this.screenStream = null;
    this.screenPeerConnection = null;

    // Clean up Firebase
    const currentUserId = this.authService.getCurrentUser()?.id;
    await remove(ref(this.db, `screenShare/${remoteUserId}`));
    await remove(ref(this.db, `screenShare/${currentUserId}`));

    this.screenShareStateSubject.next({
      isSharing: false,
      remoteScreenStream: null,
      localScreenStream: null
    });
  }
}
