import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessagingComponent } from './messaging.component';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { VideoCallDialogComponent } from './components/video-call-dialog/video-call-dialog.component';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';

@NgModule({
  declarations: [
    MessagingComponent,
    VideoCallDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ScrollPanelModule,
    AvatarModule,
    BadgeModule
  ],
  exports: [
    MessagingComponent
  ]
})
export class MessagingModule { }
