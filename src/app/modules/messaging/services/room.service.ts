import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Room } from '../interfaces/room.interface';

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private apiUrl = `${environment.apiUrl}/rooms`;

  constructor(private http: HttpClient) {}

  createRoom(roomData: Partial<Room>): Observable<Room> {
    const room = {
      ...roomData,
      activeParticipants: [],
      createdAt: new Date().toISOString(),
      activeScreenShare: null
    };
    return this.http.post<Room>(this.apiUrl, room);
  }

  getUserRooms(userId: number | string): Observable<Room[]> {
    // Get rooms where the user is in allowedUsers
    return this.http.get<Room[]>(`${this.apiUrl}`).pipe(
      map(rooms => rooms.map(room => ({
        ...room,
        activeParticipants: room.activeParticipants || []
      })).filter(room => 
        room.allowedUsers.map(id => String(id)).includes(String(userId))
      ))
    );
  }

  joinRoom(roomId: number, userId: number | string): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}/${roomId}`).pipe(
      switchMap(room => {
        const activeParticipants = room.activeParticipants || [];
        if (!activeParticipants.includes(String(userId))) {
          activeParticipants.push(String(userId));
        }
        return this.http.patch<Room>(`${this.apiUrl}/${roomId}`, { activeParticipants });
      })
    );
  }

  leaveRoom(roomId: number, userId: number | string): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}/${roomId}`).pipe(
      switchMap(room => {
        const activeParticipants = (room.activeParticipants || []).filter(id => id !== String(userId));
        return this.http.patch<Room>(`${this.apiUrl}/${roomId}`, { activeParticipants });
      })
    );
  }

  updateRoom(roomId: number, updates: Partial<Room>): Observable<Room> {
    return this.http.patch<Room>(`${this.apiUrl}/${roomId}`, updates);
  }

  deleteRoom(roomId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${roomId}`);
  }

  getRoomById(roomId: number): Observable<Room> {
    return this.http.get<Room>(`${this.apiUrl}/${roomId}`).pipe(
      map(room => ({
        ...room,
        activeParticipants: room.activeParticipants || []
      }))
    );
  }
}
