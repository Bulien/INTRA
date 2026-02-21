"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";

type SearchUser = { id: string; username: string; name: string };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setUsers([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h4" sx={{ mb: 1, color: "text.primary", fontWeight: 700 }}>
        Find a user
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search by username or display name to view their profile.
      </Typography>

      <Card
        sx={{
          bgcolor: "rgba(26,26,26,0.95)",
          border: "1px solid rgba(103,232,249,0.3)",
          borderRadius: 2,
          mb: 3,
        }}
      >
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              placeholder="Username or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              variant="outlined"
              size="medium"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "rgba(255,255,255,0.5)" }} />
                  </InputAdornment>
                ),
                endAdornment: loading ? (
                  <InputAdornment position="end">
                    <CircularProgress size={24} sx={{ color: "#67e8f9" }} />
                  </InputAdornment>
                ) : null,
                sx: { bgcolor: "rgba(0,0,0,0.2)" },
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            />
          </form>
        </CardContent>
      </Card>

      {searched && (
        <>
          {users.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              No users found. Try a different search (at least 2 characters).
            </Typography>
          ) : (
            <Card
              sx={{
                border: "1px solid rgba(255,255,255,0.1)",
                bgcolor: "rgba(26,26,26,0.8)",
                borderRadius: 2,
              }}
            >
              <List disablePadding>
                {users.map((u) => (
                  <ListItemButton
                    key={u.id}
                    component={Link}
                    href={`/profile/${encodeURIComponent(u.username)}`}
                    sx={{
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      "&:last-child": { borderBottom: "none" },
                    }}
                  >
                    <PersonIcon sx={{ color: "#67e8f9", mr: 1.5, fontSize: 22 }} />
                    <ListItemText
                      primary={u.name !== u.username ? `${u.name} (@${u.username})` : u.username}
                      secondary={u.name !== u.username ? `@${u.username}` : null}
                      primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                      secondaryTypographyProps={{ color: "text.secondary" }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
