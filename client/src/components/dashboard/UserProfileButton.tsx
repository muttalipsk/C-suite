import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, Sparkles } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { useLocation } from "wouter";

interface UserProfileButtonProps {
  user?: UserType;
  onLogout: () => void;
  onViewProfile: () => void;
}

export function UserProfileButton({ user, onLogout, onViewProfile }: UserProfileButtonProps) {
  const [, navigate] = useLocation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative rounded-full w-10 h-10 p-0"
          data-testid="button-user-menu"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.photo || ""} alt={user?.name || "User"} />
            <AvatarFallback>
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onViewProfile} data-testid="menu-view-profile">
          <Settings className="w-4 h-4 mr-2" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/create-twin")} data-testid="menu-create-persona">
          <Sparkles className="w-4 h-4 mr-2" />
          Create Persona
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout} data-testid="menu-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
