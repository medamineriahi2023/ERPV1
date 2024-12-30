import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessagingService } from './messaging.service';
import { AuthService } from './auth.service';
import { map } from 'rxjs/operators';
import { Message } from '../interfaces/message.interface';

export interface CallRequest {
  type: 'video' | 'audio';
  caller: {
    id: string;
    name: string;
  };
}

export interface RTCMessage {
  type: 'call-request' | 'call-accepted' | 'call-rejected' | 'call-canceled' | 'offer' | 'answer' | 'ice-candidate' | 'call-ended';
  sender: string;
  receiver: string;
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream = new BehaviorSubject<MediaStream | null>(null);
  private remoteStream = new BehaviorSubject<MediaStream | null>(null);
  private currentCall: { userId: string; type: 'video' | 'audio'; status: 'initiating' | 'accepted' } | null = null;
  private incomingCall = new BehaviorSubject<CallRequest | null>(null);
  private iceCandidates: RTCIceCandidate[] = [];
  private currentCallTimeout: any;
  private readonly CALL_TIMEOUT = 120000; // 2 minutes in milliseconds

  constructor(
    private messagingService: MessagingService,
    private authService: AuthService
  ) {
    this.setupMessageListener();
  }

  get localVideoStream() {
    return this.localStream.asObservable();
  }

  get remoteVideoStream() {
    return this.remoteStream.asObservable();
  }

  get incomingCallRequest() {
    return this.incomingCall.asObservable();
  }

  private setupMessageListener() {
    this.messagingService.getMessages().subscribe(messages => {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      const rtcMessages = messages.filter(m => 
        m.content.startsWith('RTC:') && 
        m.receiverId === String(currentUser.id) &&
        !m.read
      );

      rtcMessages.forEach(message => {
        const rtcData: RTCMessage = JSON.parse(message.content.slice(4));
        this.handleRTCMessage(rtcData);
        this.messagingService.markMessageAsRead(message.id);
      });
    });
  }

  private async handleRTCMessage(message: RTCMessage) {
    switch (message.type) {
      case 'call-request':
        await this.handleCallRequest(message);
        break;
      case 'call-accepted':
        await this.handleCallAccepted(message);
        break;
      case 'call-rejected':
        this.handleCallRejected();
        break;
      case 'call-canceled':
        this.handleCallCanceled();
        break;
      case 'offer':
        await this.handleOffer(message);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;
      case 'call-ended':
        this.handleCallEnded();
        break;
    }
  }

