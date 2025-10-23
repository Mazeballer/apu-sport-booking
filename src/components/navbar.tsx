'use client';

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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  CalendarIcon,
  ClipboardListIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useEffect, useState } from 'react';

export function Navbar() {
  const email = getUserEmail();
  const role = getUserRole();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const NavigationItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {role !== 'admin' && (
        <>
          <Link href="/" onClick={() => mobile && setOpen(false)}>
            <Button
              variant={pathname === '/' ? 'default' : 'ghost'}
              size={mobile ? 'default' : 'sm'}
              className={mobile ? 'w-full justify-start' : ''}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Facilities
            </Button>
          </Link>
          <Link href="/bookings" onClick={() => mobile && setOpen(false)}>
            <Button
              variant={pathname === '/bookings' ? 'default' : 'ghost'}
              size={mobile ? 'default' : 'sm'}
              className={mobile ? 'w-full justify-start' : ''}
            >
              <ClipboardListIcon className="h-4 w-4 mr-2" />
              My Bookings
            </Button>
          </Link>
          <Link
            href="/equipment-requests"
            onClick={() => mobile && setOpen(false)}
          >
            <Button
              variant={pathname === '/equipment-requests' ? 'default' : 'ghost'}
              size={mobile ? 'default' : 'sm'}
              className={mobile ? 'w-full justify-start' : ''}
            >
              <PackageIcon className="h-4 w-4 mr-2" />
              Equipment
            </Button>
          </Link>
        </>
      )}

      {role === 'staff' && (
        <Link href="/staff" onClick={() => mobile && setOpen(false)}>
          <Button
            variant={pathname === '/staff' ? 'default' : 'ghost'}
            size={mobile ? 'default' : 'sm'}
            className={mobile ? 'w-full justify-start' : ''}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Staff
          </Button>
        </Link>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          {mounted && (
            <Image
              src={
                resolvedTheme === 'dark'
                  ? '/apu-logo-darkmode.png'
                  : '/apu-logo.png'
              }
              alt="APU Logo"
              width={120}
              height={40}
              className="h-8 w-auto md:h-10"
              priority
            />
          )}
          {!mounted && <div className="h-8 w-[100px] md:h-10 md:w-[120px]" />}
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <NavigationItems />
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

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                <div className="flex flex-col gap-2">
                  <NavigationItems mobile />
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex flex-col space-y-2 mb-4">
                    <p className="text-sm font-medium">Account</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {email}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 border-red-500 dark:border-red-400 bg-transparent"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                  >
                    <LogOutIcon className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
