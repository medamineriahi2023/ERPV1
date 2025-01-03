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

  private createPeerConnection(): RTCPeerConnection {
    const configuration = {
      iceServers: [
        {
          urls: [
            "stun:fr-turn1.xirsys.com",
            "turn:fr-turn1.xirsys.com:80?transport=udp",
            "turn:fr-turn1.xirsys.com:3478?transport=udp",
            "turn:fr-turn1.xirsys.com:80?transport=tcp",
            "turn:fr-turn1.xirsys.com:3478?transport=tcp",
            "turns:fr-turn1.xirsys.com:443?transport=tcp",
            "turns:fr-turn1.xirsys.com:5349?transport=tcp",
          ],
          username: "Wv-mSGEE-ILOUk_kyhlfn2w39Zq9jMmTCH3ife2YMljfX_ZK6Eb10QEiMB7N1sLhAAAAAGd3B6dtZWRhbWluZXI=",
          credential: "18b4c574-c952-11ef-b6d6-0242ac120004",
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

  async startScreenShare(remoteUserId: string): Promise<void> {
    try {
      // Clean up existing connections first
      await this.stopScreenShare(remoteUserId);

      // Get screen stream
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
      });

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
            console.log('Received answer:', answer);
            await this.screenPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('Remote description set successfully');
          } catch (error) {
            console.error('Error setting remote description:', error);
          }
        }
      });

      // Handle screen share stop
      videoTrack.onended = () => {
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
      console.log('Received offer:', offer);

      // Clean up existing connection
      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
      }

      // Create new peer connection
      this.screenPeerConnection = this.createPeerConnection();

      // Set remote description (offer)
      console.log('Setting remote description');
      await this.screenPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Remote description set successfully');

      // Create answer with specific constraints
      const answerOptions = {
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
        voiceActivityDetection: false
      };

      console.log('Creating answer with options:', answerOptions);
      const answer = await this.screenPeerConnection.createAnswer(answerOptions);

      // Set local description
      console.log('Setting local description:', answer);
      await this.screenPeerConnection.setLocalDescription(answer);

      // Update state
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        remoteUserId: sharerId,
      });

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

      // Get the final answer after ICE gathering
      const finalAnswer = this.screenPeerConnection.localDescription;
      console.log('Final answer after ICE gathering:', finalAnswer);

      if (!finalAnswer) {
        throw new Error('Failed to create final answer');
      }

      // Send the final answer
      console.log('Sending final answer to database');
      await this.ngZone.run(() =>
        set(ref(this.db, `screenShare/${sharerId}/answer`), {
          type: finalAnswer.type,
          sdp: finalAnswer.sdp,
        })
      );

      // Process any queued candidates
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

  async stopScreenShare(remoteUserId: string): Promise<void> {
    this.screenStream?.getTracks().forEach((track) => track.stop());
    this.screenPeerConnection?.close();

    this.screenStream = null;
    this.screenPeerConnection = null;

    // Clean up Firebase
    const currentUserId = this.authService.getCurrentUser()?.id;
    this.ngZone.run(() => {
      remove(ref(this.db, `screenShare/${remoteUserId}`));
      remove(ref(this.db, `screenShare/${currentUserId}`));
    });

    this.screenShareStateSubject.next({
      isSharing: false,
      remoteScreenStream: null,
      localScreenStream: null,
      remoteUserId: null,
    });
  }
}
