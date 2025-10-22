'use client';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { getUserEmail, getUserRole, logout } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarIcon,
  ClipboardListIcon,
  LogOutIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

export function Navbar() {
  const email = getUserEmail();
  const role = getUserRole();
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <div className="flex items-center space-x-2">
            <Image
              src="/apu-logo.png"
              alt="APU Logo"
              width={40}
              height={40}
              className="object-contain drop-shadow-md dark:hidden"
              priority
            />
            <Image
              src="/apu-logo-darkmode.png"
              alt="APU Logo (White)"
              width={40}
              height={40}
              className="object-contain drop-shadow-md hidden dark:block"
              priority
            />
          </div>
          <span className="hidden sm:inline">APU Sports</span>
        </Link>

        <div className="flex items-center gap-2">
          {role !== 'admin' && (
            <>
              <Link href="/">
                <Button
                  variant={pathname === '/' ? 'default' : 'ghost'}
                  size="sm"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Facilities</span>
                </Button>
              </Link>
              <Link href="/bookings">
                <Button
                  variant={pathname === '/bookings' ? 'default' : 'ghost'}
                  size="sm"
                >
                  <ClipboardListIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">My Bookings</span>
                </Button>
              </Link>
              <Link href="/equipment-requests">
                <Button
                  variant={
                    pathname === '/equipment-requests' ? 'default' : 'ghost'
                  }
                  size="sm"
                >
                  <PackageIcon className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Equipment</span>
                </Button>
              </Link>
            </>
          )}

          {role === 'staff' && (
            <Link href="/staff">
              <Button
                variant={pathname === '/staff' ? 'default' : 'ghost'}
                size="sm"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Staff</span>
              </Button>
            </Link>
          )}

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Account</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 focus:text-red-600 dark:focus:text-red-300"
              >
                <LogOutIcon className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
