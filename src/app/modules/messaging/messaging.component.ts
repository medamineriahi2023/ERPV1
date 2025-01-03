import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { MessagingService, UserStatus, UserStatusInfo } from '../../core/services/messaging.service';
import { Message } from '../../core/interfaces/message.interface';
import { AuthService } from '../../core/services/auth.service';
import { BehaviorSubject, Subscription } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from "@angular/forms";
import { ScrollPanel } from "primeng/scrollpanel";
import { Avatar } from "primeng/avatar";
import { Badge } from "primeng/badge";
import { DatePipe, SlicePipe, CommonModule } from "@angular/common";
import { InputText } from "primeng/inputtext";
import { ButtonModule } from 'primeng/button';
import { ChangeDetectorRef } from '@angular/core';
import { VoiceCallService, CallStatus } from './services/voice-call.service';
import { VideoCallService, VideoCallStatus } from './services/video-call.service';
import { Dialog } from 'primeng/dialog';
import {
  VideoCallDialogComponent
} from "@app/modules/messaging/components/video-call-dialog/video-call-dialog.component";
import {User} from "@core/interfaces/user.interface";

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ScrollPanel,
    Avatar,
    Badge,
    DatePipe,
    InputText,
    ButtonModule,
  ],
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss']
})
export class MessagingComponent implements OnInit, OnDestroy {
  userStatuses: UserStatusInfo[] = [];
  filteredUsers: UserStatusInfo[] = [];
  messages: Message[] = [];
  selectedUser: UserStatusInfo | null = null;
  currentMessage: string = '';
  searchTerm: string = '';
  unreadCounts: { [key: string]: number } = {};
  currentUserId: string;
  isMobileView: boolean = false;
  private searchTermSubject = new BehaviorSubject<string>('');
  private subscriptions: Subscription[] = [];
  callStatus: CallStatus = { status: 'idle' };
  videoCallStatus: VideoCallStatus = { status: 'idle' };
  showCallDialog: boolean = false;
  private callStatusSubscription: Subscription | undefined;
  private videoCallStatusSubscription: Subscription | undefined;
  callDuration: string = '00:00';
  private callTimer: any;
  currentUser : User;

  get searchTermValue(): string {
    return this.searchTermSubject.value;
  }
  
  set searchTermValue(value: string) {
    this.searchTermSubject.next(value);
  }

  constructor(
    private messagingService: MessagingService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private voiceCallService: VoiceCallService,
    private videoCallService: VideoCallService
  ) {
    this.currentUserId = String(this.authService.getCurrentUser()?.id);
    this.currentUser = this.authService.getCurrentUser();
    this.checkScreenSize();
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobileView = window.innerWidth <= 450;
  }

  ngOnInit() {
    // Subscribe to user statuses
    this.subscriptions.push(
      this.messagingService.getUserStatuses().subscribe(statuses => {
        this.userStatuses = this.sortUsersByStatus(statuses);
        this.filteredUsers = this.userStatuses.filter(user => 
          user.userId !== String(this.authService.getCurrentUser()?.id)
        );
      })
    );

    // Subscribe to messages
    this.subscriptions.push(
      this.messagingService.getMessages().subscribe(messages => {
        this.messages = messages;
        this.updateUnreadCounts();
      })
    );

    // Subscribe to search term changes
    this.subscriptions.push(
      this.searchTermSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(() => {
        this.filterUsers();
      })
    );
  }

