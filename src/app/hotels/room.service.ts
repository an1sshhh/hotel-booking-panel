import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RoomType {
  id: number;
  hotel_id: number;
  name: string;
  description: string;
  size_label: string;
  bed_type: string;
  max_adults: number;
  max_children: number;
  max_occupancy: number;
  room_view: string;
  total_rooms: number;
  status: 'active' | 'inactive' | 'maintenance';
  images?: RoomImage[];
  amenities?: { id: number; name: string }[];
  ratePlans?: RatePlan[];
}

export interface RoomImage {
  id: number;
  room_type_id: number;
  url: string;
  category: string;
  is_primary: boolean;
}

export interface RatePlan {
  id: number;
  room_type_id: number;
  name: string;
  price: number;
  currency: string;
  meal_inclusion: string;
  refundable: boolean;
  status: 'active' | 'inactive';
  inclusions?: { id: number; label: string }[];
  cancellationPolicy?: { days_before_checkin: number; refund_percent: number }[];
}

export interface InventoryRow {
  id?: number;
  room_type_id: number;
  date: string;
  total: number;
  booked: number;
  blocked: number;
  available: number;
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listByHotel(hotelId: number): Observable<RoomType[]> {
    return this.http.get<RoomType[]>(`${this.baseUrl}/api/hotels/${hotelId}/room-types`);
  }

  create(hotelId: number, payload: Partial<RoomType>): Observable<RoomType> {
    return this.http.post<RoomType>(`${this.baseUrl}/api/hotels/${hotelId}/room-types`, payload);
  }

  get(id: number): Observable<RoomType> {
    return this.http.get<RoomType>(`${this.baseUrl}/api/room-types/${id}`);
  }

  update(id: number, payload: Partial<RoomType>): Observable<RoomType> {
    return this.http.put<RoomType>(`${this.baseUrl}/api/room-types/${id}`, payload);
  }

  uploadImage(roomTypeId: number, file: File, category: string): Observable<RoomImage> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', category);
    return this.http.post<RoomImage>(`${this.baseUrl}/api/room-types/${roomTypeId}/images`, formData);
  }

  deleteImage(roomTypeId: number, imageId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/room-types/${roomTypeId}/images/${imageId}`);
  }

  setPrimaryImage(roomTypeId: number, imageId: number): Observable<RoomImage> {
    return this.http.put<RoomImage>(`${this.baseUrl}/api/room-types/${roomTypeId}/images/${imageId}/primary`, {});
  }

  updateAmenities(roomTypeId: number, amenityIds: number[]): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/room-types/${roomTypeId}/amenities`, { amenityIds });
  }

  getInventory(roomTypeId: number, from?: string, to?: string): Observable<InventoryRow[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return this.http.get<InventoryRow[]>(`${this.baseUrl}/api/room-types/${roomTypeId}/inventory${qs ? '?' + qs : ''}`);
  }

  setInventory(roomTypeId: number, dates: { date: string; total: number }[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/api/room-types/${roomTypeId}/inventory`, { dates });
  }

  // ---- Rate plans ----

  createRatePlan(roomTypeId: number, payload: any): Observable<RatePlan> {
    return this.http.post<RatePlan>(`${this.baseUrl}/api/room-types/${roomTypeId}/rate-plans`, payload);
  }

}
