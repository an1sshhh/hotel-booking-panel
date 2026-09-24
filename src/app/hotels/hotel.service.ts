import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { toQuery } from '../shared/http-params';

export interface Hotel {
  id: number;
  name: string;
  hotel_type: string;
  star_category: number | null;
  description: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  website: string;
  status: 'draft' | 'active' | 'inactive' | 'suspended';
  check_in_time: string;
  check_out_time: string;
  early_checkin_available: boolean;
  late_checkout_available: boolean;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  children_allowed: boolean;
  policy_notes: string;
  rating: number;
  reviews_count: number;
  image_url?: string;
  images?: HotelImage[];
  amenities?: { id: number; name: string }[];
}

export interface HotelImage {
  id: number;
  hotel_id: number;
  url: string;
  category: string;
  is_primary: boolean;
  sort_order: number;
}

export interface Amenity {
  id: number;
  name: string;
  scope: 'hotel' | 'room' | 'both';
}

@Injectable({ providedIn: 'root' })
export class HotelService {
  private readonly baseUrl = `${environment.apiUrl}/api/hotels`;

  constructor(private http: HttpClient) {}

  list(params?: { status?: string; city?: string; search?: string }): Observable<Hotel[]> {
    const url = `${this.baseUrl}${toQuery(params)}`;
    return this.http.get<Hotel[]>(url);
  }

  get(id: number): Observable<Hotel> {
    return this.http.get<Hotel>(`${this.baseUrl}/${id}`);
  }

  create(payload: Partial<Hotel>): Observable<Hotel> {
    return this.http.post<Hotel>(this.baseUrl, payload);
  }

  update(id: number, payload: Partial<Hotel>): Observable<Hotel> {
    return this.http.put<Hotel>(`${this.baseUrl}/${id}`, payload);
  }

  uploadImage(hotelId: number, file: File, category: string): Observable<HotelImage> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', category);
    return this.http.post<HotelImage>(`${this.baseUrl}/${hotelId}/images`, formData);
  }

  setPrimaryImage(hotelId: number, imageId: number): Observable<HotelImage> {
    return this.http.put<HotelImage>(`${this.baseUrl}/${hotelId}/images/${imageId}/primary`, {});
  }

  deleteImage(hotelId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${hotelId}/images/${imageId}`);
  }

  updateAmenities(hotelId: number, amenityIds: number[]): Observable<Amenity[]> {
    return this.http.put<Amenity[]>(`${this.baseUrl}/${hotelId}/amenities`, { amenityIds });
  }
}
