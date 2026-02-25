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
  Tabs,
  Tab,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import PersonIcon from "@mui/icons-material/Person";
import HistoryIcon from "@mui/icons-material/History";
import LoginIcon from "@mui/icons-material/Login";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import ChatIcon from "@mui/icons-material/Chat";

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

type TabValue = "overview" | "queue";

export function NewJoinerNotice() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabValue>("overview");

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
          src="/yinyang_gen2.png"
          alt=""
          aria-hidden
          style={{ height: 36, width: 36, background: "transparent" }}
        />
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#67e8f9" }}>
          Welcome to INTRA
        </Typography>
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v as TabValue)}
        sx={{
          borderBottom: 1,
          borderColor: "rgba(255,255,255,0.12)",
          px: 2,
          mt: 1,
          minHeight: 40,
          "& .MuiTab-root": { minHeight: 40, py: 1 },
        }}
      >
        <Tab label="Overview" value="overview" />
        <Tab label="Queue games" value="queue" />
      </Tabs>
      <DialogContent sx={{ pt: 2, pb: 1, "& .MuiListItemText-secondary": { display: "block", lineHeight: 1.5 } }}>
        {tab === "overview" && (
          <>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
              INTRA helps you build balanced teams and track rankings.
            </Typography>
            <List dense disablePadding sx={{ "& .MuiListItem-root": { px: 0, py: 0.75, alignItems: "flex-start" } }}>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <EmojiEventsIcon sx={{ color: "#67e8f9", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Rankings"
                  secondary={
                    <>
                      Two ladders: <strong>Custom</strong> (team builder) and <strong>Ranked</strong> (queue). Elo and rank per game — LoL, Overwatch, Survival Chaos, Battlerite.
                    </>
                  }
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <GroupsIcon sx={{ color: "#f9a8d4", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Team Builder"
                  secondary="Create a game, add players to Yin & Yang, share it, submit the result. Feeds the Custom leaderboard."
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <SportsEsportsIcon sx={{ color: "#fcd34d", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Queue games"
                  secondary="Join a queue → match is auto-created when enough players → report the winner. Climb the Ranked leaderboard. Details in the “Queue games” tab."
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <ChatIcon sx={{ color: "#a5f3fc", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Chat"
                  secondary="Game channels, DMs, group chats. Use the chat panel to talk with your team or the lobby."
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <PersonIcon sx={{ color: "#86efac", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Profile"
                  secondary="Stats per game, rank, Elo (Custom + Ranked), favorite teammates."
                  primaryTypographyProps={{ fontWeight: 600, color: "text.primary" }}
                  secondaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                  <HistoryIcon sx={{ color: "#86efac", fontSize: 22 }} />
                </ListItemIcon>
                <ListItemText
                  primary="Game history"
                  secondary="Past games and Elo changes. Available from your profile."
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
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 3.5, lineHeight: 1.5 }}>
                Sign in (person icon in navbar) to create games, join the queue, appear in rankings, and use chat.
              </Typography>
            </Box>
          </>
        )}
        {tab === "queue" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Get matched with others and play ranked without setting up the lobby. One click to join, then report the result.
            </Typography>

            <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.95)", fontWeight: 600, mb: 0.5 }}>
              How it works
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.5, "& li": { mb: 1.5 }, "& li:last-child": { mb: 0 } }}>
              <Box component="li" sx={{ pl: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", mb: 0.25 }}>Join the queue</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  Click <strong>Play</strong> in the navbar → choose a game (LoL, Overwatch, Battlerite) → join. You’ll see how many are waiting.
                </Typography>
              </Box>
              <Box component="li" sx={{ pl: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", mb: 0.25 }}>Match is created</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  When there are enough players (10 for LoL/OW, 6 for Battlerite), INTRA balances by Elo and splits into <strong>Yin</strong> and <strong>Yang</strong>. You get a pop-up and go to the match page.
                </Typography>
              </Box>
              <Box component="li" sx={{ pl: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", mb: 0.25 }}>Report who won</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  On the match page, the losing team submits the result. Your Ranked leaderboard Elo and rank update. You can leave the queue anytime before the match is created.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: "rgba(252,211,77,0.08)", border: "1px solid rgba(252,211,77,0.25)" }}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                <strong style={{ color: "#fcd34d" }}>Ranked leaderboard</strong> (queue) is separate from <strong>Custom leaderboard</strong> (team builder). Your profile shows both.
              </Typography>
            </Box>
          </Box>
        )}
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
