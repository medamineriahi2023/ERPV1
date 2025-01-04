import { Injectable, inject } from '@angular/core';
import { Database, ref, set, onValue, remove, get } from '@angular/fire/database';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

interface RoomCallState {
  active: boolean;
  participants: { [userId: string]: boolean };
  initiator: string;
}

@Injectable({
  providedIn: 'root'
})
export class RoomCallService {
  private peerConnections: { [userId: string]: RTCPeerConnection } = {};
  private localStream: MediaStream | null = null;
  private remoteStreams: { [userId: string]: MediaStream } = {};
  private audioElements: { [userId: string]: HTMLAudioElement } = {};
  private currentRoomId: string | null = null;
  private db: Database = inject(Database);

  private callStateSubject = new BehaviorSubject<{
    isInCall: boolean;
    participants: string[];
  }>({
    isInCall: false,
    participants: []
  });

  callState$ = this.callStateSubject.asObservable();

  constructor(private authService: AuthService) {}

  private createAudioElement(userId: string): HTMLAudioElement {
    const audio = new Audio();
    audio.autoplay = true;
    audio.id = `remote-audio-${userId}`;
    document.body.appendChild(audio);
    return audio;
  }

  async startCall(roomId: string, userId: string): Promise<void> {
    try {
      this.currentRoomId = roomId;
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Get current room call state
      const snapshot = await get(ref(this.db, `roomCalls/${roomId}`));
      const currentCall = snapshot.val();

      // Initialize or update room call state in Firebase
      if (!currentCall || !currentCall.active) {
        await set(ref(this.db, `roomCalls/${roomId}`), {
          active: true,
          initiator: userId,
          participants: {
            [userId]: true
          }
        });
      } else {
        // Add participant to existing call
        await set(ref(this.db, `roomCalls/${roomId}/participants/${userId}`), true);
      }

      // Listen for participants changes
      onValue(ref(this.db, `roomCalls/${roomId}/participants`), (snapshot) => {
        const participants = snapshot.val() || {};
        const participantIds = Object.keys(participants);
        
        // Update state
        this.callStateSubject.next({
          isInCall: true,
          participants: participantIds
        });

        // Connect with new participants
        participantIds.forEach(participantId => {
          if (participantId !== userId && !this.peerConnections[participantId]) {
            this.connectWithUser(participantId, roomId, userId);
          }
        });
      });

      // Listen for ICE candidates from other participants
      onValue(ref(this.db, `roomCalls/${roomId}/candidates`), (snapshot) => {
        const candidates = snapshot.val() || {};
        Object.entries(candidates).forEach(([senderId, senderCandidates]: [string, any]) => {
          if (senderId !== userId) {
            Object.values(senderCandidates).forEach((candidate: any) => {
              const pc = this.peerConnections[senderId];
              if (pc && candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            });
          }
        });
      });

    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async joinCall(roomId: string, userId: string): Promise<void> {
    try {
      this.currentRoomId = roomId;
      
      // Get user media
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

      // Add participant to room
      await set(ref(this.db, `roomCalls/${roomId}/participants/${userId}`), true);

      // Get current participants and establish connections
      const snapshot = await get(ref(this.db, `roomCalls/${roomId}/participants`));
      const participants = snapshot.val() || {};

      // Connect with existing participants
      Object.keys(participants).forEach(participantId => {
        if (participantId !== userId && !this.peerConnections[participantId]) {
          this.connectWithUser(participantId, roomId, userId);
        }
      });

      // Listen for new participants
      onValue(ref(this.db, `roomCalls/${roomId}/participants`), (snapshot) => {
        const participants = snapshot.val() || {};
        const participantIds = Object.keys(participants);
        
        // Update state
        this.callStateSubject.next({
          isInCall: true,
          participants: participantIds
        });

        // Connect with new participants
        participantIds.forEach(participantId => {
          if (participantId !== userId && !this.peerConnections[participantId]) {
            this.connectWithUser(participantId, roomId, userId);
          }
        });
      });

      // Listen for ICE candidates
      onValue(ref(this.db, `roomCalls/${roomId}/candidates`), (snapshot) => {
        const candidates = snapshot.val() || {};
        Object.entries(candidates).forEach(([senderId, senderCandidates]: [string, any]) => {
          if (senderId !== userId) {
            Object.values(senderCandidates).forEach((candidate: any) => {
              const pc = this.peerConnections[senderId];
              if (pc && candidate) {
                pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            });
          }
        });
      });

    } catch (error) {
      console.error('Error joining call:', error);
      throw error;
    }
  }

  private async connectWithUser(remoteUserId: string, roomId: string, localUserId: string) {
    console.log(`Connecting with user ${remoteUserId}`);

    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.relay.metered.ca:80",
        },
        {
          urls: "turn:eu-west.relay.metered.ca:80",
          username: "f62b917dabb7524388421224",
          credential: "ut/b3FhDJE9dFzX8",
        },
        {
          urls: "turn:eu-west.relay.metered.ca:80?transport=tcp",
          username: "f62b917dabb7524388421224",
          credential: "ut/b3FhDJE9dFzX8",
        },
        {
          urls: "turn:eu-west.relay.metered.ca:443",
          username: "f62b917dabb7524388421224",
          credential: "ut/b3FhDJE9dFzX8",
        },
        {
          urls: "turns:eu-west.relay.metered.ca:443?transport=tcp",
          username: "f62b917dabb7524388421224",
          credential: "ut/b3FhDJE9dFzX8",
        },
      ],
    });

    // Add local stream
    this.localStream?.getTracks().forEach(track => {
      if (this.localStream) {
        pc.addTrack(track, this.localStream);
      }
    });

    // Handle ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        set(ref(this.db, `roomCalls/${roomId}/candidates/${localUserId}/${Date.now()}`), 
            candidate.toJSON());
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track');
      if (!this.remoteStreams[remoteUserId]) {
        this.remoteStreams[remoteUserId] = new MediaStream();
        
        const audio = this.createAudioElement(remoteUserId);
        this.audioElements[remoteUserId] = audio;
        audio.srcObject = this.remoteStreams[remoteUserId];
      }
      
