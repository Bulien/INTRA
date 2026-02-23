"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import HistoryIcon from "@mui/icons-material/History";
import LoginIcon from "@mui/icons-material/Login";

const STORAGE_KEY = "intra-newjoiner-notice-dismissed";

function getDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function NewJoinerNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(!getDismissed());
  }, []);

  const handleClose = () => {
    setDismissed();
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: "1px solid rgba(103,232,249,0.25)",
          background: "linear-gradient(180deg, rgba(26,26,26,0.98) 0%, rgba(18,18,18,0.98) 100%)",
          boxShadow: "0 0 60px -12px rgba(103,232,249,0.2), 0 0 40px -12px rgba(249,168,212,0.1)",
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          pb: 0,
          "& .MuiDialogTitle-root": { padding: 0 },
        }}
      >
        <img
          src="/yin-yang.png"
          alt=""
          aria-hidden
          style={{ height: 36, width: 36, background: "transparent" }}
        />
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#67e8f9" }}>
          Welcome to INTRA
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          INTRA helps you build balanced teams and track rankings for your games. Here’s what you can do:
        </Typography>
        <List dense disablePadding sx={{ "& .MuiListItem-root": { px: 0, py: 0.5 } }}>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <EmojiEventsIcon sx={{ color: "#67e8f9", fontSize: 22 }} />
            </ListItemIcon>
            <ListItemText
              primary="Rankings"
              secondary="View leaderboards per game (LoL, Overwatch, Survival Chaos, Battlerite). Your Elo and rank are based on wins and games played."
              primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
              secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <GroupsIcon sx={{ color: "#f9a8d4", fontSize: 22 }} />
            </ListItemIcon>
            <ListItemText
              primary="Team Builder"
              secondary="Create a game, add players to two teams (Yin & Yang), and submit the result. Results feed into the rankings."
              primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
              secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <PersonIcon sx={{ color: "#a5f3fc", fontSize: 22 }} />
            </ListItemIcon>
            <ListItemText
              primary="Profile"
              secondary="See your stats per game, rank, Elo, and favorite teammates. Open your profile from the nav or by clicking your name."
              primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
              secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <HistoryIcon sx={{ color: "#86efac", fontSize: 22 }} />
            </ListItemIcon>
            <ListItemText
              primary="Game history"
              secondary="Review past games and the Elo you gained or lost in each one. Available from your profile."
              primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
              secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
            />
          </ListItem>
        </List>
        <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.2)" }}>
          <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 1, color: "#67e8f9", fontWeight: 600 }}>
            <LoginIcon sx={{ fontSize: 20 }} />
            Get started
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 3.5 }}>
            Sign in to create games, appear in rankings, and track your profile. Use the person icon in the navbar to sign in or open your profile.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, pt: 0 }}>
        <Button
          component={Link}
          href="/login"
          variant="contained"
          startIcon={<LoginIcon />}
          onClick={handleClose}
          sx={{
            bgcolor: "#67e8f9",
            color: "#0f172a",
            "&:hover": { bgcolor: "#22d3ee" },
          }}
        >
          Sign in
        </Button>
        <Button onClick={handleClose} sx={{ color: "text.secondary" }}>
          Got it, explore first
        </Button>
      </DialogActions>
    </Dialog>
  );
}
