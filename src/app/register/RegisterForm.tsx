"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, Button, Typography, TextField } from "@mui/material";
import { sanitizeDisplayName, sanitizeEmail, sanitizePassword } from "@/lib/sanitizeInput";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Email and password required");
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
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: "/",
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Account created. Please sign in.");
        setLoading(false);
        return;
      }
      router.push("/");
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
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(sanitizeDisplayName(e.target.value))}
            variant="outlined"
            size="medium"
            autoComplete="name"
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
            variant="outlined"
            size="medium"
            autoComplete="email"
            required
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          <TextField
            fullWidth
            label="Password (min 6 characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(sanitizePassword(e.target.value))}
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
