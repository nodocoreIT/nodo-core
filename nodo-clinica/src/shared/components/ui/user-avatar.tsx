import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

interface UserAvatarProps {
  name: string;
  photoUrl?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const sizeClasses = {
  sm: "h-6 w-6",
  default: "h-8 w-8",
  lg: "h-10 w-10",
};

export function UserAvatar({
  name,
  photoUrl,
  size = "default",
  className,
}: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={name} /> : null}
      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
