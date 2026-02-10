import { useLocation } from "wouter";
import { Sun, Moon, Lightbulb, FileText, Terminal, LayoutDashboard, Shield, LogOut, HelpCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ActiveProjectIndicator } from "@/components/active-project-indicator";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useAdminStatus } from "@/hooks/use-admin-status";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useOnboardingContext } from "@/App";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Ideas", href: "/ideas", icon: Lightbulb },
  { title: "Requirements", href: "/requirements", icon: FileText },
  { title: "Prompts", href: "/prompts", icon: Terminal },
];

function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { isAdmin } = useAdminStatus();

  return (
    <Sidebar>
      <SidebarHeader className="!flex-row !p-0 h-14 min-h-14 items-center px-4 border-b border-sidebar-border" data-testid="sidebar-header">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight" data-testid="text-app-name">IdeaForge</span>
            <span className="text-[11px] text-muted-foreground leading-none">Build Pipeline</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium">Pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => setLocation(item.href)}
                      data-active={isActive}
                      data-testid={`nav-${item.title.toLowerCase()}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setLocation("/admin")}
                    data-active={location.startsWith("/admin")}
                    data-testid="nav-admin"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin Console</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="text-[11px] text-muted-foreground text-center">
          Closed Alpha
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openOnboarding } = useOnboardingContext();

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
    : user?.email || "User";

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] || ""}`
    : user?.email?.[0]?.toUpperCase() || "U";

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="flex items-center justify-between gap-4 h-14 px-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40" data-testid="top-bar">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Separator orientation="vertical" className="h-5" />
        <ActiveProjectIndicator />
      </div>
      <div className="flex items-center gap-2">
        <ProjectSwitcher />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-help-menu">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openOnboarding()} data-testid="menu-item-onboarding">
              <BookOpen className="h-4 w-4 mr-2" />
              View Introduction
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="button-user-menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                {user?.email && (
                  <p className="text-xs text-muted-foreground leading-none">{user.email}</p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
