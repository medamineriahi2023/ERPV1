import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;

  constructor() {
    // Create audio element when service is initialized
    this.audio = new Audio();
    this.audio.src = 'assets/son/call-son.mp3';
    this.audio.loop = true;
  }

  playCallSound(): void {
    if (!this.audio || this.isPlaying) return;

    // Handle browsers that require user interaction before playing audio
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isPlaying = true;
          console.log('Call sound started playing');
        })
        .catch(error => {
          console.error('Error playing call sound:', error);
          // Reset audio if it fails to play
          this.stopCallSound();
        });
    }
  }

  stopCallSound(): void {
    if (!this.audio || !this.isPlaying) return;

    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.isPlaying = false;
      console.log('Call sound stopped');
    } catch (error) {
      console.error('Error stopping call sound:', error);
    }
  }

  // Clean up resources when service is destroyed
  ngOnDestroy() {
    if (this.audio) {
      this.stopCallSound();
      this.audio = null;
    }
  }
}
