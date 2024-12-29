import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class CloudinaryService {
  private cloudName = 'ddhnjfnce'; // Your Cloudinary cloud name
  private uploadPreset = 'l7ntmpmf'; // Your unsigned upload preset

  constructor(private http: HttpClient) {}

  /**
   * Uploads an image to Cloudinary
   * @param file The file to upload
   * @returns Observable<string> The URL of the uploaded image
   */
  uploadImage(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    formData.append('cloud_name', this.cloudName);

    // Log FormData for debugging
    for (const pair of (formData as any).entries()) {
      console.log(pair[0], pair[1]);
    }

    return this.http
        .post<any>(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, formData)
        .pipe(
            map((response) => {
              console.log('Upload response:', response);
              return response.secure_url; // Return the secure URL of the uploaded image
            }),
            catchError((error) => {
              console.error('Error uploading to Cloudinary:', error.error);
              throw error;
            })
        );
  }
}
