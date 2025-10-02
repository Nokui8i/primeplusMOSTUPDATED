import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Function to check if content is a command
export const isCommand = (content: string) => {
  return content.trim().startsWith('$') || content.trim().startsWith('>');
};
