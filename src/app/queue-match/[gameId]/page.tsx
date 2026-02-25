"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Box, Button, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

type GameData = {
  id: string;
  gameType: string;
  season: number;
  teamA: { id: string; name: string; rating: number }[];
  teamB: { id: string; name: string; rating: number }[];
  status: string;
  winner: string | null;
  createdAt: string;
  source: string;
};

function TeamCard({
  name,
  totalElo,
  players,
  color,
  accent,
  currentUserName,
}: {
  name: string;
  totalElo: number;
  players: { id: string; name: string; rating: number }[];
  color: string;
  accent: string;
  currentUserName?: string;
}) {
  const un = (currentUserName ?? "").trim().toLowerCase();
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: `0 0 0 1px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.02)`,
      }}
    >
      <Box
        sx={{
          py: 1.5,
          px: 2,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: `${accent}08`,
        }}
      >
        <Typography variant="overline" sx={{ color, fontWeight: 700, letterSpacing: 0.5 }}>
          {name}
        </Typography>
        <Typography variant="body2" sx={{ color, fontFamily: "monospace", fontWeight: 600 }}>
          {totalElo} ELO
        </Typography>
      </Box>
      <Box component="ul" sx={{ m: 0, py: 1, px: 0, listStyle: "none" }}>
        {players.map((p, i) => {
          const isYou = un && (p.name ?? "").trim().toLowerCase() === un;
          return (
          <Box
            component="li"
            key={p.id}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 1,
              px: 2,
              borderBottom: i < players.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              ...(isYou ? { border: "1px solid rgba(251, 191, 36, 0.6)", borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.15)", mx: 0.5, mt: 0.5 } : {}),
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: isYou ? "#fcd34d" : "rgba(255,255,255,0.88)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                pr: 1,
                fontWeight: isYou ? 600 : 400,
              }}
            >
              {p.name || "—"}
            </Typography>
            <Typography variant="body2" sx={{ color, fontFamily: "monospace", fontWeight: 500, flexShrink: 0 }}>
              {p.rating ?? "—"}
            </Typography>
          </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function QueueMatchPage() {
  const params = useParams();
  const gameId = typeof params?.gameId === "string" ? params.gameId : "";
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      setError("Missing game id");
      return;
    }
    fetch(`/api/team-builder/games/${gameId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error ?? "Failed to load"); });
        return res.json();
      })
      .then(setGame)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [gameId]);

  const handleSubmitResult = async (winner: "yin" | "yang") => {
    if (!gameId || game?.status !== "pending") return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to submit result");
        return;
      }
      setSubmitted(true);
      setGame((prev) => (prev ? { ...prev, status: "result_submitted", winner } : null));
    } catch {
      setSubmitError("Failed to submit result");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">
          Loading match…
        </Typography>
      </Box>
    );
  }

  if (error || !game) {
    return (
      <Box sx={{ py: 6, px: 2, textAlign: "center" }}>
        <Typography color="error" sx={{ mb: 2 }}>{error ?? "Game not found"}</Typography>
        <Link href="/" className="text-cyan-300 hover:text-cyan-200 font-medium text-sm">
          Back to home
        </Link>
      </Box>
    );
  }

  const { data: session } = useSession();
  const currentUserName = (session?.user?.name ?? session?.user?.email ?? "").trim();
  const isPending = game.status === "pending";
  const gameLabel = GAME_LABELS[game.gameType] ?? game.gameType;
  const eloA = game.teamA.reduce((s, p) => s + (p.rating ?? 0), 0);
  const eloB = game.teamB.reduce((s, p) => s + (p.rating ?? 0), 0);

  return (
    <Box
      sx={{
        maxWidth: 640,
        mx: "auto",
        py: { xs: 3, sm: 5 },
        px: 2,
      }}
    >
      <Link
        href="/ranking/rankedqueue"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-cyan-300 font-medium mb-6 no-underline"
      >
        <ArrowBackIcon sx={{ fontSize: 18 }} />
        Ranked Queue
      </Link>

      <Box
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          bgcolor: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <Box
          sx={{
            py: 2.5,
            px: 3,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}
        >
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
            Queue match
          </Typography>
          <Typography variant="h5" sx={{ color: "#fff", fontWeight: 600, mt: 0.5 }}>
            {gameLabel}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: 0,
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "stretch",
          }}
        >
          <TeamCard
            name="Team Yin"
            totalElo={eloA}
            players={game.teamA}
            color="#67e8f9"
            accent="#67e8f9"
            currentUserName={currentUserName}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: { xs: 2, sm: 0 },
              px: { xs: 0, sm: 1 },
              minWidth: { sm: 48 },
              bgcolor: "rgba(255,255,255,0.02)",
              borderLeft: { xs: "none", sm: "1px solid rgba(255,255,255,0.06)" },
              borderTop: { xs: "1px solid rgba(255,255,255,0.06)", sm: "none" },
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "rgba(255,255,255,0.35)",
                fontWeight: 700,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              VS
            </Typography>
          </Box>
          <TeamCard
            name="Team Yang"
            totalElo={eloB}
            players={game.teamB}
            color="#f9a8d4"
            accent="#f9a8d4"
            currentUserName={currentUserName}
          />
        </Box>

        <Box sx={{ p: 3, borderTop: "1px solid rgba(255,255,255,0.06)", bgcolor: "rgba(0,0,0,0.15)" }}>
          {submitted || !isPending ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                py: 1.5,
                borderRadius: 2,
                bgcolor: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
              }}
            >
              <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 22 }} />
              <Typography variant="body2" sx={{ color: "#86efac", fontWeight: 500 }}>
                {game.winner === "yin" ? "Team Yin" : "Team Yang"} won — result recorded
              </Typography>
            </Box>
          ) : (
            <>
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  color: "rgba(255,255,255,0.5)",
                  textAlign: "center",
                  mb: 2,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Who won? (Only the losing team can submit.)
              </Typography>
              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  size="medium"
                  disabled={submitting}
                  onClick={() => handleSubmitResult("yin")}
                  sx={{
                    borderColor: "rgba(103, 232, 249, 0.4)",
                    color: "#67e8f9",
                    textTransform: "none",
                    fontWeight: 600,
                    px: 3,
                    "&:hover": {
                      borderColor: "#67e8f9",
                      bgcolor: "rgba(103, 232, 249, 0.12)",
                    },
                  }}
                >
                  Yin won
                </Button>
                <Button
                  variant="outlined"
                  size="medium"
                  disabled={submitting}
                  onClick={() => handleSubmitResult("yang")}
                  sx={{
                    borderColor: "rgba(249, 168, 212, 0.4)",
                    color: "#f9a8d4",
                    textTransform: "none",
                    fontWeight: 600,
                    px: 3,
                    "&:hover": {
                      borderColor: "#f9a8d4",
                      bgcolor: "rgba(249, 168, 212, 0.12)",
                    },
                  }}
                >
                  Yang won
                </Button>
              </Box>
              {submitError && (
                <Typography variant="body2" color="error" sx={{ textAlign: "center", mt: 1.5 }}>
                  {submitError}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
