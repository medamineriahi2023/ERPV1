import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Database, ref, set, onValue, remove, off } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

export interface ScreenShareState {
  isSharing: boolean;
  remoteScreenStream: MediaStream | null;
  localScreenStream: MediaStream | null;
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
            if (this.screenPeerConnection.remoteDescription) {
              await this.screenPeerConnection.addIceCandidate(
                  new RTCIceCandidate(candidate as RTCIceCandidateInit)
              );
              console.log('Successfully added ICE candidate:', candidate);
            } else {
              // Queue the candidate if remote description is not set
              this.iceCandidateQueue.push(new RTCIceCandidate(candidate));
              console.log('Queued ICE candidate:', candidate);
            }
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
          height: { ideal: 1080 },
        },
      });

      console.log('Got screen stream:', this.screenStream);
      console.log('Screen stream tracks:', this.screenStream.getTracks());

      const configuration = {
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
        localScreenStream: this.screenStream,
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
          this.ngZone.run(() => {
            set(ref(this.db, `screenShare/${remoteUserId}`), {
              offer: {
                type: offer.type,
                sdp: offer.sdp,
              },
              sharerId: currentUserId,
            });
          });
        } catch (error) {
          console.error('Error during negotiation:', error);
        }
      };

      // Handle ICE candidates
      this.screenPeerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('New ICE candidate:', event.candidate);
          this.ngZone.run(() => {
            set(ref(this.db, `screenShare/${remoteUserId}/candidates/${Date.now()}`), event.candidate.toJSON());
          });
        } else {
          console.log('All ICE candidates have been generated.');
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

      if (this.screenPeerConnection) {
        this.screenPeerConnection.close();
        this.screenPeerConnection = null;
      }

      this.screenPeerConnection = new RTCPeerConnection(configuration);
      console.log('Created new peer connection for receiving');

      // Set up track handler
      this.screenPeerConnection.ontrack = (event) => {
        console.log('Received track:', event.track.kind, event.track.id);
        if (event.track.kind === 'video') {
          const stream = new MediaStream([event.track]);
          this.screenShareStateSubject.next({
            ...this.screenShareStateSubject.value,
            remoteScreenStream: stream,
          });
        }
      };

      // Set up ICE candidate handling
      this.screenPeerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('Generated ICE candidate');
          this.ngZone.run(() => {
            set(ref(this.db, `screenShare/${sharerId}/candidates/${Date.now()}`), event.candidate.toJSON());
          });
        }
      };

      // Set the remote description (offer)
      console.log('Setting remote description');
      await this.screenPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued ICE candidates
      while (this.iceCandidateQueue.length > 0) {
        const candidate = this.iceCandidateQueue.shift();
        if (candidate) {
          await this.screenPeerConnection.addIceCandidate(candidate);
          console.log('Added queued ICE candidate:', candidate);
        }
      }

      // Create and set the answer
      console.log('Creating answer');
      const answer = await this.screenPeerConnection.createAnswer();
      console.log('Setting local description');
      await this.screenPeerConnection.setLocalDescription(answer);

      // Send the answer
      this.ngZone.run(() => {
        set(ref(this.db, `screenShare/${sharerId}/answer`), {
          type: answer.type,
          sdp: answer.sdp,
        });
      });
    } catch (error) {
      console.error('Error in handleIncomingScreenShare:', error);
      this.screenShareStateSubject.next({
        ...this.screenShareStateSubject.value,
        remoteScreenStream: null,
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
    });
  }
}
