import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUserRow, AdminUserService, Role } from './admin-user.service';
import { IconComponent } from '../shared/icon.component';
import { ToastService } from '../shared/toast.service';
import { statusBadgeClass, initials } from '../shared/status';

@Component({
  selector: 'app-admin-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Admin Users</h1>
          <p class="page-subtitle">Roles control what each admin can do — permissions are enforced on the API, not just the UI.</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" (click)="showForm = true"><app-icon name="plus" [size]="15" /> Add Admin User</button>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table class="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (user of users; track user.id) {
                <tr>
                  <td>
                    <div class="row" style="gap: 10px;">
                      <span class="avatar">{{ initials(user.name) }}</span>
                      <span class="stack">
                        <span class="cell-strong">{{ user.name }}</span>
                        <span class="cell-muted">{{ user.email }}</span>
                      </span>
                    </div>
                  </td>
                  <td>
                    <select class="select" style="max-width: 200px;" [ngModel]="user.role_name" (ngModelChange)="changeRole(user, $event)">
                      <option [ngValue]="null">No role</option>
                      @for (role of roles; track role.id) { <option [ngValue]="role.name">{{ role.name }}</option> }
                    </select>
                  </td>
                  <td><span class="badge" [class]="badgeClass(user.status)">{{ user.status }}</span></td>
                  <td class="text-right">
                    <button class="link-btn" [class.danger]="user.status === 'active'" (click)="toggleStatus(user)">
                      {{ user.status === 'active' ? 'Disable' : 'Enable' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4"><div class="empty-state">
                  <span class="empty-icon"><app-icon name="shield" [size]="22" /></span>
                  <span class="empty-title">No admin users</span>
                </div></td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Roles & Permissions</h2>
        </div>
        <div class="grid-2">
          @for (role of roles; track role.id) {
            <div class="card">
              <div class="card-header">
                <span class="card-title">{{ role.name }}</span>
                <span class="badge badge-neutral no-dot">{{ role.permissions.length }} permissions</span>
              </div>
              <div class="card-body">
                <div class="row wrap" style="gap: 6px;">
                  @for (permission of role.permissions; track permission) {
                    <span class="badge badge-brand no-dot cell-mono">{{ permission }}</span>
                  } @empty {
                    <span class="muted">No permissions assigned.</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (showForm) {
      <div class="modal-backdrop" (click)="showForm = false">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <span class="modal-title">Add Admin User</span>
            <button class="btn btn-ghost btn-icon" (click)="showForm = false"><app-icon name="x" [size]="16" /></button>
          </div>
          <div class="modal-body">
            <div class="stack" style="gap: 14px;">
              <div class="field"><label class="field-label">Name <span class="req">*</span></label><input class="input" [(ngModel)]="draft.name" /></div>
              <div class="field"><label class="field-label">Email <span class="req">*</span></label><input class="input" type="email" [(ngModel)]="draft.email" /></div>
              <div class="field">
                <label class="field-label">Password <span class="req">*</span></label>
                <input class="input" type="password" [(ngModel)]="draft.password" />
                <span class="field-hint">At least 8 characters.</span>
              </div>
              <div class="field">
                <label class="field-label">Role</label>
                <select class="select" [(ngModel)]="draft.roleId">
                  <option [ngValue]="null">No role</option>
                  @for (role of roles; track role.id) { <option [ngValue]="role.id">{{ role.name }}</option> }
                </select>
              </div>
              @if (error) { <div class="alert alert-danger">{{ error }}</div> }
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showForm = false">Cancel</button>
            <button class="btn btn-primary" (click)="create()">Save Admin User</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminUsersListComponent implements OnInit {
  users: AdminUserRow[] = [];
  roles: Role[] = [];
  showForm = false;
  error = '';
  draft: any = { name: '', email: '', password: '', roleId: null };

  constructor(
    private adminUserService: AdminUserService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.adminUserService.listRoles().subscribe((roles) => {
      this.roles = roles;
      this.cdr.markForCheck();
    });
  }

  refresh(): void {
    this.adminUserService.list().subscribe((users) => {
      this.users = users;
      this.cdr.markForCheck();
    });
  }

  initials = initials;

  create(): void {
    this.error = '';
    if (!this.draft.name || !this.draft.email || !this.draft.password) {
      this.error = 'Name, email and password are required.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.draft.email.trim())) {
      this.error = 'Enter a valid email address.';
      return;
    }
    if (this.draft.password.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }
    this.adminUserService.create(this.draft).subscribe({
      next: () => {
        this.showForm = false;
        this.draft = { name: '', email: '', password: '', roleId: null };
        this.toast.success('Admin user created');
        this.refresh();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to create admin user';
        this.cdr.markForCheck();
      },
    });
  }

  changeRole(user: AdminUserRow, roleName: string): void {
    const role = this.roles.find((r) => r.name === roleName);
    this.adminUserService.update(user.id, { roleId: role?.id }).subscribe(() => {
      this.toast.success(`Role updated for ${user.name}`);
      this.refresh();
    });
  }

  toggleStatus(user: AdminUserRow): void {
    const next = user.status === 'active' ? 'disabled' : 'active';
    this.adminUserService.update(user.id, { status: next }).subscribe(() => {
      this.toast.success(`User ${next}`);
      this.refresh();
    });
  }

  badgeClass = statusBadgeClass;
}
