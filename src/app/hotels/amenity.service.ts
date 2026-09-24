import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Amenity } from './hotel.service';

@Injectable({ providedIn: 'root' })
export class AmenityService {
  private readonly baseUrl = `${environment.apiUrl}/api/amenities`;

  constructor(private http: HttpClient) {}

  list(scope?: 'hotel' | 'room'): Observable<Amenity[]> {
    return this.http.get<Amenity[]>(`${this.baseUrl}${scope ? '?scope=' + scope : ''}`);
  }

  createCustom(name: string, scope: 'hotel' | 'room'): Observable<Amenity> {
    return this.http.post<Amenity>(this.baseUrl, { name, scope });
  }
}
