import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, signInWithPopup } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, firebaseReady, googleProvider } from "@/lib/firebase";
import { upsertParticipant } from "@/services/members";
import { isReady, isStaff } from "@/lib/permissions";
import { rankOf } from "@/lib/constants";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [member, setMember] = useState(null);
  const [memberLoading, setMemberLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady) { setUser(null); setMemberLoading(false); return; }
    return onAuthStateChanged(auth, (u) => { setUser(u); if (!u) { setMember(null); setMemberLoading(false); } });
  }, []);

  useEffect(() => {
    if (!user) return;
    setMemberLoading(true);
    return onSnapshot(doc(db, "members", user.uid),
      (s) => { setMember(s.exists() ? s.data() : null); setMemberLoading(false); },
      () => { setMember(null); setMemberLoading(false); });
  }, [user]);

  const value = useMemo(() => ({
    user, member, loading: user === undefined || (user && memberLoading),
    isMember: !!member && member.status === "active",
    ready: isReady(member),
    staff: isStaff(member),
    rank: rankOf(member?.role),
    signOut: () => signOut(auth),
    async signInWithGoogle() {
      const cred = await signInWithPopup(auth, googleProvider);
      await upsertParticipant(cred.user).catch(() => {});
      return cred.user;
    },
  }), [user, member, memberLoading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
