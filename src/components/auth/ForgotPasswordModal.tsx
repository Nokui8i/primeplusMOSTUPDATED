import { useState } from "react";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(getAuth(), email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
      toast.success("A password reset email has been sent.");
      setEmail("");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to send password reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">Forgot Password?</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={isLoading || !email} className="w-full">
            {isLoading ? "Sending..." : "Send Reset Email"}
          </Button>
        </form>
        <button onClick={onClose} className="mt-4 text-xs text-gray-500 hover:underline w-full">Cancel</button>
      </div>
    </div>
  );
} 