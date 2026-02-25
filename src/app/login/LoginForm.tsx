"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, Button, Typography, TextField } from "@mui/material";
import { sanitizeDisplayName, sanitizePassword } from "@/lib/sanitizeInput";

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!login.trim() || !password) {
      setError("Pseudo and password required");
      return;
    }
    setLoading(true);
    try {
      const res = (await signIn("credentials", {
        username: login.trim().toLowerCase(),
        password,
        callbackUrl: "/",
        redirect: true,
      })) as { error?: string } | undefined;
      if (res?.error) setError("Invalid pseudo or password");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ bgcolor: "rgba(26,26,26,0.95)", border: "1px solid rgba(103,232,249,0.3)", boxShadow: "inset 0 0 0 1px rgba(249,168,212,0.1)" }}>
      <CardContent className="pt-6">
        <form onSubmit={handleCredentialsSignIn} className="space-y-4">
          <TextField
            fullWidth
            label="Pseudo"
            type="text"
            value={login}
            onChange={(e) => setLogin(sanitizeDisplayName(e.target.value).replace(/\s/g, ""))}
            variant="outlined"
            size="medium"
            autoComplete="username"
            sx={{ "& .MuiOutlinedInput-root": { bgcolor: "rgba(0,0,0,0.2)" } }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(sanitizePassword(e.target.value).replace(/\s/g, ""))}
            variant="outlined"
            size="medium"
            autoComplete="current-password"
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
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-cyan-300 hover:text-cyan-200 font-medium">
            Register
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
