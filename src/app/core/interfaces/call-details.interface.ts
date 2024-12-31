export interface CallDetails {
  id: string;
  callerId: string;
  receiverId: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  status: 'incoming'|'missed' | 'declined' | 'completed' | 'ongoing';
  isJoinable: boolean;
}
