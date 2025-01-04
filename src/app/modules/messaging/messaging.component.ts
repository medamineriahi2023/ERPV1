import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { MessagingService, UserStatus, UserStatusInfo } from '../../core/services/messaging.service';
import { Message } from '../../core/interfaces/message.interface';
import { AuthService } from '../../core/services/auth.service';
import { BehaviorSubject, Subscription, take } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { ScrollPanel } from "primeng/scrollpanel";
import { Tooltip } from "primeng/tooltip";
import { RoomService } from './services/room.service';
import { RoomMessagingService } from './services/room-messaging.service';
import { Room } from './interfaces/room.interface';
import { RoomMessage } from './interfaces/room-message.interface';
import { interval } from 'rxjs';
import { RoomCallService } from './services/room-call.service';
import {VideoCallService, VideoCallStatus} from "@app/modules/messaging/services/video-call.service";
import {CallStatus, VoiceCallService} from "@app/modules/messaging/services/voice-call.service";
import {User} from "@core/interfaces/user.interface";
import {MultiSelect} from "primeng/multiselect";
import {Dialog} from "primeng/dialog";
import {Avatar} from "primeng/avatar";
import {AsyncPipe, DatePipe, NgClass, NgForOf, NgIf, NgSwitch, NgSwitchCase} from "@angular/common";
import {Chip} from "primeng/chip";
import {ButtonDirective} from "primeng/button";

