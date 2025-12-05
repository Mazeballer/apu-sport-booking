"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CalendarIcon,
  ClipboardListIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";

import { getUserEmail, getUserRole, logout } from "@/lib/auth";

export function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // If these read from localStorage or any client only source,
  // do not branch on them until after mount
  const role = getUserRole();
  const email = getUserEmail();

  useEffect(() => {
    setMounted(true);
  }, []);

  const safeRole = mounted ? role : undefined;
  const safeEmail = mounted ? email : "";

  const NavItem = ({
    href,
    icon: Icon,
    label,
    isActive,
    mobile = false,
    onClick,
  }: {
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    isActive: boolean;
    mobile?: boolean;
    onClick?: () => void;
  }) => (
    <Button
      asChild
      variant={isActive ? "default" : "ghost"}
      size={mobile ? "default" : "sm"}
      className={mobile ? "w-full justify-start" : ""}
    >
      <Link href={href} onClick={onClick}>
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Link>
    </Button>
  );

  const NavigationItems = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {safeRole !== "admin" && (
        <>
          <NavItem
            href="/"
            icon={CalendarIcon}
            label="Facilities"
            isActive={pathname === "/"}
            mobile={mobile}
            onClick={() => mobile && setOpen(false)}
          />
          <NavItem
            href="/bookings"
            icon={ClipboardListIcon}
            label="My Bookings"
            isActive={pathname === "/bookings"}
            mobile={mobile}
            onClick={() => mobile && setOpen(false)}
          />
          <NavItem
            href="/equipment-requests"
            icon={PackageIcon}
            label="Equipment"
            isActive={pathname === "/equipment-requests"}
            mobile={mobile}
            onClick={() => mobile && setOpen(false)}
          />
        </>
      )}

      {safeRole === "staff" && (
        <NavItem
          href="/staff"
          icon={SettingsIcon}
          label="Staff"
          isActive={pathname === "/staff"}
          mobile={mobile}
          onClick={() => mobile && setOpen(false)}
        />
      )}
    </>
  );

  return (
    <nav className="w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          {mounted ? (
            <Image
              src={
                resolvedTheme === "dark"
                  ? "/apu-logo-darkmode.png"
                  : "/apu-logo.png"
              }
              alt="APU Logo"
              width={120}
              height={40}
              className="h-8 w-auto md:h-10"
              priority
            />
          ) : (
            <div className="h-8 w-[100px] md:h-10 md:w-[120px]" />
          )}
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <NavigationItems />
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Account menu"
              >
                <UserIcon className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Account</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {safeEmail}
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
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[280px] sm:w-[320px]">
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
                      {safeEmail}
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
