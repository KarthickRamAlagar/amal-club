import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { firebaseReady } from "@/lib/firebase";

export function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  return null;
}

export function PublicLayout() {
  return <>
    <SiteHeader />
    <main><Outlet /></main>
    <SiteFooter />
    {!firebaseReady && <div className="preview-banner"><CircleHelp size={14} /> Preview data · Add your Firebase keys in .env to enable sign-in and live data.</div>}
  </>;
}
