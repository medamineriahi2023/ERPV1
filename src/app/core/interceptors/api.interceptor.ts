import { HttpInterceptorFn, HttpHandlerFn } from '@angular/common/http';

const OLD_API_URL = 'http://localhost:3000';
const NEW_API_URL = 'https://fc97-197-15-227-108.ngrok-free.app';

export const apiInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  // Add ngrok header to skip browser warning
  let modifiedRequest = req.clone({
    setHeaders: {
      'ngrok-skip-browser-warning': '1'
    }
  });

  // Replace the API URL
  if (modifiedRequest.url.includes(OLD_API_URL)) {
    modifiedRequest = modifiedRequest.clone({
      url: modifiedRequest.url.replace(OLD_API_URL, NEW_API_URL)
    });
  }

  return next(modifiedRequest);
};
