import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Database, ref, set, onValue, remove, off } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

export interface ScreenShareState {
  isSharing: boolean;
  remoteScreenStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remoteUserId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ScreenShareService implements OnDestroy {
  private db: Database = inject(Database);
  private screenStream: MediaStream | null = null;
  private screenPeerConnection: RTCPeerConnection | null = null;
  private offerHandler: any;
  private candidatesHandler: any;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private ngZone = inject(NgZone);
  private screenShareStoppedHandler: string | null = null;

  private screenShareStateSubject = new BehaviorSubject<ScreenShareState>({
    isSharing: false,
    remoteScreenStream: null,
    localScreenStream: null,
    remoteUserId: null, // Add this
  });

  screenShareState$ = this.screenShareStateSubject.asObservable();

  constructor(private authService: AuthService) {
    this.setupScreenShareListeners();
  }

  private setupScreenShareListeners() {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (!currentUserId) return;

    // Listen for incoming screen share offers
    const screenShareRef = ref(this.db, `screenShare/${currentUserId}`);
    this.offerHandler = onValue(screenShareRef, async (snapshot) => {
      const data = snapshot.val();
      if (data?.offer && data.sharerId && data.sharerId !== currentUserId) {
        console.log('Received offer from:', data.sharerId);
        await this.handleIncomingScreenShare(data.sharerId, data.offer);
      }
    });

    // Listen for ICE candidates
    const candidatesRef = ref(this.db, `screenShare/${currentUserId}/candidates`);
    this.candidatesHandler = onValue(candidatesRef, async (snapshot) => {
      const candidates = snapshot.val();
      if (candidates && this.screenPeerConnection) {
        Object.values(candidates).forEach(async (candidate: any) => {
          if (this.screenPeerConnection?.remoteDescription) {
            try {
              await this.screenPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('Added ICE candidate');
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
            }
          } else {
            this.iceCandidateQueue.push(new RTCIceCandidate(candidate));
            console.log('Queued ICE candidate');
          }
        });
      }
    });

    // Listen for remote user stopping screen share
    this.screenShareStoppedHandler = `screenShare/${currentUserId}/isScreenSharing`;
    onValue(ref(this.db, this.screenShareStoppedHandler), (snapshot) => {
      const isScreenSharing = snapshot.val();
      if (isScreenSharing === false) {
        this.stopScreenShare();
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
    if (this.screenShareStoppedHandler) {
      off(ref(this.db, this.screenShareStoppedHandler));
      this.screenShareStoppedHandler = null;
    }
  }

  private createPeerConnection(): RTCPeerConnection {
    const configuration = {
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:global.relay.metered.ca:80",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turn:global.relay.metered.ca:80?transport=tcp",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turn:global.relay.metered.ca:443",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
        {
          urls: "turns:global.relay.metered.ca:443?transport=tcp",
          username: "792b7484640b2867935852e4",
          credential: "yjXN2HcYE6E5eXUy",
        },
      ],
    };

    const peerConnection = new RTCPeerConnection(configuration);

    // Set up ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Generated ICE candidate');
        const remoteUserId = this.screenShareStateSubject.value.remoteUserId; // Use the remote user ID
        console.log('New ICE candidate:', event.candidate);
        console.log('Candidate type:', event.candidate.type); // Check candidate type (host, srflx, relay)
        if (remoteUserId) {
          this.ngZone.run(() => {
            set(ref(this.db, `screenShare/${remoteUserId}/candidates/${Date.now()}`), event.candidate.toJSON());
          });
        }
      } else {
        console.log('All ICE candidates have been generated.');
      }
    };

    // Set up track handler
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const stream = new MediaStream([event.track]);
      this.ngZone.run(() => {
        this.screenShareStateSubject.next({
          ...this.screenShareStateSubject.value,
          remoteScreenStream: stream,
        });
      });
    };

    return peerConnection;
  }

