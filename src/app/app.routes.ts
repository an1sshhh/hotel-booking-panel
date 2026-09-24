import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { SignupComponent } from './auth/signup.component';
import { authGuard } from './auth/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HotelsListComponent } from './hotels/hotels-list.component';
import { HotelFormComponent } from './hotels/hotel-form.component';
import { HotelDetailComponent } from './hotels/hotel-detail.component';
import { RoomDetailComponent } from './hotels/room-detail.component';
import { BookingsListComponent } from './bookings/bookings-list.component';
import { BookingDetailComponent } from './bookings/booking-detail.component';
import { CustomersListComponent } from './customers/customers-list.component';
import { CustomerDetailComponent } from './customers/customer-detail.component';
import { CouponsListComponent } from './coupons/coupons-list.component';
import { OffersListComponent } from './offers/offers-list.component';
import { EmailTemplatesComponent } from './email-templates/email-templates.component';
import { ReviewsListComponent } from './reviews/reviews-list.component';
import { PaymentsListComponent } from './payments/payments-list.component';
import { ReportsComponent } from './reports/reports.component';
import { AdminUsersListComponent } from './admin-users/admin-users-list.component';
import { AuditLogsListComponent } from './audit-logs/audit-logs-list.component';
import { NotificationsListComponent } from './notifications/notifications-list.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },

      { path: 'hotels', component: HotelsListComponent },
      { path: 'hotels/new', component: HotelFormComponent },
      { path: 'hotels/:id', component: HotelDetailComponent },
      { path: 'hotels/:id/edit', component: HotelFormComponent },
      { path: 'hotels/:hotelId/rooms/:roomId', component: RoomDetailComponent },

      { path: 'bookings', component: BookingsListComponent },
      { path: 'bookings/:id', component: BookingDetailComponent },

      { path: 'customers', component: CustomersListComponent },
      { path: 'customers/:id', component: CustomerDetailComponent },

      { path: 'offers', component: OffersListComponent },
      { path: 'coupons', component: CouponsListComponent },
      { path: 'reviews', component: ReviewsListComponent },
      { path: 'payments', component: PaymentsListComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'admin-users', component: AdminUsersListComponent },
      { path: 'audit-logs', component: AuditLogsListComponent },
      { path: 'notifications', component: NotificationsListComponent },
      { path: 'email-templates', component: EmailTemplatesComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
];
