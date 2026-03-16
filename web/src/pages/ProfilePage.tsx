import { useParams } from "react-router-dom";
import { useAuthStore } from "../store/auth";

// Placeholder — profile UI comes in next phase
export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile } = useAuthStore();
  const isOwn = userId === profile?.id;

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{isOwn ? profile?.username ?? "Profile" : `User ${userId}`}</h1>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        Top games, stats, and activity will appear here.
      </p>
    </main>
  );
}
