// Simple cn function without external dependencies
export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return inputs.filter(Boolean).join(' ');
}

// Function to check if content is a command
export const isCommand = (content: string) => {
  return content.trim().startsWith('$') || content.trim().startsWith('>');
};