  private async getDisplayMedia(): Promise<MediaStream | null> {
    try {
      // Check if running on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobile) {
        // For mobile devices, try to use the rear camera as fallback
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use rear camera
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } else {
        // For desktop, use screen sharing
        return await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 15, max: 30 },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          },
        });
      }
    } catch (error) {
      console.error('Error getting display media:', error);
      return null;
    }
  }

  async startScreenShare(remoteUserId: string): Promise<void> {
    try {
      // Clean up existing connections first
      await this.stopScreenShare(remoteUserId);

      // Get screen stream
      this.screenStream = await this.getDisplayMedia();
      if (!this.screenStream) {
        throw new Error('Failed to get display media stream');
      }

      const videoTrack = this.screenStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('No video track in screen stream');
      }

      // Create new peer connection
      this.screenPeerConnection = this.createPeerConnection();

      // Add track to peer connection
      this.screenPeerConnection.addTrack(videoTrack, this.screenStream);

      // Update state with local stream and remote user ID
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        isSharing: true,
        localScreenStream: this.screenStream,
        remoteUserId: remoteUserId,
      });

      // Create offer with specific constraints
      const offerOptions = {
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
        voiceActivityDetection: false
      };

      console.log('Creating offer with options:', offerOptions);
      const offer = await this.screenPeerConnection.createOffer(offerOptions);

      // Set local description and wait for it to complete
      console.log('Setting local description:', offer);
      await this.screenPeerConnection.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (this.screenPeerConnection!.iceGatheringState === 'complete') {
          resolve();
        } else {
          this.screenPeerConnection!.onicegatheringstatechange = () => {
            if (this.screenPeerConnection!.iceGatheringState === 'complete') {
              resolve();
            }
          };
        }
      });

      // Get the final local description after ICE gathering
      const finalOffer = this.screenPeerConnection.localDescription;
      console.log('Final offer after ICE gathering:', finalOffer);

      if (!finalOffer) {
        throw new Error('Failed to create final offer');
      }

      // Send the final offer
      const currentUserId = this.authService.getCurrentUser()?.id;
      console.log('Sending final offer to database');
      await this.ngZone.run(() =>
        set(ref(this.db, `screenShare/${remoteUserId}`), {
          offer: {
            type: finalOffer.type,
            sdp: finalOffer.sdp,
          },
          sharerId: currentUserId,
          timestamp: Date.now(),
        })
      );

      // Listen for answer
      const answerRef = ref(this.db, `screenShare/${currentUserId}/answer`);
      onValue(answerRef, async (snapshot) => {
        const answer = snapshot.val();
        if (answer && this.screenPeerConnection) {
          try {
            console.log('Received answer from database:', answer);
            const rtcAnswer = new RTCSessionDescription(answer);
            console.log('Created RTCSessionDescription:', rtcAnswer);
            
            if (this.screenPeerConnection.signalingState === 'have-local-offer') {
              await this.screenPeerConnection.setRemoteDescription(rtcAnswer);
              console.log('Remote description set successfully:', this.screenPeerConnection.remoteDescription);
              console.log('Current signaling state:', this.screenPeerConnection.signalingState);
            } else {
              console.warn('Unexpected signaling state:', this.screenPeerConnection.signalingState);
            }
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      // Handle screen share stop
      videoTrack.onended = () => {
        this.stopScreenShare(remoteUserId);
      };

      // Update Firebase to indicate screen sharing has started
      await this.ngZone.run(() =>
        set(ref(this.db, `screenShare/${remoteUserId}/isScreenSharing`), true)
      );

    } catch (error) {
      console.error('Error starting screen share:', error);
      this.stopScreenShare(remoteUserId);
    }
  }

  async handleIncomingScreenShare(sharerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('Handling incoming screen share from:', sharerId);
      console.log('Received offer:', offer);

      // Clean up existing connection
      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
      }

      // Create new peer connection
      this.screenPeerConnection = this.createPeerConnection();

      // Set remote description (offer)
      console.log('Setting remote description');
      const rtcOffer = new RTCSessionDescription(offer);
      await this.screenPeerConnection.setRemoteDescription(rtcOffer);
      console.log('Remote description set successfully:', this.screenPeerConnection.remoteDescription);
      console.log('Current signaling state:', this.screenPeerConnection.signalingState);

      // Create answer with specific constraints
      const answerOptions = {
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
        voiceActivityDetection: false
      };

      console.log('Creating answer with options:', answerOptions);
      const answer = await this.screenPeerConnection.createAnswer(answerOptions);
      console.log('Created answer:', answer);

      // Set local description
      console.log('Setting local description');
      await this.screenPeerConnection.setLocalDescription(answer);
      console.log('Local description set:', this.screenPeerConnection.localDescription);

      // Update state
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        remoteUserId: sharerId,
      });

      // Wait for ICE gathering to complete
      console.log('Waiting for ICE gathering to complete...');
      await new Promise<void>((resolve) => {
        const checkState = () => {
          console.log('Current ICE gathering state:', this.screenPeerConnection?.iceGatheringState);
          if (this.screenPeerConnection?.iceGatheringState === 'complete') {
            resolve();
          } else {
            setTimeout(checkState, 100); // Check every 100ms
          }
        };
        checkState();
      });

      // Get the final answer after ICE gathering
      const finalAnswer = this.screenPeerConnection.localDescription;
      console.log('Final answer after ICE gathering:', finalAnswer);

      if (!finalAnswer) {
        throw new Error('Failed to create final answer');
      }

      // Clone and prepare the answer for database
      const answerForDb = {
        type: finalAnswer.type,
        sdp: finalAnswer.sdp
      };
      console.log('Preparing answer for database:', answerForDb);

      // Send the final answer
      console.log('Sending final answer to database');
      await this.ngZone.run(async () => {
        await set(ref(this.db, `screenShare/${sharerId}/answer`), answerForDb);
        console.log('Answer saved to database successfully');
      });

      // Process any queued candidates
      console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates`);
      while (this.iceCandidateQueue.length > 0) {
        const candidate = this.iceCandidateQueue.shift();
        if (candidate) {
          await this.screenPeerConnection.addIceCandidate(candidate);
          console.log('Added queued ICE candidate');
        }
      }

    } catch (error) {
      console.error('Error in handleIncomingScreenShare:', error);
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        remoteScreenStream: null,
        remoteUserId: null,
      });
    }
  }

  async stopScreenShare(remoteUserId?: string): Promise<void> {
    try {
      // Use provided remoteUserId or get it from state
      const targetUserId = remoteUserId || this.screenShareStateSubject.value.remoteUserId;
      
      if (!targetUserId) {
        console.warn('No remote user ID available for stopping screen share');
        return;
      }

      // Update Firebase to indicate screen sharing has stopped
      await this.ngZone.run(() =>
        set(ref(this.db, `screenShare/${targetUserId}/isScreenSharing`), false)
      );

      // Stop local stream tracks
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop());
        this.screenStream = null;
      }

      // Clean up peer connection
      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
        this.screenPeerConnection = null;
      }

      // Clean up Firebase data
      const currentUserId = this.authService.getCurrentUser()?.id;
      if (currentUserId) {
        await remove(ref(this.db, `screenShare/${currentUserId}`));
      }
      await remove(ref(this.db, `screenShare/${targetUserId}`));

      // Update state
      this.screenShareStateSubject.next({
        isSharing: false,
        remoteScreenStream: null,
        localScreenStream: null,
        remoteUserId: null,
      });

    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }
}
