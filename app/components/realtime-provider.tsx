"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";
const tokenKey = "almadel_access_token";
const businessKey = "almadel_active_business_id";
const events = [
  "product.created", "product.updated", "product.deleted",
  "stock.updated", "sale.created", "customer.updated",
  "activity-log.created", "dashboard.updated",
];

type RealtimeContextValue = { socket: Socket | null };
const RealtimeContext = createContext<RealtimeContextValue>({ socket: null });

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !backendUrl) return;
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    const socket = io(backendUrl, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      auth: {
        token,
        businessId: localStorage.getItem(businessKey),
      },
    });
    socketRef.current = socket;
    setSocket(socket);

    const emitBrowserEvent = (event: string, payload: unknown) => {
      window.dispatchEvent(new CustomEvent("almadel_realtime_event", { detail: { event, payload } }));
    };
    events.forEach((event) => socket.on(event, (payload) => emitBrowserEvent(event, payload)));
    socket.on("realtime.error", (payload) => emitBrowserEvent("realtime.error", payload));
    socket.on("connect_error", (error) => console.warn("Realtime connection error:", error.message));

    const joinSelectedBusiness = () => {
      const businessId = localStorage.getItem(businessKey);
      if (businessId && socket.connected) socket.emit("business.join", businessId);
    };
    const onBusinessSwitch = () => joinSelectedBusiness();
    window.addEventListener("almadel_business_switched", onBusinessSwitch);
    socket.on("connect", joinSelectedBusiness);
    socket.connect();

    return () => {
      window.removeEventListener("almadel_business_switched", onBusinessSwitch);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ socket }), [socket]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}



