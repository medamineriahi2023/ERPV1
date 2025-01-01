import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';

interface CallNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

interface NotificationOptions {
  body: string;
  icon: string;
  badge: string;
  tag: string;
  requireInteraction: boolean;
  actions: CallNotificationAction[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'; // Replace with your VAPID public key

  constructor(private swPush: SwPush) {}

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  async showCallNotification(callerInfo: { id: string; name: string }): Promise<void> {
    if (!await this.requestPermission()) {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const options: NotificationOptions = {
        body: `Incoming call from ${callerInfo.name}`,
        icon: '/assets/icons/call-icon.png',
        badge: '/assets/icons/badge-icon.png',
        tag: `call-${callerInfo.id}`,
        requireInteraction: true,
        actions: [
          {
            action: 'accept',
            title: 'Accept',
            icon: '/assets/icons/accept-call.png'
          },
          {
            action: 'decline',
            title: 'Decline',
            icon: '/assets/icons/decline-call.png'
          }
        ]
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        await navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification('Incoming Call', options);
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
            const action = event.data.action;
            if (action === 'accept') {
              window.dispatchEvent(new CustomEvent('acceptCall', { detail: callerInfo }));
            } else if (action === 'decline') {
              window.dispatchEvent(new CustomEvent('declineCall', { detail: callerInfo }));
            }
          }
        });
      } else {
        // Fallback for when service worker is not available
        const simpleNotification = new Notification('Incoming Call', {
          body: `Incoming call from ${callerInfo.name}`,
          icon: '/assets/icons/call-icon.png',
        });

        simpleNotification.onclick = () => {
          window.focus();
          simpleNotification.close();
          window.dispatchEvent(new CustomEvent('acceptCall', { detail: callerInfo }));
        };
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async subscribeToPushNotifications(): Promise<string | null> {
    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY
      });
      return JSON.stringify(sub);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }
}
