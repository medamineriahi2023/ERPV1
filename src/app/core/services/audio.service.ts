import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private pendingPlay = false;
  private audioReady = new BehaviorSubject<boolean>(false);

  constructor() {
    // Create audio element when service is initialized
    this.audio = new Audio();
    this.audio.src = 'assets/son/call-son.mp3';
    this.audio.loop = true;

    // Listen for user interaction to enable audio
    window.addEventListener('click', () => this.handleUserInteraction());
    window.addEventListener('touchstart', () => this.handleUserInteraction());
    window.addEventListener('keydown', () => this.handleUserInteraction());
  }

  private handleUserInteraction() {
    if (!this.audioReady.value) {
      this.audioReady.next(true);
      if (this.pendingPlay) {
        this.playCallSound();
      }
    }
  }

  async playCallSound(): Promise<void> {
    if (!this.audio || this.isPlaying) return;

    if (!this.audioReady.value) {
      this.pendingPlay = true;
      return;
    }

    try {
      await this.audio.play();
      this.isPlaying = true;
      this.pendingPlay = false;
      console.log('Call sound started playing');
    } catch (error) {
      console.error('Error playing call sound:', error);
      this.stopCallSound();
    }
  }

  stopCallSound(): void {
    if (!this.audio) return;

    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
      this.pendingPlay = false;
      console.log('Call sound stopped');
    } catch (error) {
      console.error('Error stopping call sound:', error);
    }
  }

  ngOnDestroy() {
    if (this.audio) {
      this.stopCallSound();
      this.audio = null;
    }
    window.removeEventListener('click', () => this.handleUserInteraction());
    window.removeEventListener('touchstart', () => this.handleUserInteraction());
    window.removeEventListener('keydown', () => this.handleUserInteraction());
  }
}
