import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './login.component.scss',
})
export class SignupComponent implements OnInit {
  /** null while checking; false once an admin exists (sign-up closed). */
  signupOpen: boolean | null = null;
  name = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = '';
  success = false;
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.auth.signupStatus().subscribe({
      next: (s) => {
        this.signupOpen = s.open;
        this.cdr.markForCheck();
      },
      error: () => {
        this.signupOpen = true; // let the server decide on submit
        this.cdr.markForCheck();
      },
    });
  }

  submit(): void {
    this.error = '';

    if (!this.name || !this.email || !this.password) {
      this.error = 'Name, email and password are required.';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.auth.signup(this.name, this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.cdr.markForCheck();
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Signup failed';
        this.cdr.markForCheck();
      },
    });
  }
}
