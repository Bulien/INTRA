"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import PeopleIcon from "@mui/icons-material/People";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GavelIcon from "@mui/icons-material/Gavel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

type UserRow = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  role: string;
  bannedUntil: string | null;
  createdAt: string;
};

type KPIs = {
  totalUsers: number;
  usersLast7d: number;
  usersLast30d: number;
  bannedCount: number;
  totalGames: number;
  gamesLast7d: number;
  gamesLast30d: number;
  totalResults: number;
  resultsLast7d: number;
};

type TimeSeries = { date: string; count: number };

type StatsResponse = {
  kpis: KPIs;
  usersOverTime: TimeSeries[];
  gamesOverTime: TimeSeries[];
  resultsOverTime: TimeSeries[];
};

const BAN_PRESETS = [
  { label: "1 hour", minutes: 60 },
  { label: "1 day", minutes: 24 * 60 },
  { label: "7 days", minutes: 7 * 24 * 60 },
  { label: "30 days", minutes: 30 * 24 * 60 },
  { label: "Unban", minutes: 0 },
];

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch("/api/admin/users", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch users");
  const data = await res.json();
  return data.users;
}

async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch("/api/admin/stats", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [banAnchor, setBanAnchor] = useState<{ el: HTMLElement; user: UserRow } | null>(null);
  const banMenuAnchorEl = banAnchor?.el ?? null;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchStats()])
      .then(([u, s]) => {
        setUsers(u);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) load();
    else alert("Failed to delete user.");
  };

  const handleBan = async (userId: string, minutes: number) => {
    setBanAnchor(null);
    const bannedUntil =
      minutes === 0 ? null : new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannedUntil }),
    });
    if (res.ok) load();
    else alert("Failed to update ban.");
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
        <CircularProgress size={40} sx={{ color: "#67e8f9" }} />
      </Box>
    );
  }

  const kpis = stats?.kpis;

  return (
    <Box sx={{ py: 3, px: 1 }}>
      <Typography variant="h4" sx={{ mb: 3, color: "text.primary", fontWeight: 700 }}>
        Admin Console
      </Typography>

      {/* KPIs */}
      {kpis && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 4 }}>
          <Card sx={{ minWidth: 140, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <PeopleIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">Total users</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">{kpis.totalUsers}</Typography>
              <Typography variant="caption" color="text.secondary">
                +{kpis.usersLast7d} last 7d · +{kpis.usersLast30d} last 30d
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 140, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <SportsEsportsIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">Team games</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">{kpis.totalGames}</Typography>
              <Typography variant="caption" color="text.secondary">
                +{kpis.gamesLast7d} last 7d
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 140, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <EmojiEventsIcon sx={{ color: "primary.main", fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">Ranking results</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold">{kpis.totalResults}</Typography>
              <Typography variant="caption" color="text.secondary">
                +{kpis.resultsLast7d} last 7d
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 140, bgcolor: "background.paper", border: "1px solid", borderColor: "error.main" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <GavelIcon sx={{ color: "error.main", fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">Banned</Typography>
              </Box>
              <Typography variant="h5" fontWeight="bold" color="error.main">{kpis.bannedCount}</Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Graphs */}
      {stats && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mb: 4 }}>
          <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Users registered over time</Typography>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.usersOverTime.slice(-30)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} />
                  <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Team builder games by day</Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.gamesOverTime.slice(-14)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} />
                    <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>Ranking results by day</Typography>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.resultsOverTime.slice(-14)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="rgba(255,255,255,0.5)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="rgba(255,255,255,0.5)" />
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155" }} />
                    <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* User management */}
      <Card sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>User management</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: "transparent", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Registered</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const isBanned = u.bannedUntil && new Date(u.bannedUntil) > new Date();
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {u.name || u.username || u.email || u.id.slice(0, 8)}
                        </Typography>
                        {u.username && u.name !== u.username && (
                          <Typography variant="caption" color="text.secondary">@{u.username}</Typography>
                        )}
                      </TableCell>
                      <TableCell>{u.email ?? "—"}</TableCell>
                      <TableCell>
                        <Chip label={u.role} size="small" color={u.role === "admin" ? "primary" : "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {isBanned ? (
                          <Chip label={`Banned until ${new Date(u.bannedUntil!).toLocaleDateString()}`} size="small" color="error" />
                        ) : (
                          <Chip label="Active" size="small" color="success" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => setBanAnchor({ el: e.currentTarget, user: u })}
                          title="Ban / Unban"
                          color="warning"
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(u.id)} title="Delete user" color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Menu
            open={!!banAnchor}
            anchorEl={banMenuAnchorEl}
            onClose={() => setBanAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            {BAN_PRESETS.map((p) => (
              <MenuItem
                key={p.label}
                onClick={() => banAnchor && handleBan(banAnchor.user.id, p.minutes)}
              >
                {p.label}
              </MenuItem>
            ))}
          </Menu>
        </CardContent>
      </Card>
    </Box>
  );
}
