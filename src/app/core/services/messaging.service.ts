import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, timer, interval } from 'rxjs';
import { map, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { Message } from '../interfaces/message.interface';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  OFFLINE = 'OFFLINE'
}

export interface UserStatusInfo {
  userId: string;
  username: string;
  status: UserStatus;
  lastActive: Date;
  photoUrl?: string;
  role?: string;
  position?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessagingService implements OnDestroy {
  private readonly INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly STATUS_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MESSAGE_REFRESH_INTERVAL = 5000; // 5 seconds
  
  private messages = new BehaviorSubject<Message[]>([]);
  private userStatuses = new BehaviorSubject<UserStatusInfo[]>([]);
  private lastActivityTime: number = Date.now();
  private activityCheckInterval: any;
  private statusCheckInterval: any;
  private messageRefreshInterval: any;

  constructor(
    private authService: AuthService,
    private apiService: ApiService
  ) {
    this.initializeUsers();
    this.initializeMessages();
    this.initializeUserActivityMonitoring();
    this.startStatusChecking();
    this.startMessageRefresh();
  }

  private initializeUsers(): void {
    this.authService.getUsers().subscribe(users => {
      const userStatuses: UserStatusInfo[] = users.map(user => ({
        userId: String(user.id),
        username: user.username || `${user.firstName} ${user.lastName}`,
        status: user.status as UserStatus || UserStatus.OFFLINE,
        lastActive: user.lastActive ? new Date(user.lastActive) : new Date(),
        photoUrl: user.photoUrl,
        role: user.role,
        position: user.position
      }));
      
      // Set current user as active
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.updateUserStatus(UserStatus.ACTIVE);
      }
      
      this.userStatuses.next(userStatuses);
    });
  }

  private initializeMessages(): void {
    this.apiService.getMessages().subscribe(messages => {
      this.messages.next(messages);
    });
  }

  private startMessageRefresh(): void {
    this.messageRefreshInterval = setInterval(() => {
      this.apiService.getMessages().subscribe(messages => {
        this.messages.next(messages);
      });
    }, this.MESSAGE_REFRESH_INTERVAL);
  }

  private initializeUserActivityMonitoring(): void {
    const activityEvents = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keypress'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll')
    );

    activityEvents.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.lastActivityTime = Date.now();
      this.updateUserStatus(UserStatus.ACTIVE);
    });

    fromEvent(document, 'visibilitychange').subscribe(() => {
      if (document.hidden) {
        this.updateUserStatus(UserStatus.OFFLINE);
      } else {
        this.lastActivityTime = Date.now();
        this.updateUserStatus(UserStatus.ACTIVE);
      }
    });

    fromEvent(window, 'beforeunload').subscribe(() => {
      this.updateUserStatus(UserStatus.OFFLINE);
    });
  }

  private startStatusChecking(): void {
    this.statusCheckInterval = setInterval(() => {
      this.checkAndUpdateStatuses();
    }, this.STATUS_CHECK_INTERVAL);

    this.activityCheckInterval = setInterval(() => {
      this.checkUserActivity();
    }, this.STATUS_CHECK_INTERVAL);
  }

  private checkAndUpdateStatuses(): void {
    this.authService.getUsers().subscribe(users => {
      const userStatuses: UserStatusInfo[] = users.map(user => ({
        userId: String(user.id),
        username: user.username || `${user.firstName} ${user.lastName}`,
        status: user.status as UserStatus,
        lastActive: user.lastActive ? new Date(user.lastActive) : new Date(),
        photoUrl: user.photoUrl,
        role: user.role,
        position: user.position
      }));
      this.userStatuses.next(userStatuses);
    });
  }

  private checkUserActivity(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      if (timeSinceLastActivity >= this.INACTIVITY_TIMEOUT) {
        this.updateUserStatus(UserStatus.INACTIVE);
      } else if (document.hidden) {
        this.updateUserStatus(UserStatus.OFFLINE);
      } else {
        this.updateUserStatus(UserStatus.ACTIVE);
      }
    }
  }

  private updateUserStatus(status: UserStatus): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const now = new Date().toISOString();
      this.apiService.updateUserStatus(currentUser.id, status, now).subscribe(updatedUser => {
        const currentStatuses = this.userStatuses.value;
        const userIndex = currentStatuses.findIndex(u => u.userId === String(currentUser.id));
        
        const updatedStatus: UserStatusInfo = {
          userId: String(currentUser.id),
          username: currentUser.username || `${currentUser.firstName} ${currentUser.lastName}`,
          status: status,
          lastActive: new Date(now),
          photoUrl: currentUser.photoUrl,
          role: currentUser.role,
          position: currentUser.position
        };

        if (userIndex >= 0) {
          currentStatuses[userIndex] = updatedStatus;
        } else {
          currentStatuses.push(updatedStatus);
        }

        this.userStatuses.next([...currentStatuses]);
      });
    }
  }

  sendMessage(receiverId: string, content: string): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      const newMessage: Message = {
        id: Date.now().toString(),
        senderId: String(currentUser.id),
        senderName: currentUser.username || `${currentUser.firstName} ${currentUser.lastName}`,
        receiverId,
        content,
        timestamp: new Date().toISOString(),
        read: false
      };

      this.apiService.sendMessage(newMessage).subscribe(savedMessage => {
        const currentMessages = this.messages.value;
        this.messages.next([...currentMessages, savedMessage]);
      });
    }
  }

  markMessageAsRead(messageId: string): void {
    this.apiService.updateMessage(messageId, { read: true }).subscribe(updatedMessage => {
      const currentMessages = this.messages.value;
      const updatedMessages = currentMessages.map(message => 
        message.id === messageId ? { ...message, read: true } : message
      );
      this.messages.next(updatedMessages);
    });
  }

  getMessages(): Observable<Message[]> {
    return this.messages.asObservable();
  }

  getUserMessages(userId: string): Observable<Message[]> {
    return this.messages.pipe(
      map(messages => messages.filter(m => 
        m.senderId === userId || m.receiverId === userId
      ))
    );
  }

  getUnreadMessagesCount(userId: string): Observable<number> {
    return this.messages.pipe(
      map(messages => messages.filter(m => 
        m.receiverId === userId && !m.read
      ).length)
    );
  }

  getUserStatuses(): Observable<UserStatusInfo[]> {
    return this.userStatuses.asObservable();
  }

  getUserStatus(userId: string): Observable<UserStatus | null> {
    return this.userStatuses.pipe(
      map(statuses => {
        const userStatus = statuses.find(s => s.userId === userId);
        return userStatus ? userStatus.status : null;
      }),
      distinctUntilChanged()
    );
  }

  ngOnDestroy() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
    }
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    if (this.messageRefreshInterval) {
      clearInterval(this.messageRefreshInterval);
    }
    this.updateUserStatus(UserStatus.OFFLINE);
  }
}
