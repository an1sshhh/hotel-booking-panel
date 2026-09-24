import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from '../shared/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = auth.getToken();

  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      // A rejected token (expired after 8h, or signed with an old secret) used to leave every
      // page silently empty. Sign out and send the admin back to login instead.
      const isAuthCall = req.url.includes('/api/auth/');
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !isAuthCall) {
        auth.logout();
        toast.error('Your session has expired — please sign in again.');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};
