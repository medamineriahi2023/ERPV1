import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, get, off } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import {RoomScreenShareService} from "@app/modules/messaging/services/room-screen-share.service";

interface RoomCallState {
  active: boolean;
  participants: { [userId: string]: boolean };
  initiator: string;
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
export class RoomCallService {
  private peerConnections: { [userId: string]: RTCPeerConnection } = {};
  private _localStream: MediaStream | null = null;
  private remoteStreams: { [userId: string]: MediaStream } = {};
  private audioElements: { [userId: string]: HTMLAudioElement } = {};
  private currentRoomId: string | null = null;
  private db: Database = inject(Database);
  private signallingListeners: { [key: string]: any } = {};
  private candidateListeners: { [key: string]: any } = {};

  private callStateSubject = new BehaviorSubject<{
    isInCall: boolean;
    participants: string[];
  }>({
    isInCall: false,
    participants: []
  });

  callState$ = this.callStateSubject.asObservable();

  private _isMuted = false;

  get isMuted(): boolean {
    return this._isMuted;
  }

  toggleMute(): void {
    if (this._localStream) {
      const audioTracks = this._localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        this._isMuted = !track.enabled;
      });
    }
  }

  constructor(private authService: AuthService,
              private roomScreenShareService: RoomScreenShareService) {}

  get localStream(): MediaStream | null {
    return this._localStream;
  }

  private createAudioElement(userId: string): HTMLAudioElement {
    const audio = new Audio();
    audio.id = `audio-${userId}`;
    audio.autoplay = true;
    return audio;
  }

  async startCall(roomId: string, userId: string): Promise<void> {
    try {
      this.currentRoomId = roomId;
      
      // Get user media with specific audio constraints
      this._localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Set up room call data
      const roomCallRef = ref(this.db, `roomCalls/${roomId}`);
      const snapshot = await get(roomCallRef);
      
      if (!snapshot.exists()) {
        await set(roomCallRef, {
          active: true,
          participants: {
            [userId]: true
          }
        });
      } else {
        await set(ref(this.db, `roomCalls/${roomId}/participants/${userId}`), true);
      }

      // Listen for participants changes
      this.setupParticipantListener(roomId, userId);
      this.roomScreenShareService.listenToScreenShare(roomId);
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  private async initiatePeerConnection(remoteUserId: string, roomId: string, localUserId: string) {
    console.log(`Initiating connection with ${remoteUserId}`);

    // Clean up any existing connection
    if (this.peerConnections[remoteUserId]) {
      this.peerConnections[remoteUserId].close();
      delete this.peerConnections[remoteUserId];
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

    // Store connection
    this.peerConnections[remoteUserId] = pc;

    // Add local stream
    if (this._localStream) {
      this._localStream.getTracks().forEach(track => {
        console.log('Adding track to peer connection:', track.kind);
        pc.addTrack(track, this._localStream!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = async ({ candidate }) => {
      if (candidate && this.currentRoomId && pc.connectionState !== 'closed') {
        try {
          const candidateData: ICECandidateData = {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            usernameFragment: candidate.usernameFragment
          };
          
          await set(
            ref(this.db, `roomCalls/${this.currentRoomId}/candidates/${localUserId}_${remoteUserId}_${Date.now()}`),
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
      
      if (!this.remoteStreams[remoteUserId]) {
        this.remoteStreams[remoteUserId] = new MediaStream();
        const audio = this.createAudioElement(remoteUserId);
        this.audioElements[remoteUserId] = audio;
        audio.srcObject = this.remoteStreams[remoteUserId];
        audio.volume = 1.0;
        document.body.appendChild(audio);
        
        const playAudio = async () => {
          try {
            await audio.play();
            console.log('Successfully playing audio for:', remoteUserId);
          } catch (error) {
            console.error('Error playing audio:', error);
            document.addEventListener('click', () => {
              audio.play().catch(console.error);
            }, { once: true });
          }
        };
        playAudio();
      }
      
      this.remoteStreams[remoteUserId].addTrack(event.track);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUserId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handleConnectionFailure(remoteUserId, roomId, localUserId);
      }
    };

    // Create and send offer immediately if we're the initiator
    if (localUserId < remoteUserId) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        
        await pc.setLocalDescription(offer);
        
        await set(
          ref(this.db, `roomCalls/${roomId}/signaling/${localUserId}_${remoteUserId}`),
          { type: offer.type, sdp: offer.sdp }
        );
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    // Setup signaling
    await this.setupSignalingListener(pc, remoteUserId, roomId, localUserId);
    await this.setupCandidateListener(pc, remoteUserId, roomId);

    return pc;
  }

  private async handleConnectionFailure(remoteUserId: string, roomId: string, localUserId: string) {
    console.log('Handling connection failure for:', remoteUserId);
    
    // Clean up old connection
    if (this.peerConnections[remoteUserId]) {
      this.peerConnections[remoteUserId].close();
      delete this.peerConnections[remoteUserId];
    }

    // Clean up audio elements
    if (this.audioElements[remoteUserId]) {
      this.audioElements[remoteUserId].remove();
      delete this.audioElements[remoteUserId];
    }

    // Clean up streams
    if (this.remoteStreams[remoteUserId]) {
      delete this.remoteStreams[remoteUserId];
    }

    // Attempt to establish a new connection
    await this.initiatePeerConnection(remoteUserId, roomId, localUserId);
  }

  private setupCandidateListener(pc: RTCPeerConnection, remoteUserId: string, roomId: string) {
    if (this.candidateListeners[remoteUserId]) {
      off(ref(this.db, `roomCalls/${roomId}/candidates`), this.candidateListeners[remoteUserId]);
    }

    const listener = onValue(ref(this.db, `roomCalls/${roomId}/candidates`), async (snapshot) => {
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
            
            // Clean up processed candidate
            await remove(ref(this.db, `roomCalls/${roomId}/candidates/${key}`));
          } catch (error) {
            console.error('Error processing ICE candidate:', error);
            // Remove the candidate if it's invalid or the connection is disconnected
            if (error.name === 'InvalidStateError' || ['disconnected', 'failed'].includes(pc.connectionState)) {
              await remove(ref(this.db, `roomCalls/${roomId}/candidates/${key}`));
            }
          }
        }
      }
    });

    this.candidateListeners[remoteUserId] = listener;
  }

  private async setupSignalingListener(pc: RTCPeerConnection, remoteUserId: string, roomId: string, localUserId: string) {
    if (this.signallingListeners[remoteUserId]) {
      off(ref(this.db, `roomCalls/${roomId}/signaling`), this.signallingListeners[remoteUserId]);
    }

    const listener = onValue(ref(this.db, `roomCalls/${roomId}/signaling`), async (snapshot) => {
      const signaling = snapshot.val();
      if (!signaling) return;

      const remoteKey = `${remoteUserId}_${localUserId}`;
      const localKey = `${localUserId}_${remoteUserId}`;

      if (signaling[remoteKey] && !['disconnected', 'failed'].includes(pc.connectionState)) {
        const data = signaling[remoteKey];
        try {
          if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            await set(ref(this.db, `roomCalls/${roomId}/signaling/${localKey}`), {
              type: answer.type,
              sdp: answer.sdp
            });

            // Clean up the offer after processing
            await remove(ref(this.db, `roomCalls/${roomId}/signaling/${remoteKey}`));
          } else if (data.type === 'answer' && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            
            // Clean up the answer after processing
            await remove(ref(this.db, `roomCalls/${roomId}/signaling/${remoteKey}`));
          }
        } catch (error) {
          console.error('Error handling signaling message:', error);
        }
      }
    });

    this.signallingListeners[remoteUserId] = listener;
  }

  private setupParticipantListener(roomId: string, userId: string) {
    const participantsRef = ref(this.db, `roomCalls/${roomId}/participants`);
    onValue(participantsRef, async (snapshot) => {
      const participants = snapshot.val();
      const participantIds = Object.keys(participants);
      console.log("participantIds");
      console.log(participantIds);
      // Update state
      this.callStateSubject.next({
        isInCall: true,
        participants: participantIds
      });

      // If there are no participants, remove the entire roomCall
      if (participantIds.length === 0) {
        await remove(ref(this.db, `roomCalls/${roomId}`));
        this.cleanup();
        return;
      }

      // Connect with all participants except self
      for (const participantId of participantIds) {
        if (participantId !== userId && !this.peerConnections[participantId]) {
          await this.initiatePeerConnection(participantId, roomId, userId);
        }
      }
    });
  }

  async leaveCall(roomId: string, userId: string): Promise<void> {
    try {
      // Remove participant from room call
      await remove(ref(this.db, `roomCalls/${roomId}/participants/${userId}`));

      // Check if room is empty and clean up if it is
      const snapshot = await get(ref(this.db, `roomCalls/${roomId}/participants`));
      if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
        // Remove all room call data
        await remove(ref(this.db, `roomCalls/${roomId}/signaling`));
        await remove(ref(this.db, `roomCalls/${roomId}/candidates`));
        await remove(ref(this.db, `roomCalls/${roomId}`));
      }

      // Cleanup local resources
      this.cleanup();
      
    } catch (error) {
      console.error('Error leaving call:', error);
      throw error;
    }
  }

  private cleanup() {
    // Stop local stream
    this._localStream?.getTracks().forEach(track => track.stop());
    this._localStream = null;

    // Close peer connections
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};

    // Remove audio elements
    Object.values(this.audioElements).forEach(audio => {
      if (audio.srcObject) {
        audio.srcObject = null;
      }
      audio.remove();
    });

    // Clear all streams and elements
    this.remoteStreams = {};
    this.audioElements = {};

    // Remove all listeners
    if (this.currentRoomId) {
      Object.values(this.signallingListeners).forEach(listener => {
        off(ref(this.db, `roomCalls/${this.currentRoomId}/signaling`), listener);
      });
      Object.values(this.candidateListeners).forEach(listener => {
        off(ref(this.db, `roomCalls/${this.currentRoomId}/candidates`), listener);
      });
    }
    this.signallingListeners = {};
    this.candidateListeners = {};

    // Reset room ID and state
    this.currentRoomId = null;
    this.callStateSubject.next({
      isInCall: false,
      participants: []
    });
  }

  async joinCall(roomId: string, userId: string): Promise<void> {
    await this.startCall(roomId, userId);
  }

  async endCall(roomId: string): Promise<void> {
    try {
      console.log('Ending call in room:', roomId);
      
      // End screen share if active
      const screenShareState = this.roomScreenShareService.screenShareState;
      if (screenShareState.isScreenSharing) {
        await this.roomScreenShareService.stopScreenShare(roomId);
      }

      // Remove call data from Firebase
      await set(ref(this.db, `roomCalls/${roomId}`), null);
      
      // Clean up local resources
      this.cleanup();
      
      // Update call state
      this.callStateSubject.next({
        isInCall: false,
        participants: []
      });
      
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  isCallActive(roomId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      const unsubscribe = onValue(ref(this.db, `roomCalls/${roomId}/participants`), (snapshot) => {
        const participants = snapshot.val();
        observer.next(!!participants && Object.keys(participants).length > 0);
      });
      return () => unsubscribe();
    });
  }
}