  private sortUsersByStatus(users: UserStatusInfo[]): UserStatusInfo[] {
    return users.sort((a, b) => {
      const statusOrder = {
        [UserStatus.ACTIVE]: 0,
        [UserStatus.INACTIVE]: 1,
        [UserStatus.OFFLINE]: 2
      };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  filterUsers() {
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    this.filteredUsers = this.userStatuses.filter(user => {
      const searchMatch = !this.searchTermValue || 
        user.username.toLowerCase().includes(this.searchTermValue.toLowerCase());
      const notCurrentUser = user.userId !== currentUserId;
      return searchMatch && notCurrentUser;
    });
  }

  selectUser(user: UserStatusInfo) {
    this.selectedUser = user;
    const messages = this.getMessagesWithUser(user.userId);
    messages.forEach(message => {
      if (message.receiverId === String(this.authService.getCurrentUser()?.id) && !message.read) {
        this.messagingService.markMessageAsRead(message.id);
      }
    });
  }

  sendMessage() {
    if (this.selectedUser && this.currentMessage.trim()) {
      this.messagingService.sendMessage(this.selectedUser.userId, this.currentMessage.trim());
      this.currentMessage = '';
    }
  }

  getStatusColor(status: UserStatus): string {
    switch (status) {
      case UserStatus.ACTIVE:
        return '#22C55E';
      case UserStatus.INACTIVE:
        return '#F97316';
      case UserStatus.OFFLINE:
        return '#94A3B8';
      default:
        return '#94A3B8';
    }
  }

  getStatusClass(status: UserStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  getMessageDate(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getLastMessage(user: UserStatusInfo): string {
    if (!this.messages || !user) return '';
    
    const messagesWithUser = this.messages.filter(m => 
      (m.senderId === this.currentUserId && m.receiverId === user.userId) ||
      (m.receiverId === this.currentUserId && m.senderId === user.userId)
    );
    
    if (messagesWithUser.length === 0) return '';
    
    const lastMessage = messagesWithUser[messagesWithUser.length - 1];
    return lastMessage.content;
  }

  getLastMessageTime(user: UserStatusInfo): Date | null {
    if (!this.messages || !user) return null;
    
    const messagesWithUser = this.messages.filter(m => 
      (m.senderId === this.currentUserId && m.receiverId === user.userId) ||
      (m.receiverId === this.currentUserId && m.senderId === user.userId)
    );
    
    if (messagesWithUser.length === 0) return null;
    
    const lastMessage = messagesWithUser[messagesWithUser.length - 1];
    return new Date(lastMessage.timestamp);
  }

  getUnreadCount(user: UserStatusInfo): number {
    if (!this.messages || !user) return 0;
    
    return this.messages.filter(m => 
      m.senderId === user.userId && 
      m.receiverId === this.currentUserId && 
      !m.read
    ).length;
  }

  getMessagesWithUser(userId: string): Message[] {
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    return this.messages.filter(m => 
      (m.senderId === userId && m.receiverId === currentUserId) ||
      (m.senderId === currentUserId && m.receiverId === userId)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  getMessageDates(): string[] {
    if (!this.messages) return [];
    
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    const dates = this.messages
      .filter(m => 
        m.senderId === currentUserId && m.receiverId === this.selectedUser?.userId ||
        m.receiverId === currentUserId && m.senderId === this.selectedUser?.userId
      )
      .map(m => new Date(m.timestamp).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index);
    
    return dates;
  }

  getMessagesByDate(date: string): Message[] {
    if (!this.messages) return [];
    
    const currentUserId = String(this.authService.getCurrentUser()?.id);
    return this.messages.filter(m => {
      const messageDate = new Date(m.timestamp).toDateString();
      const isRelevantMessage = 
        (m.senderId === currentUserId && m.receiverId === this.selectedUser?.userId) ||
        (m.receiverId === currentUserId && m.senderId === this.selectedUser?.userId);
      
      return messageDate === date && isRelevantMessage;
    });
  }

  private updateUnreadCounts() {
    const counts: { [key: string]: number } = {};
    if (this.messages) {
      this.messages.forEach(message => {
        if (message.receiverId === this.currentUserId && !message.read) {
          counts[message.senderId] = (counts[message.senderId] || 0) + 1;
        }
      });
    }
    this.unreadCounts = counts;
  }

  trackMessageById(index: number, message: Message): string {
    return message.id;
  }

  initiateCall() {
    if (this.selectedUser) {
      this.voiceCallService.startCall(this.selectedUser.userId, this.currentUserId, this.currentUser.firstName +" "+ this.currentUser.lastName
          , this.currentUser.photoUrl, this.selectedUser.username, this.selectedUser.photoUrl);
      this.voiceCallService.setShowVoiceCallDialog(true);
    }
  }

  startVideoCall() {
    if (this.selectedUser) {
      this.videoCallService.setShowVideoCallDialog(true)
      this.videoCallService.startCall(this.selectedUser.userId);
    }
  }

  async acceptCall() {
    if (this.callStatus.remoteUserId && this.selectedUser) {
      await this.voiceCallService.acceptCall(this.callStatus.remoteUserId);
    }
  }

  acceptVideoCall() {
    if (this.videoCallStatus.remoteUserId) {
      this.videoCallService.acceptCall(this.videoCallStatus.remoteUserId);
      this.videoCallService.setShowVideoCallDialog(true);
    }
  }

  rejectCall() {
    if (this.callStatus.remoteUserId) {
      this.voiceCallService.rejectCall(this.callStatus.remoteUserId);
      this.voiceCallService.setShowVoiceCallDialog(false);
    }
  }

  rejectVideoCall() {
    if (this.videoCallStatus.remoteUserId) {
      this.videoCallService.rejectCall(this.videoCallStatus.remoteUserId);
      this.videoCallService.setShowVideoCallDialog(false);
    }
  }

  endCall() {
    this.voiceCallService.endCall();
    this.voiceCallService.setShowVoiceCallDialog(false);
  }

  endVideoCall() {
    this.videoCallService.endCall();
    this.videoCallService.setShowVideoCallDialog(false);
  }

  private startCallTimer() {
    let seconds = 0;
    this.stopCallTimer(); // Clear any existing timer
    this.callTimer = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      this.callDuration = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
      this.callDuration = '00:00';
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.callStatusSubscription?.unsubscribe();
    this.videoCallStatusSubscription?.unsubscribe();
    this.stopCallTimer();
    this.voiceCallService.endCall();
    this.videoCallService.endCall();
  }

  backToUserList() {
    this.selectedUser = null;
  }
}
