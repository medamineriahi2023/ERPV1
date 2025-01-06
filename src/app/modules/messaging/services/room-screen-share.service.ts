import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, off } from '@angular/fire/database';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

interface ScreenShareState {
  isScreenSharing: boolean;
  sharerId: string | null;
  canShare: boolean;
  isLocal: boolean;
}

interface ICECandidateData {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  usernameFragment: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class RoomScreenShareService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private _localStream: MediaStream | null = null;
  private _remoteStreams: Map<string, MediaStream> = new Map();
  private db: Database = inject(Database);
  private roomRef: any;
  private candidatesRef: any;
  private signallingListeners: { [key: string]: any } = {};
  private candidateListeners: { [key: string]: any } = {};

  screenShareStateSubject = new BehaviorSubject<ScreenShareState>({
    isScreenSharing: false,
    sharerId: null,
    canShare: true,
    isLocal: false
  });

  screenShareState$ = this.screenShareStateSubject.asObservable();

  get screenShareState(): ScreenShareState {
    return this.screenShareStateSubject.value;
  }

  get localStream(): MediaStream | null {
    return this._localStream;
  }

  get remoteStreams(): Map<string, MediaStream> {
    return this._remoteStreams;
  }

  constructor(private authService: AuthService) {}

  async startScreenShare(roomId: string): Promise<void> {
    try {
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      
      // Get screen share stream
      this._localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Update room state
      const roomRef = ref(this.db, `roomScreenCalls/${roomId}`);
      await set(roomRef, {
        active: true,
        sharerId: currentUserId,
        timestamp: Date.now()
      });

      // Set up participants separately to avoid overwriting
      await set(ref(this.db, `roomScreenCalls/${roomId}/participants/${currentUserId}`), true);

      // Listen for participants and handle connections
      this.listenToScreenShare(roomId);

      this.screenShareStateSubject.next({
        isScreenSharing: true,
        sharerId: currentUserId,
        canShare: false,
        isLocal: true
      });

      // Handle stream ending
      this._localStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare(roomId).catch(console.error);
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  private async initiatePeerConnection(remoteUserId: string, roomId: string, localUserId: string): Promise<RTCPeerConnection> {
    console.log('Initiating screen share connection with:', remoteUserId, 'Local user:', localUserId);

    // Clean up existing connection
    if (this.peerConnections.has(remoteUserId)) {
      console.log('Cleaning up existing connection for:', remoteUserId);
      this.peerConnections.get(remoteUserId)?.close();
      this.peerConnections.delete(remoteUserId);
    }

    const pc = new RTCPeerConnection({
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

    this.peerConnections.set(remoteUserId, pc);

    // Log connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state changed for ${remoteUserId}:`, pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state changed for ${remoteUserId}:`, pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log(`Signaling state changed for ${remoteUserId}:`, pc.signalingState);
    };

    // Add local stream if we're the sharer
    if (this._localStream && this.screenShareState.isLocal) {
      console.log('Adding local stream tracks to peer connection');
      this._localStream.getTracks().forEach(track => {
        console.log('Adding track:', track.kind);
        pc.addTrack(track, this._localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = async ({ candidate }) => {
      if (candidate && pc.connectionState !== 'closed') {
        try {
          const candidateData = {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment
          };
          
          await set(
            ref(this.db, `roomScreenCalls/${roomId}/candidates/${localUserId}_${remoteUserId}_${Date.now()}`),
            candidateData
          );
        } catch (error) {
          console.error('Error sending ICE candidate:', error);
        }
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        console.log('Processing remote stream:', {
          streamId: stream.id,
          tracks: stream.getTracks().map(t => ({
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted
          }))
        });

        this._remoteStreams.set(remoteUserId, stream);
        
        this.screenShareStateSubject.next({
          ...this.screenShareState,
          isScreenSharing: true,
          isLocal: false
        });
      }
    };

    // Create and send offer if we're the sharer
    if (this.screenShareState.isLocal && this._localStream) {
      try {
        console.log('Creating offer as local sharer');
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false
        });
        
        console.log('Setting local description');
        await pc.setLocalDescription(offer);
        
        // Save offer in Firebase under signaling/{roomId}/offers
        const offerRef = ref(this.db, `roomScreenCalls/${roomId}/signaling/offers/${localUserId}_${remoteUserId}`);
        await set(offerRef, {
          type: offer.type,
          sdp: offer.sdp,
          timestamp: Date.now()
        });
        
        console.log('Offer saved in database');
      } catch (error) {
        console.error('Error creating and sending offer:', error);
      }
    }

    // Setup signaling and candidate listeners
    await this.setupSignalingListener(pc, remoteUserId, roomId, localUserId);
    await this.setupCandidateListener(pc, remoteUserId, roomId);

    return pc;
  }

  private async setupSignalingListener(pc: RTCPeerConnection, remoteUserId: string, roomId: string, localUserId: string) {
    if (this.signallingListeners[remoteUserId]) {
      off(ref(this.db, `roomScreenCalls/${roomId}/signaling`), this.signallingListeners[remoteUserId]);
    }

    // Listen for offers
    const offersRef = ref(this.db, `roomScreenCalls/${roomId}/signaling/offers`);
    const answersRef = ref(this.db, `roomScreenCalls/${roomId}/signaling/answers`);

    const listener = onValue(offersRef, async (snapshot) => {
      const offers = snapshot.val();
      if (!offers) return;

      const offerKey = `${remoteUserId}_${localUserId}`;
      const offer = offers[offerKey];

      if (offer && pc.signalingState === 'stable') {
        try {
          console.log('Processing offer:', offer);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // Save answer in Firebase under signaling/{roomId}/answers
          const answerRef = ref(this.db, `roomScreenCalls/${roomId}/signaling/answers/${localUserId}_${remoteUserId}`);
          await set(answerRef, {
            type: answer.type,
            sdp: answer.sdp,
            timestamp: Date.now()
          });
          
          console.log('Answer saved in database');
          
          // Clean up the processed offer
          await remove(ref(this.db, `roomScreenCalls/${roomId}/signaling/offers/${offerKey}`));
        } catch (error) {
          console.error('Error processing offer:', error);
        }
      }
    });

    // Listen for answers
    const answerListener = onValue(answersRef, async (snapshot) => {
      const answers = snapshot.val();
      if (!answers) return;

      const answerKey = `${remoteUserId}_${localUserId}`;
      const answer = answers[answerKey];

      if (answer && pc.signalingState === 'have-local-offer') {
        try {
          console.log('Processing answer:', answer);
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          
          // Clean up the processed answer
          await remove(ref(this.db, `roomScreenCalls/${roomId}/signaling/answers/${answerKey}`));
        } catch (error) {
          console.error('Error processing answer:', error);
        }
      }
    });

    this.signallingListeners[remoteUserId] = [listener, answerListener];
  }

  private setupCandidateListener(pc: RTCPeerConnection, remoteUserId: string, roomId: string) {
    if (this.candidateListeners[remoteUserId]) {
      off(ref(this.db, `roomScreenCalls/${roomId}/candidates`), this.candidateListeners[remoteUserId]);
    }

    const listener = onValue(ref(this.db, `roomScreenCalls/${roomId}/candidates`), async (snapshot) => {
      const candidates = snapshot.val();
      if (!candidates) return;

      for (const [key, candidateData] of Object.entries(candidates)) {
        if (key.startsWith(remoteUserId) && 
            pc.remoteDescription && 
            pc.connectionState !== 'disconnected' && 
            pc.signalingState !== 'closed') {
          try {
            const iceCandidate = candidateData as ICECandidateData;
            if (!iceCandidate.candidate) continue;

            const candidate = new RTCIceCandidate({
              candidate: iceCandidate.candidate,
              sdpMid: iceCandidate.sdpMid || '0',
              sdpMLineIndex: iceCandidate.sdpMLineIndex || 0,
              usernameFragment: iceCandidate.usernameFragment || undefined
            });

            await pc.addIceCandidate(candidate);
            console.log('Added ICE candidate:', candidate);
            
            // Clean up processed candidate
            await remove(ref(this.db, `roomScreenCalls/${roomId}/candidates/${key}`));
          } catch (error) {
            console.error('Error processing ICE candidate:', error);
            // Remove the candidate if it's invalid or the connection is disconnected
            if (error.name === 'InvalidStateError' || ['disconnected', 'failed'].includes(pc.connectionState)) {
              await remove(ref(this.db, `roomScreenCalls/${roomId}/candidates/${key}`));
            }
          }
        }
      }
    });

    this.candidateListeners[remoteUserId] = listener;
  }

  async listenToScreenShare(roomId: string): Promise<void> {
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    console.log('Current user ID:', currentUserId);

    const roomRef = ref(this.db, `roomScreenCalls/${roomId}`);
    onValue(roomRef, async (snapshot) => {
      const screenShareData = snapshot.val();
      console.log('Received screen share data:', screenShareData);
      
      if (!screenShareData) {
        this.cleanup();
        return;
      }

      const isLocal = screenShareData.sharerId === currentUserId;
      
      // Update screen share state directly through the subject
      this.screenShareStateSubject.next({
        isScreenSharing: true,
        sharerId: screenShareData.sharerId,
        canShare: !screenShareData.active,
        isLocal: isLocal
      });

      // If we're not the sharer, add ourselves as a participant
      if (!isLocal && screenShareData.active) {
        console.log('Adding self as participant:', currentUserId);
        await set(ref(this.db, `roomScreenCalls/${roomId}/participants/${currentUserId}`), true);
      }

      // Handle participants
      if (screenShareData.participants) {
        const participants = Object.keys(screenShareData.participants);
        console.log('Current participants:', participants);
        
        for (const participantId of participants) {
          if (participantId !== currentUserId && !this.peerConnections.has(participantId)) {
            console.log('Initiating connection with participant:', participantId);
            await this.initiatePeerConnection(participantId, roomId, currentUserId);
          }
        }
      }
    });
  }

  async stopScreenShare(roomId: string): Promise<void> {
    try {
      const currentUserId = String(this.authService.getCurrentUser()?.id);
      
      // If we're the sharer, remove the entire room
      if (this.screenShareState.isLocal) {
        await remove(ref(this.db, `roomScreenCalls/${roomId}`));
      } else {
        // If we're just a participant, remove ourselves
        await remove(ref(this.db, `roomScreenCalls/${roomId}/participants/${currentUserId}`));
      }

      this.cleanup();
    } catch (error) {
      console.error('Error stopping screen share:', error);
      throw error;
    }
  }

  private cleanup(): void {
    // Stop local stream if it exists
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => track.stop());
      this._localStream = null;
    }

    // Close all peer connections
    for (const [peerId, pc] of this.peerConnections.entries()) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    // Clear remote streams
    this._remoteStreams.clear();

    // Reset screen share state using the subject
    this.screenShareStateSubject.next({
      isScreenSharing: false,
      sharerId: null,
      canShare: true,
      isLocal: false
    });
  }
}
