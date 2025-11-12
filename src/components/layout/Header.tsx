import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookOpen, LogOut, Bell } from "lucide-react";

interface HeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

export const Header = ({ user, onLogout }: HeaderProps) => {
  const getRoleBadge = (role: string) => {
    const variants = {
      student: "bg-success text-success-foreground",
      teacher: "bg-primary text-primary-foreground",
      admin: "bg-accent text-accent-foreground",
    };
    return variants[role as keyof typeof variants] || "bg-muted text-muted-foreground";
  };

  const handleLogoutClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onLogout();
  };

  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold">Examify</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="Notifications" type="button">
                <Bell className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <span className="text-muted-foreground">No notifications</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user.name}</p>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className={getRoleBadge(user.role)}>
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Badge>
              </div>
            </div>
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <Button variant="outline" size="sm" type="button" onClick={handleLogoutClick}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};
