"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button, Typography, TextField } from "@mui/material";
import { sanitizeDisplayName, sanitizePassword } from "@/lib/sanitizeInput";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login.trim() || !password) {
      setError("Pseudo and password required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirmation do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: login.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        username: login.trim().toLowerCase(),
        password,
        callbackUrl: "/",
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Account created. Please sign in.");
        setLoading(false);
        return;
      }
      const navRes = await fetch("/api/nav", { cache: "no-store" });
      const navData = navRes.ok ? await navRes.json().catch(() => ({})) : {};
      const queueMatchId = navData.ongoingQueueMatchId ?? null;
      const pendingCount = navData.pendingGamesCount ?? 0;
      if (queueMatchId) {
        router.replace(`/queue-match/${queueMatchId}`);
      } else if (pendingCount > 0) {
        router.replace("/team-builder");
      } else {
        router.replace("/");
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <Card sx={{ bgcolor: "rgba(26,26,26,0.95)", border: "1px solid rgba(103,232,249,0.3)", boxShadow: "inset 0 0 0 1px rgba(249,168,212,0.1)" }}>
      <CardContent className="pt-6">
        <form onSubmit={handleRegister} className="space-y-4">
          <TextField
            fullWidth
            label="Pseudo"
            type="text"
            value={login}
            onChange={(e) => setLogin(sanitizeDisplayName(e.target.value).replace(/\s/g, ""))}
            variant="outlined"
            size="medium"
            autoComplete="username"
            required
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          <TextField
            fullWidth
            label="Password (min 6 characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(sanitizePassword(e.target.value).replace(/\s/g, ""))}
            variant="outlined"
            size="medium"
            autoComplete="new-password"
            required
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          <TextField
            fullWidth
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(sanitizePassword(e.target.value).replace(/\s/g, ""))}
            variant="outlined"
            size="medium"
            autoComplete="new-password"
            required
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              py: 1.5,
              background: "linear-gradient(135deg, #67e8f9 0%, #f9a8d4 100%)",
              color: "#0f0f0f",
              "&:hover": { opacity: 0.9 },
            }}
          >
            {loading ? "Creating account…" : "Register"}
          </Button>
        </form>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
          Already have an account?{" "}
          <Link href="/login" className="text-cyan-300 hover:text-cyan-200 font-medium">
            Sign in
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