      event.streams[0].getTracks().forEach(track => {
        this.remoteStreams[remoteUserId].addTrack(track);
      });
    };

    // Store connection
    this.peerConnections[remoteUserId] = pc;

    // Handle signaling
    const signaling = ref(this.db, `roomCalls/${roomId}/signaling/${localUserId}_${remoteUserId}`);
    const remoteSignaling = ref(this.db, `roomCalls/${roomId}/signaling/${remoteUserId}_${localUserId}`);

    // Listen for remote signaling
    onValue(remoteSignaling, async (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      try {
        if (data.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await set(signaling, { type: 'answer', sdp: answer.sdp });
        }
        else if (data.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
        }
      } catch (error) {
        console.error('Error handling signaling:', error);
      }
    });

    // Handle ICE candidates
    onValue(ref(this.db, `roomCalls/${roomId}/candidates/${remoteUserId}`), (snapshot) => {
      const candidates = snapshot.val();
      if (candidates) {
        Object.values(candidates).forEach((candidate: any) => {
          pc.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error('Error adding ICE candidate:', error));
        });
      }
    });

    // Create offer if we're the initiator
    if (localUserId < remoteUserId) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await set(signaling, { type: 'offer', sdp: offer.sdp });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return pc;
  }

  async leaveCall(roomId: string, userId: string): Promise<void> {
    try {
      // Remove participant from room call
      await remove(ref(this.db, `roomCalls/${roomId}/participants/${userId}`));

      // Clean up peer connections
      Object.keys(this.peerConnections).forEach(peerId => {
        this.peerConnections[peerId].close();
        delete this.peerConnections[peerId];
      });

      // Clean up audio elements
      Object.keys(this.audioElements).forEach(peerId => {
        this.audioElements[peerId].remove();
        delete this.audioElements[peerId];
      });

      // Stop local stream
      this.localStream?.getTracks().forEach(track => track.stop());
      this.localStream = null;

      // Update state
      this.callStateSubject.next({
        isInCall: false,
        participants: []
      });

      // Check if room call is empty
      const snapshot = await get(ref(this.db, `roomCalls/${roomId}/participants`));
      const participants = snapshot.val();
      if (!participants || Object.keys(participants).length === 0) {
        // If no participants left, remove the room call
        await remove(ref(this.db, `roomCalls/${roomId}`));
      }

    } catch (error) {
      console.error('Error leaving call:', error);
      throw error;
    }
  }

  async endCall() {
    if (this.currentRoomId) {
      const userId = this.authService.getCurrentUser()?.id;
      if (userId) {
        try {
          // Remove from room
          await remove(ref(this.db, `roomCalls/${this.currentRoomId}/participants/${userId}`));

          // Check if there are any participants left
          const participantsSnapshot = await get(ref(this.db, `roomCalls/${this.currentRoomId}/participants`));
          const remainingParticipants = participantsSnapshot.val();

          // If no participants left, clean up the entire room call data
          if (!remainingParticipants || Object.keys(remainingParticipants).length === 0) {
            await remove(ref(this.db, `roomCalls/${this.currentRoomId}`));
          }

          // Cleanup connections
          Object.values(this.peerConnections).forEach(pc => pc.close());
          this.peerConnections = {};

          // Stop local stream
          this.localStream?.getTracks().forEach(track => track.stop());
          this.localStream = null;

          // Cleanup remote streams
          Object.values(this.audioElements).forEach(audio => {
            audio.srcObject = null;
            audio.remove();
          });
          this.audioElements = {};
          this.remoteStreams = {};

          // Update state
          this.callStateSubject.next({
            isInCall: false,
            participants: []
          });

          this.currentRoomId = null;
        } catch (error) {
          console.error('Error ending call:', error);
        }
      }
    }
  }

  isCallActive(roomId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      const unsubscribe = onValue(ref(this.db, `roomCalls/${roomId}/active`), (snapshot) => {
        observer.next(!!snapshot.val());
      });
      return () => unsubscribe();
    });
  }
}
