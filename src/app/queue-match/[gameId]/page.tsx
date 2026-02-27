"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Box, Button, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { BattleriteDraft, type DraftState } from "@/components/BattleriteDraft";

function AcceptScreen({
  gameId,
  teamA,
  teamB,
  draftState,
  currentUserId,
  onUpdate,
}: {
  gameId: string;
  teamA: { id: string; name: string; rating: number }[];
  teamB: { id: string; name: string; rating: number }[];
  draftState: DraftState;
  currentUserId: string;
  onUpdate: () => void;
}) {
  const acceptDeadline = draftState.acceptDeadline ?? "";
  const acceptedIds = new Set(draftState.acceptedUserIds ?? []);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!acceptDeadline) return;
    const end = new Date(acceptDeadline).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [acceptDeadline]);

  const handleAccept = async () => {
    if (!gameId || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/accept`, { method: "POST" });
      if (res.ok) onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const allPlayers = [...teamA, ...teamB];
  const hasAccepted = currentUserId && acceptedIds.has(currentUserId);

  return (
    <Box sx={{ minHeight: "100vh", py: 4, px: 2, maxWidth: 480, mx: "auto" }}>
      <Link
        href="/ranking/rankedqueue"
        className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-cyan-300 font-medium mb-6 no-underline"
      >
        <ArrowBackIcon sx={{ fontSize: 18 }} />
        Back
      </Link>
      <Box
        sx={{
          borderRadius: 3,
          overflow: "hidden",
          bgcolor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(103, 232, 249, 0.3)",
          p: 3,
        }}
      >
        <Typography variant="h6" sx={{ color: "#67e8f9", fontWeight: 700, mb: 1 }}>
          Match found — Accept game
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mb: 3 }}>
          Accept before the timer runs out to join the draft. When all 6 players accept, the draft will start.
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>
            Time left:
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontFamily: "monospace",
              fontWeight: 700,
              color: secondsLeft <= 5 ? "#f87171" : "#67e8f9",
            }}
          >
            {String(secondsLeft).padStart(2, "0")}
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", display: "block", mb: 2 }}>
          {acceptedIds.size} / 6 accepted
        </Typography>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", mb: 3 }}>
          {allPlayers.map((p) => (
            <Box
              key={p.id}
              component="li"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 1,
                px: 0,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
                {p.name || "—"}
              </Typography>
              {acceptedIds.has(p.id) ? (
                <CheckCircleIcon sx={{ color: "#22c55e", fontSize: 20 }} />
              ) : (
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                  Waiting
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        {!hasAccepted && (
          <Button
            variant="contained"
            fullWidth
            disabled={loading || secondsLeft <= 0}
            onClick={handleAccept}
            sx={{
              bgcolor: "rgba(103, 232, 249, 0.2)",
              color: "#67e8f9",
              "&:hover": { bgcolor: "rgba(103, 232, 249, 0.3)" },
            }}
          >
            {loading ? "…" : "Accept"}
          </Button>
        )}
        {hasAccepted && (
          <Typography variant="body2" sx={{ color: "#67e8f9", textAlign: "center" }}>
            You accepted. Waiting for other players…
          </Typography>
        )}
      </Box>
    </Box>
  );
}

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
  resultVotes?: { votesYin: number; votesYang: number };
  draftState?: DraftState;
  cancelledByName?: string;
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
              ...(isYou ? { outline: "1px solid rgba(251, 191, 36, 0.6)", outlineOffset: -1, borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.15)" } : {}),
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
  const { data: session } = useSession();
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
      .then(async (res) => {
        const text = await res.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load");
        return data;
      })
      .then(setGame)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [gameId]);

  const [voteRecordedMessage, setVoteRecordedMessage] = useState<string | null>(null);
  const fetchGame = useCallback(() => {
    if (!gameId) return;
    fetch(`/api/team-builder/games/${gameId}`, { cache: "no-store" })
      .then(async (r) => {
        const text = await r.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
        return { ok: r.ok, data };
      })
      .then(({ ok, data }) => {
        if (ok && data != null && typeof data === "object" && "id" in data) setGame(data as GameData);
      })
      .catch(() => {});
  }, [gameId]);

  const draftState = game?.draftState as DraftState | undefined;
  const isBattleriteAccept =
    game?.gameType === "battlerite" &&
    game?.source === "ranked_queue" &&
    draftState?.phase === "accept";
  const isBattleriteDraft =
    game?.gameType === "battlerite" &&
    game?.source === "ranked_queue" &&
    draftState?.phase === "draft";
  const handleDraftUpdate = useCallback(
    (partial?: { draftState: DraftState }) => {
      if (partial?.draftState) setGame((prev) => (prev ? { ...prev, draftState: partial.draftState } : null));
      fetchGame();
    },
    [fetchGame]
  );

  useEffect(() => {
    if (!gameId || (!isBattleriteDraft && !isBattleriteAccept)) return;
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [isBattleriteDraft, isBattleriteAccept, gameId, fetchGame]);

  const handleSubmitResult = async (winner: "yin" | "yang") => {
    if (!gameId || game?.status !== "pending") return;
    setSubmitting(true);
    setSubmitError(null);
    setVoteRecordedMessage(null);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner }),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to submit result");
        return;
      }
      if (data.winner) {
        setSubmitted(true);
        setGame((prev) => (prev ? { ...prev, status: "result_submitted", winner: data.winner } : null));
      } else if (data.voteRecorded) {
        setVoteRecordedMessage(data.message ?? "Your vote was recorded. One more matching vote is needed to confirm the result.");
        fetchGame();
      }
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

  if (game.status === "cancelled") {
    const declinedByName = game.cancelledByName ?? "A player";
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
        <Box sx={{ textAlign: "center", maxWidth: 400 }}>
          <Typography variant="h6" sx={{ color: "#f87171", fontWeight: 700, mb: 1 }}>
            Game cancelled
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.9)", mb: 3 }}>
            <strong>{declinedByName}</strong> declined the game.
          </Typography>
          <Link
            href="/ranking/rankedqueue"
            className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200 font-medium no-underline"
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            Back to ranked queue
          </Link>
        </Box>
      </Box>
    );
  }

  if (isBattleriteAccept && draftState) {
    return (
      <AcceptScreen
        gameId={game.id}
        teamA={game.teamA}
        teamB={game.teamB}
        draftState={draftState}
        currentUserId={session?.user?.id ?? ""}
        onUpdate={fetchGame}
      />
    );
  }

  if (isBattleriteDraft && game.draftState) {
    return (
      <Box sx={{ minHeight: "100vh" }}>
        <Link
          href="/ranking/rankedqueue"
          className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-cyan-300 font-medium p-4 no-underline"
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          Back
        </Link>
        <BattleriteDraft
          gameId={game.id}
          teamA={game.teamA}
          teamB={game.teamB}
          draftState={game.draftState as DraftState}
          currentUserId={session?.user?.id ?? ""}
          onUpdate={handleDraftUpdate}
        />
      </Box>
    );
  }

  const currentUserName = (session?.user?.name ?? session?.user?.email ?? "").trim();
  const un = currentUserName.toLowerCase();
  const inYin = game.teamA.some((p) => (p.name ?? "").trim().toLowerCase() === un);
  const inYang = game.teamB.some((p) => (p.name ?? "").trim().toLowerCase() === un);
  const canSubmitYin = !inYin; // only losing team can submit
  const canSubmitYang = !inYang;
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
        Ranked leaderboard
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
              {voteRecordedMessage && (
                <Box
                  sx={{
                    mb: 2,
                    py: 1,
                    px: 2,
                    borderRadius: 1,
                    bgcolor: "rgba(103, 232, 249, 0.12)",
                    border: "1px solid rgba(103, 232, 249, 0.3)",
                  }}
                >
                  <Typography variant="body2" sx={{ color: "#67e8f9", textAlign: "center" }}>
                    {voteRecordedMessage}
                  </Typography>
                </Box>
              )}
              {game.resultVotes && (game.resultVotes.votesYin > 0 || game.resultVotes.votesYang > 0) && (
                <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.5)", textAlign: "center", mb: 1 }}>
                  {game.resultVotes.votesYin} vote{game.resultVotes.votesYin !== 1 ? "s" : ""} for Yin, {game.resultVotes.votesYang} for Yang. Two matching votes needed to confirm.
                </Typography>
              )}
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
                  disabled={submitting || !canSubmitYin}
                  onClick={() => handleSubmitResult("yin")}
                  sx={
                    canSubmitYin
                      ? {
                          borderColor: "rgba(103, 232, 249, 0.4)",
                          color: "#67e8f9",
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          "&:hover": {
                            borderColor: "#67e8f9",
                            bgcolor: "rgba(103, 232, 249, 0.12)",
                          },
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.2)",
                          color: "rgba(255,255,255,0.4)",
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          "&:hover": { borderColor: "rgba(255,255,255,0.2)", bgcolor: "transparent" },
                        }
                  }
                >
                  Yin won
                </Button>
                <Button
                  variant="outlined"
                  size="medium"
                  disabled={submitting || !canSubmitYang}
                  onClick={() => handleSubmitResult("yang")}
                  sx={
                    canSubmitYang
                      ? {
                          borderColor: "rgba(249, 168, 212, 0.4)",
                          color: "#f9a8d4",
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          "&:hover": {
                            borderColor: "#f9a8d4",
                            bgcolor: "rgba(249, 168, 212, 0.12)",
                          },
                        }
                      : {
                          borderColor: "rgba(255,255,255,0.2)",
                          color: "rgba(255,255,255,0.4)",
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          "&:hover": { borderColor: "rgba(255,255,255,0.2)", bgcolor: "transparent" },
                        }
                  }
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
