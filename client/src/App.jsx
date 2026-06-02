import { useEffect, useState } from "react";
import { AuthPage } from "./pages/AuthPage.jsx";
import { PlayerPage } from "./pages/PlayerPage.jsx";
import { AdminPage } from "./pages/AdminPage.jsx";
import { api, clearSession, loadStoredUser } from "./lib.js";

export default function App() {
  const [user, setUser] = useState(() => loadStoredUser());
  const [data, setData] = useState(null);
  const [tournament, setTournament] = useState({ teams: [], matches: [], qualifierGroups: [], bonusQuestions: [], settings: {} });
  const [error, setError] = useState("");

  async function loadEverything() {
    try {
      const [bootstrap, me] = await Promise.all([api("/api/bootstrap"), api("/api/me")]);
      setTournament(bootstrap);
      setData(me);
      setError("");
    } catch (err) {
      setError(err.message);
      if (err.message.toLowerCase().includes("token")) {
        clearSession();
        setUser(null);
      }
    }
  }

  useEffect(() => {
    api("/api/bootstrap")
      .then(setTournament)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (user) {
      loadEverything();
    }
  }, [user]);

  const onSavePrediction = async (matchId, predictedHomeScore, predictedAwayScore) => {
    await api("/api/predictions", {
      method: "POST",
      body: JSON.stringify({ matchId, predictedHomeScore, predictedAwayScore })
    });
    await loadEverything();
  };

  const onSaveQualifier = async (groupName, firstTeam, secondTeam) => {
    await api("/api/qualifiers", {
      method: "POST",
      body: JSON.stringify({ groupName, firstTeam, secondTeam })
    });
    await loadEverything();
  };

  const onSaveGroupOrder = async (groupName, teamOrder) => {
    await api("/api/group-order", {
      method: "POST",
      body: JSON.stringify({ groupName, teamOrder })
    });
    await loadEverything();
  };

  const onSaveBonus = async (questionKey, answerValue) => {
    await api("/api/bonus", {
      method: "POST",
      body: JSON.stringify({ questionKey, answerValue })
    });
    await loadEverything();
  };

  const onSaveAdminMatch = async (matchId, actualHomeScore, actualAwayScore) => {
    await api(`/api/admin/matches/${matchId}/result`, {
      method: "POST",
      body: JSON.stringify({ actualHomeScore, actualAwayScore })
    });
    await loadEverything();
  };

  const onSaveAdminQualifier = async (groupName, firstTeam, secondTeam) => {
    await api(`/api/admin/qualifiers/${groupName}`, {
      method: "POST",
      body: JSON.stringify({ firstTeam, secondTeam })
    });
    await loadEverything();
  };

  const onSaveAdminBonus = async (questionKey, correctValue) => {
    await api("/api/admin/bonus-result", {
      method: "POST",
      body: JSON.stringify({ questionKey, correctValue })
    });
    await loadEverything();
  };

  const onSaveOfficialGroupOrder = async (groupName, teamOrder) => {
    await api("/api/admin/group-order", {
      method: "POST",
      body: JSON.stringify({ groupName, teamOrder })
    });
    await loadEverything();
  };

  const onCreateAdminMatch = async ({ stage, groupName, kickoffAt, homeTeam, awayTeam }) => {
    await api("/api/admin/matches", {
      method: "POST",
      body: JSON.stringify({ stage, groupName, kickoffAt, homeTeam, awayTeam })
    });
    await loadEverything();
  };

  const onUpdateAdminMatch = async (matchId, { stage, groupName, kickoffAt, homeTeam, awayTeam }) => {
    await api(`/api/admin/matches/${matchId}`, {
      method: "PUT",
      body: JSON.stringify({ stage, groupName, kickoffAt, homeTeam, awayTeam })
    });
    await loadEverything();
  };

  const onDeleteAdminMatch = async (matchId) => {
    await api(`/api/admin/matches/${matchId}`, {
      method: "DELETE"
    });
    await loadEverything();
  };

  const onImportOfficialSchedule = async () => {
    await api("/api/admin/import-official-schedule", {
      method: "POST",
      body: JSON.stringify({})
    });
    await loadEverything();
  };

  const onSendAdminDigest = async () => {
    await api("/api/admin/send-digest", {
      method: "POST",
      body: JSON.stringify({})
    });
  };

  const onUpdateUserStatus = async (userId, status) => {
    await api(`/api/admin/users/${userId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
    await loadEverything();
  };

  const onCreateUser = async (payload) => {
    await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await loadEverything();
  };

  const onUpdateUser = async (userId, payload) => {
    await api(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    await loadEverything();
  };

  const onResetUserPassword = async (userId, password) => {
    await api(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password })
    });
    await loadEverything();
  };

  const onDeleteUser = async (userId) => {
    await api(`/api/admin/users/${userId}`, {
      method: "DELETE"
    });
    await loadEverything();
  };

  if (!user) {
    return <AuthPage onAuthenticated={setUser} />;
  }

  if (!data) {
    return <div className="loading-screen">Cargando tu zona de juego...</div>;
  }

  return (
    <>
      {error && <div className="flash-error">{error}</div>}
      {data.user.role === "admin" ? (
        <AdminPage
          data={data}
          tournament={tournament}
          onSaveAdminMatch={onSaveAdminMatch}
          onSaveAdminQualifier={onSaveAdminQualifier}
          onSaveAdminBonus={onSaveAdminBonus}
          onSaveOfficialGroupOrder={onSaveOfficialGroupOrder}
          onSendAdminDigest={onSendAdminDigest}
          onCreateAdminMatch={onCreateAdminMatch}
          onUpdateAdminMatch={onUpdateAdminMatch}
          onDeleteAdminMatch={onDeleteAdminMatch}
          onImportOfficialSchedule={onImportOfficialSchedule}
          onUpdateUserStatus={onUpdateUserStatus}
          onCreateUser={onCreateUser}
          onUpdateUser={onUpdateUser}
          onResetUserPassword={onResetUserPassword}
          onDeleteUser={onDeleteUser}
          onLogout={() => {
            clearSession();
            setUser(null);
            setData(null);
          }}
        />
      ) : (
        <PlayerPage
          data={data}
          tournament={tournament}
          onSavePrediction={onSavePrediction}
          onSaveQualifier={onSaveQualifier}
          onSaveGroupOrder={onSaveGroupOrder}
          onSaveBonus={onSaveBonus}
          onLogout={() => {
            clearSession();
            setUser(null);
            setData(null);
          }}
        />
      )}
    </>
  );
}
