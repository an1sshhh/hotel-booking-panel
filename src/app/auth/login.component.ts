import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

type Step = 'credentials' | 'otp';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  step: Step = 'credentials';
  email = '';
  password = '';
  otp = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  submitCredentials(): void {
    this.error = '';
    this.loading = true;

    this.auth.requestOtp(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'otp';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Login failed';
        this.cdr.markForCheck();
      },
    });
  }

  submitOtp(): void {
    this.error = '';
    this.loading = true;

    this.auth.verifyOtp(this.email, this.otp).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Invalid or expired code';
        this.cdr.markForCheck();
      },
    });
  }

  backToCredentials(): void {
    this.step = 'credentials';
    this.otp = '';
    this.error = '';
  }
}