@Component({
  selector: 'app-messaging',
  templateUrl: './messaging.component.html',
  styleUrls: ['./messaging.component.scss'],
  imports: [
    MultiSelect,
    Dialog,
    ReactiveFormsModule,
    FormsModule,
    Avatar,
    NgClass,
    DatePipe,
    NgSwitchCase,
    NgSwitch,
    ButtonDirective,
    ScrollPanel,
    NgIf,
    NgForOf,
    AsyncPipe
  ],
  providers: [RoomCallService]
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
  isMobileView = false;
  private searchTermSubject = new BehaviorSubject<string>('');
  private subscriptions: Subscription[] = [];
  callStatus: CallStatus = {status: 'idle'};
  videoCallStatus: VideoCallStatus = {status: 'idle'};
  showCallDialog: boolean = false;
  private callStatusSubscription: Subscription | undefined;
  private videoCallStatusSubscription: Subscription | undefined;
  callDuration: string = '00:00';
  private callTimer: any;
  currentUser: User;
  rooms: Room[] = [];
  selectedRoom: Room | null = null;
  showRoomDialog = false;
  roomForm: FormGroup;
  roomMessages: RoomMessage[] = [];
  @ViewChild('scrollPanel') private scrollPanel!: ElementRef;
  private resizeObserver: ResizeObserver;
  private readonly MOBILE_BREAKPOINT = 768;

  isInCall: boolean = false;
  callParticipants: string[] = [];
  private remoteAudioElements: { [userId: string]: HTMLAudioElement } = {};

  get searchTermValue(): string {
    return this.searchTermSubject.value;
  }

  set searchTermValue(value: string) {
    this.searchTermSubject.next(value);
  }

  getUserNameById(userId: number): string {
    const user = this.filteredUsers.find(u => Number(u.userId) === userId);
    return user ? user.username : '';
  }

  getUserPhotoById(userId: number | string): string {
    const user = this.userStatuses.find(u => String(u.userId) === String(userId));
    return user?.photoUrl || 'assets/images/default-avatar.png';
  }

  constructor(
      private messagingService: MessagingService,
      private authService: AuthService,
      private cdr: ChangeDetectorRef,
      private voiceCallService: VoiceCallService,
      private videoCallService: VideoCallService,
      private roomService: RoomService,
      private roomMessagingService: RoomMessagingService,
      protected roomCallService: RoomCallService,
      private fb: FormBuilder
  ) {
    this.currentUserId = String(this.authService.getCurrentUser()?.id);
    this.currentUser = this.authService.getCurrentUser();
    this.checkScreenSize();
    this.initRoomForm();
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.checkMobileView(entry.contentRect.width);
      }
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize() {
    this.isMobileView = window.innerWidth <= 450;
  }

  ngOnInit() {
    // Get current user
    this.currentUser = this.authService.getCurrentUser();
    this.currentUserId = String(this.currentUser?.id);

    // Load initial data
    this.loadRooms();
    // this.loadUsers();
    
    // Start room refresh
    this.startRoomRefresh();

    // Subscribe to messages
    this.initializeMessageSubscription();

    // Subscribe to user statuses
    this.subscriptions.push(
        this.messagingService.getUserStatuses().subscribe(statuses => {
          this.userStatuses = this.sortUsersByStatus(statuses);
          this.filteredUsers = this.userStatuses.filter(user =>
              user.userId !== String(this.authService.getCurrentUser()?.id)
          );
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

    // Add resize observer to the container
    const container = document.querySelector('.messaging-container');
    if (container) {
      this.resizeObserver.observe(container);
    }

    // Initial mobile check
    this.checkMobileView(window.innerWidth);

    // Subscribe to call state changes
    this.subscriptions.push(
      this.roomCallService.callState$.subscribe(state => {
        this.isInCall = state.isInCall;
        this.callParticipants = state.participants;
        this.cdr.detectChanges();
      })
    );

    // Listen for remote streams
    window.addEventListener('remote-stream-added', this.handleRemoteStream);
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
    // Clear selected room when selecting a user
    this.selectedRoom = null;

    // Update the messages array with the selected user's messages
    this.messages = this.getMessagesWithUser(user.userId);
    
    // Mark unread messages as read
    this.messages.forEach(message => {
      if (message.receiverId === String(this.authService.getCurrentUser()?.id) && !message.read) {
        this.messagingService.markMessageAsRead(message.id);
      }
    });

    // Force view update and scroll
    setTimeout(() => {
      this.cdr.detectChanges();
      this.scrollToBottom();
    });
  }

  selectRoom(room: Room) {
    this.selectedRoom = room;
    this.selectedUser = null;

    if (room) {
      // Join the room
      this.roomService.joinRoom(room.id, this.currentUser.id)
        .subscribe({
          next: (updatedRoom) => {
            const index = this.rooms.findIndex(r => r.id === updatedRoom.id);
            if (index !== -1) {
              this.rooms[index] = updatedRoom;
            }

            // Start message refresh for this room
            this.roomMessagingService.startMessageRefresh(room.id);

            // Subscribe to messages if not already subscribed
            this.subscribeToMessages();
          }});
            // Send system message for joining
          //   const joinMessage = {
          //     roomId: room.id,
          //     senderId: this.currentUser.id,
          //     content: `${this.currentUser.firstName} ${this.currentUser.lastName} has joined the room`,
          //     timestamp: new Date(),
          //     type: 'system',
          //     isSystemMessage: true
          //   };
          //
          //   this.roomMessagingService.sendRoomMessage(
          //     room.id,
          //     this.currentUser.id,
          //     joinMessage.content,
          //     true
          //   ).subscribe({
          //     next: () => {
          //       this.cdr.detectChanges();
          //       this.scrollToBottom();
          //     },
          //     error: (error) => {
          //       console.error('Error sending join message:', error);
          //     }
          //   });
          // },
          // error: (error) => {
          //   console.error('Error joining room:', error);
          // }

    }
  }

  leaveRoom() {
    if (this.selectedRoom && this.currentUser) {
      // Send leave message before actually leaving
      const leaveMessage = {
        roomId: this.selectedRoom.id,
        senderId: this.currentUser.id,
        content: `${this.currentUser.firstName} ${this.currentUser.lastName} has left the room`,
        timestamp: new Date(),
        type: 'system',
        isSystemMessage: true
      };

      this.roomMessagingService.sendRoomMessage(
        this.selectedRoom.id,
        this.currentUser.id,
        leaveMessage.content,
        true
      ).subscribe({
        next: () => {
          // After sending the leave message, actually leave the room
          this.roomService.leaveRoom(this.selectedRoom.id, this.currentUser.id)
            .subscribe({
              next: (updatedRoom) => {
                // Stop message refresh
                this.roomMessagingService.stopMessageRefresh();

                // Update the room in the rooms list
                const index = this.rooms.findIndex(r => r.id === updatedRoom.id);
                if (index !== -1) {
                  this.rooms[index] = updatedRoom;
                }
                // Clear selected room
                this.selectedRoom = null;
              },
              error: (error) => {
                console.error('Error leaving room:', error);
              }
            });
        },
        error: (error) => {
          console.error('Error sending leave message:', error);
        }
      });
    }
  }

  backToUserList() {
    if (this.selectedUser) {
      this.selectedUser = null;
    }
    if (this.selectedRoom) {
      this.selectedRoom = null;
    }
  }

  sendMessageUser() {
    if (!this.currentMessage?.trim()) return;

    try {
      if (this.selectedUser && this.currentMessage.trim()) {
        this.messagingService.sendMessage(this.selectedUser.userId, this.currentMessage.trim());
        this.currentMessage = '';
        
        // Force view update and scroll
        setTimeout(() => {
          this.cdr.detectChanges();
          this.scrollToBottom();
        });
      }
      // Scroll to bottom immediately after sending
      this.scrollToBottom(false);
      
      // Clear input and blur it to hide mobile keyboard
      this.currentMessage = '';
      (document.activeElement as HTMLElement)?.blur();
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message
    }
  }

  sendMessage() {
    if (!this.currentMessage?.trim()) return;

    try {
      if (this.selectedRoom && this.currentMessage.trim()) {
        this.roomMessagingService.sendRoomMessage(
          this.selectedRoom.id,
          this.currentUser.id,
          this.currentMessage.trim()
        ).subscribe({
          next: () => {
            this.currentMessage = '';
            // Force view update and scroll
            setTimeout(() => {
              this.cdr.detectChanges();
              this.scrollToBottom();
            });
          },
          error: (error) => {
            console.error('Error sending message:', error);
          }
        });
      }
      // Scroll to bottom immediately after sending
      this.scrollToBottom(false);
      
      // Clear input and blur it to hide mobile keyboard
      this.currentMessage = '';
      (document.activeElement as HTMLElement)?.blur();
    } catch (error) {
      console.error('Error sending room message:', error);
      // Show error message
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
    return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
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
      this.voiceCallService.startCall(this.selectedUser.userId, this.currentUserId, this.currentUser.firstName + " " + this.currentUser.lastName
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
  private stopCallTimer() {
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
      this.callDuration = '00:00';
    }
  }

  ngOnDestroy() {
    // Stop message refresh when component is destroyed
    this.roomMessagingService.stopMessageRefresh();
    // Cleanup subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.callStatusSubscription?.unsubscribe();
    this.videoCallStatusSubscription?.unsubscribe();
    this.stopCallTimer();
    this.voiceCallService.endCall();
    this.videoCallService.endCall();
    this.resizeObserver.disconnect();
    window.removeEventListener('remote-stream-added', this.handleRemoteStream);
    this.endRoomCall();
  }

  private initRoomForm() {
    this.roomForm = this.fb.group({
      name: ['', Validators.required],
      subject: ['', Validators.required],
      allowedUsers: [[], Validators.required]
    });
  }

  showCreateRoomDialog() {
    this.showRoomDialog = true;
    this.roomForm.reset({
      name: '',
      subject: '',
      allowedUsers: []
    });
  }

  createRoom() {
    if (this.roomForm.valid && this.currentUser) {
      const formValue = this.roomForm.value;
      const roomData = {
        name: formValue.name,
        subject: formValue.subject,
        allowedUsers: [...new Set([...formValue.allowedUsers, this.currentUser.id])],
        activeParticipants: [],
        createdBy: this.currentUser.id
      };

      this.roomService.createRoom(roomData).subscribe({
        next: (newRoom) => {
          this.rooms.push(newRoom);
          this.showRoomDialog = false;
          this.roomForm.reset({
            name: '',
            subject: '',
            allowedUsers: []
          });
        },
        error: (error) => {
          console.error('Error creating room:', error);
        }
      });
    }
  }

  private loadRooms() {
    if (this.currentUser) {
      this.roomService.getUserRooms(this.currentUser.id).subscribe({
        next: (rooms) => {
          this.rooms = rooms.map(room => ({
            ...room,
            activeParticipants: room.activeParticipants || []
          }));
        },
        error: (error) => {
          console.error('Error loading rooms:', error);
          this.rooms = [];
        }
      });
    }
  }

  private subscribeToMessages() {
    this.subscriptions.push(
      this.roomMessagingService.getRoomMessagesStream().subscribe({
        next: (messages) => {
          this.roomMessages = messages;
          // Force view update and scroll
          setTimeout(() => {
            this.cdr.detectChanges();
            this.scrollToBottom();
          });
        },
        error: (error) => {
          console.error('Error receiving messages:', error);
        }
      })
    );
  }

  loadRoomMessages(roomId: number) {
    this.roomMessagingService.getRoomMessages(roomId)
      .subscribe({
        next: (messages) => {
          this.roomMessages = messages;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading room messages:', error);
        }
      });
  }

  sendRoomMessage() {
    if (this.selectedRoom && this.currentMessage.trim()) {
      this.roomMessagingService.sendRoomMessage(
        this.selectedRoom.id,
        this.currentUser.id,
        this.currentMessage.trim()
      ).subscribe({
        next: (message) => {
          this.roomMessages = [...this.roomMessages, message];
          this.currentMessage = '';
          // Force view update and scroll
          setTimeout(() => {
            this.cdr.detectChanges();
            this.scrollToBottom();
          });
        },
        error: (error) => {
          console.error('Error sending room message:', error);
        }
      });
    }
  }

  getRoomMessageDates(): string[] {
    if (!this.roomMessages?.length) return [];
    
    const dates = new Set<string>();
    this.roomMessages.forEach(message => {
      const date = new Date(message.timestamp);
      dates.add(date.toDateString());
    });
    return Array.from(dates);
  }

  getRoomMessagesByDate(date: string): RoomMessage[] {
    if (!this.roomMessages?.length) return [];
    
    return this.roomMessages.filter(message => {
      const messageDate = new Date(message.timestamp);
      return messageDate.toDateString() === date;
    });
  }

  protected readonly Number = Number;

  private startRoomRefresh() {
    const roomRefresh = interval(5000).subscribe(() => {
      this.loadRooms();
    });
    this.subscriptions.push(roomRefresh);
  }

  private scrollToBottom(smooth = true) {
    setTimeout(() => {
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTo({
          top: messagesContainer.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }, 100);
  }

  private initializeMessageSubscription() {
    this.messagingService.getMessages().subscribe(messages => {
      this.messages = messages;
      if (this.selectedUser) {
        this.messages = this.getMessagesWithUser(this.selectedUser.userId);
      }
      this.updateUnreadCounts();
      // Force view update and scroll
      setTimeout(() => {
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
    });
  }

  ngAfterViewInit() {
    // Initial scroll to bottom after view is initialized
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  private checkMobileView(width: number) {
    this.isMobileView = width <= this.MOBILE_BREAKPOINT;
  }

  private handleRemoteStream = (event: any) => {
    const { userId, stream } = event.detail;
    
    // Create or get audio element for this user
    let audioElement = this.remoteAudioElements[userId];
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.autoplay = true;
      this.remoteAudioElements[userId] = audioElement;
    }
    
    audioElement.srcObject = stream;
  }

  async toggleRoomCall() {
    if (!this.selectedRoom) return;

    try {
      if (this.isInCall) {
        await this.endRoomCall();
      } else {
        const isCallActive = await this.roomCallService.isCallActive(String(this.selectedRoom.id))
          .pipe(take(1))
          .toPromise();

        if (isCallActive) {
          await this.joinRoomCall();
        } else {
          await this.startRoomCall();
        }
      }
    } catch (error) {
      console.error('Error toggling room call:', error);
      // Show error message to user
    }
  }

  protected async startRoomCall() {
    if (!this.selectedRoom || !this.currentUser) return;

    try {
      await this.roomCallService.startCall(String(this.selectedRoom.id), String(this.currentUser.id));
      
      // Send system message about call start
      const message = `${this.currentUser.firstName} ${this.currentUser.lastName} started a voice call`;
      await this.sendSystemMessage(message);
    } catch (error) {
      console.error('Error starting call:', error);
      // Show error message to user
    }
  }

  private async joinRoomCall() {
    if (!this.selectedRoom || !this.currentUser) return;

    try {
      await this.roomCallService.joinCall(String(this.selectedRoom.id), String(this.currentUser.id));
      
      // Send system message about joining call
      const message = `${this.currentUser.firstName} ${this.currentUser.lastName} joined the voice call`;
      await this.sendSystemMessage(message);
    } catch (error) {
      console.error('Error joining call:', error);
      // Show error message to user
    }
  }

  protected async leaveRoomCall() {
    if (!this.selectedRoom || !this.currentUser) return;

    try {
      await this.roomCallService.leaveCall(String(this.selectedRoom.id), String(this.currentUser.id));
      
      // Send system message about leaving call
      const message = `${this.currentUser.firstName} ${this.currentUser.lastName} left the voice call`;
      await this.sendSystemMessage(message);
    } catch (error) {
      console.error('Error leaving call:', error);
      // Show error message to user
    }
  }

  protected async endRoomCall() {
    if (!this.currentUser) return;

    try {
      await this.roomCallService.endCall();
      
      // Cleanup audio elements
      Object.values(this.remoteAudioElements).forEach(audio => {
        audio.srcObject = null;
        audio.remove();
      });
      this.remoteAudioElements = {};

      if (this.selectedRoom) {
        // Send system message about leaving call
        const message = `${this.currentUser.firstName} ${this.currentUser.lastName} left the voice call`;
        await this.sendSystemMessage(message);
      }
    } catch (error) {
      console.error('Error ending call:', error);
      // Show error message to user
    }
  }

  private async sendSystemMessage(content: string) {
    if (!this.selectedRoom) return;

    try {
      await this.roomMessagingService.sendRoomMessage(
        this.selectedRoom.id,
        this.currentUser.id,
        content,
        true
      ).toPromise();
      
      this.cdr.detectChanges();
      this.scrollToBottom();
    } catch (error) {
      console.error('Error sending system message:', error);
    }
  }

  getParticipantName(userId: string): string {
    const user = this.filteredUsers.find(u => String(u.userId) === userId);
    if (user) {
      return user.username ;
    }
    return this.currentUser.username;
  }

  getParticipantPhoto(userId: string): string {
    const user = this.filteredUsers.find(u => String(u.userId) === userId);
    return user?.photoUrl || this.currentUser.photoUrl;
  }
}
