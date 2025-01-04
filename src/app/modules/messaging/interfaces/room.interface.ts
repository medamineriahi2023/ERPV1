export interface Room {
  id: number;
  name: string;
  subject: string;
  allowedUsers: (number | string)[];
  activeParticipants: (number | string)[];
  createdBy: number;
  createdAt: string;
  activeScreenShare: string | null;
}