  async initiateCall(userId: string, type: 'video' | 'audio' = 'video') {
    if (this.currentCall) {
      console.warn('Already in a call');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    try {
      await this.initializeMediaStream(type);
      
      this.currentCall = {
        userId,
        type,
        status: 'initiating'
      };

      // Send call request
      this.sendRTCMessage({
        type: 'call-request',
        sender: String(currentUser.id),
        receiver: userId,
        payload: {
          type
        }
      });

      // Set timeout for call request
      if (this.currentCallTimeout) {
        clearTimeout(this.currentCallTimeout);
      }
      this.currentCallTimeout = setTimeout(() => {
        if (this.currentCall?.status === 'initiating') {
          this.endCall();
        }
      }, this.CALL_TIMEOUT);

    } catch (error) {
      console.error('Error initiating call:', error);
      this.cleanupCall();
    }
  }

  private async handleCallRequest(message: RTCMessage) {
    if (this.currentCall) {
      // If already in a call, reject the new call request
      this.sendRTCMessage({
        type: 'call-rejected',
        sender: String(this.authService.getCurrentUser().id),
        receiver: message.sender,
        payload: null
      });
      return;
    }

    const caller = await this.authService.getUserById(Number(message.sender));
    if (!caller) return;

    // Clear any existing timeout
    if (this.currentCallTimeout) {
      clearTimeout(this.currentCallTimeout);
    }

    // Set the current call
    this.currentCall = {
      userId: message.sender,
      type: message.payload.type,
      status: 'initiating'
    };

    this.incomingCall.next({
      type: message.payload.type,
      caller: {
        id: message.sender,
        name: caller.username || `${caller.firstName} ${caller.lastName}`
      }
    });

    // Set timeout for incoming call
    this.currentCallTimeout = setTimeout(() => {
      this.rejectCall();
    }, this.CALL_TIMEOUT);
  }

  public acceptCall() {
    if (!this.currentCall) return;

    // Clear timeout since call was answered
    if (this.currentCallTimeout) {
      clearTimeout(this.currentCallTimeout);
      this.currentCallTimeout = null;
    }

    this.currentCall.status = 'accepted';
    
    // Send single accept message
    this.sendRTCMessage({
      type: 'call-accepted',
      sender: String(this.authService.getCurrentUser().id),
      receiver: this.currentCall.userId,
      payload: null
    });

    // Initialize media stream with the correct call type
    this.initializeMediaStream(this.currentCall.type);
  }

  public rejectCall() {
    // Clear timeout
    if (this.currentCallTimeout) {
      clearTimeout(this.currentCallTimeout);
      this.currentCallTimeout = null;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    if (this.currentCall || this.incomingCall.value) {
      const targetUserId = this.currentCall?.userId || this.incomingCall.value?.caller.id;
      
      if (targetUserId) {
        // Send single reject message
        this.sendRTCMessage({
          type: 'call-rejected',
          sender: String(currentUser.id),
          receiver: targetUserId,
          payload: null
        });
      }

      this.cleanupCall();
    }
  }

  public endCall() {
    // Clear timeout if exists
    if (this.currentCallTimeout) {
      clearTimeout(this.currentCallTimeout);
      this.currentCallTimeout = null;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    if (this.currentCall) {
      // Send single end call message
      this.sendRTCMessage({
        type: 'call-ended',
        sender: String(currentUser.id),
        receiver: this.currentCall.userId,
        payload: null
      });
    }

    this.cleanupCall();
  }

  private cleanupCall() {
    // Stop and cleanup peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }

    // Stop and cleanup local stream
    if (this.localStream.value) {
      try {
        this.localStream.value.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        console.error('Error stopping local tracks:', err);
      }
      this.localStream.next(null);
    }

    // Clear remote stream
    this.remoteStream.next(null);
    
    // Reset call state
    this.currentCall = null;
    this.incomingCall.next(null);
    this.iceCandidates = [];
  }

  private async handleCallAccepted(message: RTCMessage) {
    if (this.currentCall && this.currentCall.userId === message.sender) {
      await this.initializeCall();
    }
  }

  private handleCallRejected() {
    this.endCall();
  }

  private handleCallCanceled() {
    this.incomingCall.next(null);
    this.endCall();
  }

  private async handleOffer(message: RTCMessage) {
    if (!this.peerConnection) {
      await this.createPeerConnection();
    }

    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(message.payload));
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;

    await this.sendRTCMessage({
      type: 'answer',
      sender: String(currentUser.id),
      receiver: message.sender,
      payload: answer
    });
  }

  private async handleAnswer(message: RTCMessage) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
    }
  }

  private async handleIceCandidate(message: RTCMessage) {
    const candidate = new RTCIceCandidate(message.payload);
    if (this.peerConnection?.remoteDescription) {
      await this.peerConnection.addIceCandidate(candidate);
    } else {
      this.iceCandidates.push(candidate);
    }
  }

  private async sendRTCMessage(message: RTCMessage) {
    this.messagingService.sendMessage(
      message.receiver,
      `RTC:${JSON.stringify(message)}`
    );
  }

  private async initializeCall() {
    if (!this.currentCall) return;

    try {
      await this.initializeMediaStream(this.currentCall.type);
      
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) return;

      await this.sendRTCMessage({
        type: 'offer',
        sender: String(currentUser.id),
        receiver: this.currentCall.userId,
        payload: offer
      });

    } catch (error) {
      console.error('Error initializing call:', error);
      this.endCall();
    }
  }

  private async initializeMediaStream(type: 'video' | 'audio' = 'video') {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream.next(stream);

      await this.createPeerConnection();

    } catch (error) {
      console.error('Error initializing media stream:', error);
      this.endCall();
    }
  }

  private async createPeerConnection() {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.currentCall) {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) return;

        await this.sendRTCMessage({
          type: 'ice-candidate',
          sender: String(currentUser.id),
          receiver: this.currentCall.userId,
          payload: event.candidate
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream.next(event.streams[0]);
    };

    const stream = this.localStream.value;
    if (stream) {
      stream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, stream);
      });
    }

    // Add any queued ice candidates
    if (this.peerConnection.remoteDescription) {
      while (this.iceCandidates.length) {
        const candidate = this.iceCandidates.shift();
        if (candidate) {
          await this.peerConnection.addIceCandidate(candidate);
        }
      }
    }
  }

  private handleCallEnded() {
    this.endCall();
  }

  async toggleVideo() {
    const stream = this.localStream.value;
    if (stream && this.currentCall?.type === 'video') {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
      }
    }
  }

  async toggleAudio() {
    const stream = this.localStream.value;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
      }
    }
  }
}
