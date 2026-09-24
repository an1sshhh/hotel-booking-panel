import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { IconComponent } from '../shared/icon.component';
import { ToastComponent } from '../shared/toast.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog.component';
import { NotificationService } from '../notifications/notification.service';
import { initials } from '../shared/status';

interface NavItem {
  label: string;
  link: string;
  icon: string;
  exact?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, IconComponent, ToastComponent, ConfirmDialogComponent],
  template: `
    <div class="shell">
      <aside class="sidebar" [class.open]="mobileNavOpen">
        <div class="brand">
          <span class="brand-mark">SF</span>
          <span class="brand-text">
            <span class="brand-name">Stayfarer</span>
            <span class="brand-sub">Admin Panel</span>
          </span>
          <button class="icon-btn nav-close" aria-label="Close menu" (click)="setNav(false)">
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        <nav class="nav">
          @for (group of navGroups; track group.heading) {
            <div class="nav-group">
              <div class="nav-heading">{{ group.heading }}</div>
              @for (item of group.items; track item.link) {
                <a
                  class="nav-link"
                  [routerLink]="item.link"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: !!item.exact }"
                  (click)="setNav(false)"
                >
                  <app-icon [name]="item.icon" [size]="17" [strokeWidth]="1.9" />
                  <span>{{ item.label }}</span>
                  @if (item.link === '/notifications' && unreadCount > 0) {
                    <span class="nav-count">{{ unreadCount }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        @if (user) {
          <div class="sidebar-user">
            <span class="avatar">{{ initials }}</span>
            <span class="user-meta">
              <span class="user-name">{{ user.name }}</span>
              <span class="user-role">{{ user.role }}</span>
            </span>
            <button class="icon-btn" title="Log out" (click)="logout()">
              <app-icon name="logout" [size]="16" />
            </button>
          </div>
        }
      </aside>

      @if (mobileNavOpen) {
        <div class="nav-scrim" (click)="setNav(false)"></div>
      }

      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" aria-label="Open menu" [attr.aria-expanded]="mobileNavOpen" (click)="setNav(!mobileNavOpen)">
            <app-icon name="menu" [size]="20" />
          </button>
          <div class="crumb">{{ currentSection }}</div>
          <div class="topbar-right">
            <a class="icon-btn" routerLink="/notifications" title="Notifications">
              <app-icon name="bell" [size]="18" />
              @if (unreadCount > 0) { <span class="dot"></span> }
            </a>
          </div>
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-toasts />
    <app-confirm-dialog />
  `,
  styles: [
    `
      .shell { display: flex; min-height: 100vh; }

      /* Sidebar */
      .sidebar {
        position: fixed;
        top: 0; left: 0; bottom: 0;
        width: var(--sidebar-w);
        display: flex;
        flex-direction: column;
        background: var(--gray-950);
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        z-index: 50;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0 18px;
        height: var(--topbar-h);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 30px; height: 30px;
        border-radius: 8px;
        background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
      .brand-name { color: #fff; font-size: 14px; font-weight: 600; }
      .brand-sub { color: var(--gray-500); font-size: 11px; }

      .nav { flex: 1; overflow-y: auto; padding: 14px 10px 10px; }
      .nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-color: transparent; }

      .nav-group + .nav-group { margin-top: 18px; }
      .nav-heading {
        padding: 0 10px 7px;
        font-size: 10.5px;
        font-weight: 600;
        letter-spacing: .09em;
        text-transform: uppercase;
        color: var(--gray-600);
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: var(--r-sm);
        color: var(--gray-400);
        font-size: 13.5px;
        font-weight: 500;
        transition: background-color .15s ease, color .15s ease;
      }
      .nav-link:hover { background: rgba(255, 255, 255, 0.05); color: #e2e8f0; }
      .nav-link.active { background: var(--brand-600); color: #fff; }
      .nav-link.active:hover { background: var(--brand-600); color: #fff; }

      .nav-count {
        margin-left: auto;
        padding: 1px 7px;
        border-radius: var(--r-full);
        background: var(--danger-600);
        color: #fff;
        font-size: 10.5px;
        font-weight: 600;
      }

      .sidebar-user {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }
      .sidebar-user .avatar { background: rgba(99, 102, 241, .18); color: #a5b4fc; }
      .user-meta { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
      .user-name { color: #e2e8f0; font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .user-role { color: var(--gray-600); font-size: 11px; text-transform: capitalize; }
      .sidebar-user .icon-btn { margin-left: auto; color: var(--gray-500); }
      .sidebar-user .icon-btn:hover { color: #fff; background: rgba(255,255,255,.07); }

      /* Main column */
      .main {
        flex: 1;
        min-width: 0;
        margin-left: var(--sidebar-w);
        display: flex;
        flex-direction: column;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        gap: 12px;
        height: var(--topbar-h);
        padding: 0 28px;
        background: rgba(255, 255, 255, .85);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--border);
      }
      .crumb { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
      .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 6px; }

      .icon-btn {
        position: relative;
        display: grid;
        place-items: center;
        width: 32px; height: 32px;
        border: none;
        border-radius: var(--r-sm);
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color .15s ease, color .15s ease;
      }
      .icon-btn:hover { background: var(--gray-100); color: var(--text-primary); }
      .icon-btn .dot {
        position: absolute;
        top: 6px; right: 6px;
        width: 6px; height: 6px;
        border-radius: var(--r-full);
        background: var(--danger-600);
      }

      .menu-btn, .nav-close { display: none; }
      .nav-scrim { display: none; }

      .content { flex: 1; min-width: 0; }

      @media (max-width: 900px) {
        .sidebar {
          width: min(var(--sidebar-w), 84vw);
          transform: translateX(-100%);
          transition: transform .2s ease;
        }
        .sidebar.open { transform: none; box-shadow: var(--shadow-lg); }
        .main { margin-left: 0; }
        .menu-btn { display: grid; width: 36px; height: 36px; margin-left: -6px; }
        .nav-close { display: grid; margin-left: auto; color: var(--gray-500); }
        .nav-close:hover { color: #fff; background: rgba(255,255,255,.07); }
        .topbar { padding: 0 16px; }
        .crumb { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
        .nav-scrim {
          display: block;
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, .4);
          z-index: 45;
        }
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  user;
  unreadCount = 0;
  mobileNavOpen = false;
  currentSection = 'Dashboard';

  navGroups: NavGroup[] = [
    {
      heading: 'Overview',
      items: [{ label: 'Dashboard', link: '/dashboard', icon: 'dashboard' }],
    },
    {
      heading: 'Inventory',
      items: [
        { label: 'Hotels', link: '/hotels', icon: 'hotel' },
        { label: 'Bookings', link: '/bookings', icon: 'calendar' },
        { label: 'Customers', link: '/customers', icon: 'users' },
      ],
    },
    {
      heading: 'Commerce',
      items: [
        { label: 'Payments', link: '/payments', icon: 'card' },
        { label: 'Offers', link: '/offers', icon: 'gift' },
        { label: 'Coupons', link: '/coupons', icon: 'tag' },
        { label: 'Reviews', link: '/reviews', icon: 'star' },
        { label: 'Reports', link: '/reports', icon: 'chart' },
      ],
    },
    {
      heading: 'Platform',
      items: [
        { label: 'Admin Users', link: '/admin-users', icon: 'shield' },
        { label: 'Audit Logs', link: '/audit-logs', icon: 'file' },
        { label: 'Notifications', link: '/notifications', icon: 'bell' },
        { label: 'Email Templates', link: '/email-templates', icon: 'mail' },
        { label: 'Settings', link: '/settings', icon: 'settings' },
      ],
    },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.user = this.auth.getUser();
  }

  get initials(): string {
    return initials(this.user?.name);
  }

  ngOnInit(): void {
    this.syncSection(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.syncSection(e.urlAfterRedirects);
        if (this.mobileNavOpen) this.setNav(false);
      });

    this.notificationService.list(true).subscribe({
      next: (list) => {
        this.unreadCount = list.length;
        this.cdr.markForCheck();
      },
      error: () => {
        this.unreadCount = 0;
        this.cdr.markForCheck();
      },
    });
  }

  private syncSection(url: string): void {
    const match = this.navGroups
      .flatMap((g) => g.items)
      .find((item) => url.startsWith(item.link));
    this.currentSection = match?.label ?? 'Dashboard';
  }

  /** Opens/closes the mobile drawer; the page behind it doesn't scroll while it's open. */
  setNav(open: boolean): void {
    this.mobileNavOpen = open;
    document.body.classList.toggle('nav-open', open);
  }

  logout(): void {
    this.setNav(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
