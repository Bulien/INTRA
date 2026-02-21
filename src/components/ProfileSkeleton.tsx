"use client";

import { Box, Card, CardContent, Skeleton, Typography } from "@mui/material";

export function ProfileSkeleton() {
  return (
    <Box sx={{ pb: 6 }}>
      <Skeleton variant="text" width={120} height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={180} height={28} sx={{ mb: 3 }} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Skeleton variant="circular" width={28} height={28} />
        <Skeleton variant="text" width={220} height={32} />
      </Box>

      <Skeleton variant="text" width={80} height={28} sx={{ mb: 2 }} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 32 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            sx={{
              border: "1px solid",
              borderColor: "rgba(255,255,255,0.1)",
              bgcolor: "rgba(26,26,26,0.8)",
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1.5 }} />
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Skeleton variant="text" width={70} height={24} />
                <Skeleton variant="text" width={50} height={24} />
                <Skeleton variant="text" width={55} height={24} />
                <Skeleton variant="text" width={90} height={24} />
              </Box>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Box>
          <Skeleton variant="text" width={160} height={28} sx={{ mb: 2 }} />
          <Card
            sx={{
              border: "1px solid",
              borderColor: "rgba(103,232,249,0.25)",
              bgcolor: "rgba(26,26,26,0.8)",
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ py: 2, px: 2 }}>
              <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} variant="text" width={i === 2 ? 120 : 48} height={20} sx={{ flex: i === 2 ? 1 : 0 }} />
                ))}
              </Box>
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, py: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <Skeleton variant="text" width={24} height={20} />
                  <Skeleton variant="text" width="40%" height={20} sx={{ flex: 1 }} />
                  <Skeleton variant="text" width={36} height={20} />
                  <Skeleton variant="text" width={24} height={20} />
                  <Skeleton variant="text" width={24} height={20} />
                  <Skeleton variant="text" width={44} height={20} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Skeleton variant="text" width={200} height={28} sx={{ mb: 2 }} />
          <Card
            sx={{
              border: "1px solid",
              borderColor: "rgba(249,168,212,0.2)",
              bgcolor: "rgba(26,26,26,0.8)",
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ py: 2, px: 2 }}>
              <Skeleton variant="text" width="85%" height={20} sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                <Skeleton variant="text" width={24} height={20} />
                <Skeleton variant="text" width={80} height={20} sx={{ flex: 1 }} />
                <Skeleton variant="text" width={100} height={20} />
              </Box>
              {[1, 2, 3, 4, 5].map((i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, py: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <Skeleton variant="text" width={24} height={20} />
                  <Skeleton variant="text" width="50%" height={20} sx={{ flex: 1 }} />
                  <Skeleton variant="text" width={40} height={20} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      </div>
    </Box>
  );
}
