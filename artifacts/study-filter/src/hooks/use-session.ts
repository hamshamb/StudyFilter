import { useState, useEffect } from "react";

export function useSession() {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let id = localStorage.getItem("sf_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sf_session_id", id);
    }
    setSessionId(id);
  }, []);

  return sessionId;
}
