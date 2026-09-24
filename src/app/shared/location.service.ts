import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LocationOption {
  isoCode: string;
  name: string;
}

export interface PincodeLookup {
  state: string;
  /** Candidate city names in preference order — try each against the loaded city list. */
  cityCandidates: string[];
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly baseUrl = `${environment.apiUrl}/api/locations`;

  constructor(private http: HttpClient) {}

  countries(): Observable<LocationOption[]> {
    return this.http.get<LocationOption[]>(`${this.baseUrl}/countries`);
  }

  states(countryCode: string): Observable<LocationOption[]> {
    return this.http.get<LocationOption[]>(`${this.baseUrl}/countries/${countryCode}/states`);
  }

  cities(countryCode: string, stateCode: string): Observable<{ name: string }[]> {
    return this.http.get<{ name: string }[]>(`${this.baseUrl}/countries/${countryCode}/states/${stateCode}/cities`);
  }

  lookupPincode(code: string): Observable<PincodeLookup> {
    return this.http.get<PincodeLookup>(`${this.baseUrl}/pincode/${code}`);
  }
}
