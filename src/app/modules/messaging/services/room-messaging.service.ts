import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, Subscription, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RoomMessage } from '../interfaces/room-message.interface';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoomMessagingService implements OnDestroy {
  private apiUrl = `${environment.apiUrl}/room-messages`;
  private roomMessages = new BehaviorSubject<RoomMessage[]>([]);
  private currentRoomId: number | null = null;
  private refreshSubscription: Subscription | null = null;
  private readonly REFRESH_INTERVAL = 600000; // 5 seconds

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Get messages for a specific room
  getRoomMessages(roomId: number): Observable<RoomMessage[]> {
    return this.http.get<any[]>(`${this.apiUrl}?roomId=${roomId}`).pipe(
      map(messages => {
        if (!Array.isArray(messages)) {
          console.error('Expected array of messages but got:', messages);
          return [];
        }

        return messages.map(msg => {
          const currentUser = this.authService.getCurrentUser();
          const isCurrentUser = String(msg.senderId) === String(currentUser.id);

          return {
            id: msg.id || Date.now(),
            roomId: msg.roomId,
            senderId: String(msg.senderId),
            senderName: msg.senderName || (isCurrentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Unknown User'),
            senderPhotoUrl: msg.senderPhotoUrl || (isCurrentUser ? currentUser.photoUrl : ''),
            content: msg.content,
            timestamp: new Date(msg.timestamp || new Date()),
            type: msg.type || 'text',
            fileUrl: msg.fileUrl || '',
            isSystemMessage: msg.isSystemMessage || msg.type === 'system' || 
                           msg.content.includes('has joined the room') || 
                           msg.content.includes('has left the room')
          };
        });
      }),
      catchError(error => {
        console.error('Error fetching room messages:', error);
        return of([]);
      })
    );
  }

  // Start periodic refresh for a room
  startMessageRefresh(roomId: number) {
    // Stop any existing refresh
    this.stopMessageRefresh();
    
    this.currentRoomId = roomId;
    
    // Initial load
    this.getRoomMessages(roomId).subscribe({
      next: messages => {
        console.log('Initial messages loaded:', messages);
        this.roomMessages.next(messages);
      },
      error: error => {
        console.error('Error loading initial messages:', error);
      }
    });

    // Start new refresh cycle
    this.refreshSubscription = interval(this.REFRESH_INTERVAL).pipe(
      switchMap(() => this.getRoomMessages(roomId))
    ).subscribe({
      next: (messages) => {
        console.log('Refreshed messages:', messages);
        this.roomMessages.next(messages);
      },
      error: (error) => {
        console.error('Error refreshing messages:', error);
      }
    });
  }

  // Stop message refresh
  stopMessageRefresh() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
    this.currentRoomId = null;
  }

  // Send a message to a room
  sendRoomMessage(
    roomId: number, 
    senderId: number | string, 
    content: string,
    isSystemMessage: boolean = false
  ): Observable<RoomMessage> {
    const currentUser = this.authService.getCurrentUser();
    const message = {
      id: Date.now(),
      roomId,
      senderId: String(senderId),
      senderName: isSystemMessage ? undefined : `${currentUser.firstName} ${currentUser.lastName}`,
      senderPhotoUrl: isSystemMessage ? undefined : currentUser.photoUrl,
      content,
      timestamp: new Date().toISOString(),
      type: isSystemMessage ? 'system' : 'text',
      isSystemMessage
    };

    return this.http.post<RoomMessage>(`${this.apiUrl}`, message).pipe(
      map(response => ({
        ...response,
        senderId: String(response.senderId),
        timestamp: new Date(response.timestamp)
      })),
      catchError(error => {
        console.error('Error sending message:', error);
        throw error;
      })
    );
  }

  // Get messages stream for real-time updates
  getRoomMessagesStream(): Observable<RoomMessage[]> {
    return this.roomMessages.asObservable();
  }

  ngOnDestroy() {
    this.stopMessageRefresh();
  }
}
