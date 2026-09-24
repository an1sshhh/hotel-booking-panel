import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Review, ReviewService } from './review.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { ConfirmService } from '../shared/confirm.service';
import { statusBadgeClass } from '../shared/status';

@Component({
  selector: 'app-reviews-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Reviews</h1>
          <p class="page-subtitle">Published reviews feed the hotel's average rating automatically.</p>
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t.value) {
          <button class="tab" [class.active]="status === t.value" (click)="status = t.value; refresh()">{{ t.label }}</button>
        }
      </div>

      <div class="toolbar">
        <select class="select" [(ngModel)]="rating" (ngModelChange)="refresh()">
          <option value="">All ratings</option>
          @for (star of [5,4,3,2,1]; track star) { <option [value]="star">{{ star }} star</option> }
        </select>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>Hotel</th><th>Customer</th><th>Rating</th><th>Review</th><th>Date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (review of reviews; track review.id) {
                <tr>
                  <td class="cell-strong">{{ review.hotel_name }}</td>
                  <td>{{ review.customer_name || 'Anonymous' }}</td>
                  <td><span class="star-rating"><app-icon name="star" [size]="13" /> {{ review.rating }}</span></td>
                  <td style="max-width: 380px;">{{ review.review_text || '—' }}</td>
                  <td class="cell-muted">{{ review.created_at | date: 'mediumDate' }}</td>
                  <td><span class="badge" [class]="badgeClass(review.status)">{{ review.status }}</span></td>
                  <td class="text-right">
                    <span class="row-actions" style="justify-content: flex-end;">
                      @if (review.status !== 'published') { <button class="link-btn" (click)="approve(review)">Approve</button> }
                      @if (review.status !== 'hidden') { <button class="link-btn" (click)="hide(review)">Hide</button> }
                      <button class="link-btn danger" (click)="remove(review)">Delete</button>
                    </span>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7">
                  <div class="empty-state">
                    <span class="empty-icon"><app-icon name="star" [size]="22" /></span>
                    <span class="empty-title">No reviews found</span>
                    <span class="empty-text">Guest reviews will show up here for moderation.</span>
                  </div>
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ReviewsListComponent implements OnInit {
  reviews: Review[] = [];
  status = '';
  rating = '';
  tabs = [
    { label: 'All', value: '' },
    { label: 'Pending', value: 'pending' },
    { label: 'Published', value: 'published' },
    { label: 'Hidden', value: 'hidden' },
  ];

  constructor(
    private reviewService: ReviewService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    const params: Record<string, string> = {};
    if (this.status) params['status'] = this.status;
    if (this.rating) params['rating'] = this.rating;
    this.reviewService.list(params).subscribe((reviews) => {
      this.reviews = reviews;
      this.cdr.markForCheck();
    });
  }

  approve(review: Review): void {
    this.reviewService.approve(review.id).subscribe(() => {
      this.toast.success('Review published — hotel rating recalculated');
      this.refresh();
    });
  }

  hide(review: Review): void {
    this.reviewService.hide(review.id).subscribe(() => {
      this.toast.success('Review hidden');
      this.refresh();
    });
  }

  async remove(review: Review): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete this review?',
      message: 'The review will be permanently removed and the hotel rating recalculated.',
      confirmLabel: 'Delete review',
      danger: true,
    });
    if (!ok) return;

    this.reviewService.remove(review.id).subscribe(() => {
      this.toast.success('Review deleted');
      this.refresh();
    });
  }

  badgeClass = statusBadgeClass;
}
