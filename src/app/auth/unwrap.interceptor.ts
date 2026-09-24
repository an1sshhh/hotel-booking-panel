import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

function isEnvelope(body: unknown): body is { success: boolean; data: unknown } {
  return !!body && typeof body === 'object' && 'success' in body && 'data' in body;
}

export const unwrapInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && isEnvelope(event.body)) {
        return event.clone({ body: event.body.data });
      }
      return event;
    })
  );
