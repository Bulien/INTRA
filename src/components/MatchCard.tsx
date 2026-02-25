"use client";

import { Box, Typography } from "@mui/material";

/**
 * Reusable match card layout: header (overline + title), body (Yin | VS | Yang or custom), footer.
 * Matches the queue-match / team-builder game style.
 */
export function MatchCard({
  overline,
  title,
  meta,
  headerAction,
  children,
  footer,
}: {
  overline: string;
  title: string;
  meta?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ textAlign: headerAction ? "left" : "center", flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>
            {overline}
          </Typography>
          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600, mt: 0.5 }}>
            {title}
          </Typography>
          {meta && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.45)", display: "block", mt: 0.25 }}>
              {meta}
            </Typography>
          )}
        </Box>
        {headerAction}
      </Box>
      <Box sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</Box>
      <Box sx={{ p: 3, borderTop: "1px solid rgba(255,255,255,0.06)", bgcolor: "rgba(0,0,0,0.15)" }}>
        {footer}
      </Box>
    </Box>
  );
}

/**
 * Team column in the same style as queue-match: header strip (name + total ELO) + player list.
 */
export function TeamColumn({
  name,
  totalElo,
  color,
  accent,
  children,
}: {
  name: string;
  totalElo: number;
  color: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 0,
        overflow: "hidden",
        bgcolor: "rgba(255,255,255,0.03)",
        border: "none",
        boxShadow: `0 0 0 1px ${accent}20`,
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
        {children}
      </Box>
    </Box>
  );
}

/**
 * Single player row for TeamColumn. Use with TeamColumn's children.
 * highlight: when true, shows yellow "you" border on the whole row (aligned with teammates).
 */
export function TeamPlayerRow({
  name,
  rating,
  color,
  highlight,
  children,
}: {
  name: string;
  rating: number | string;
  color: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 1,
        px: 2,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        "&:last-of-type": { borderBottom: "none" },
        ...(highlight ? { outline: "1px solid rgba(251, 191, 36, 0.6)", outlineOffset: -1, borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.15)" } : {}),
      }}
    >
      <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", pr: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0.5 }}>
        {children ?? (
          <Typography variant="body2" sx={{ color: highlight ? "#fcd34d" : "rgba(255,255,255,0.88)", fontWeight: highlight ? 600 : 400 }}>
            {name || "—"}
          </Typography>
        )}
      </Box>
      <Typography variant="body2" sx={{ color, fontFamily: "monospace", fontWeight: 500, flexShrink: 0 }}>
        {rating ?? "—"}
      </Typography>
    </Box>
  );
}

/**
 * VS divider between the two team columns.
 */
export function VsDivider() {
  return (
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
      <Typography variant="h6" sx={{ color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>
        VS
      </Typography>
    </Box>
  );
}
