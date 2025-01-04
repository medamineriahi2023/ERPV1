export interface RoomMessage {
  id: number;
  roomId: number;
  senderId: number | string;
  senderName?: string;
  senderPhotoUrl?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'file' | 'image' | 'system';
  fileUrl?: string;
  isSystemMessage?: boolean;
}
