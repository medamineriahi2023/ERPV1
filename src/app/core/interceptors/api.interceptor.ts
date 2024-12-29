import { HttpInterceptorFn, HttpHandlerFn } from '@angular/common/http';

const OLD_API_URL = 'https://197.15.18.165:3000';
const NEW_API_URL = 'https://197.15.18.165:3000';

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
